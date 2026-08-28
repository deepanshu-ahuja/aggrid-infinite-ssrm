from datetime import date, timedelta
from typing import Any, Dict, Iterable, List, Optional, Tuple


STATUSES = ("Completed", "Pending", "Failed")
ACCOUNTS = ("Operating", "Treasury", "Payroll", "Settlement")
CURRENCIES = ("INR", "USD", "EUR")


class TransactionNotFoundError(LookupError):
    """Raised when an update targets a Transaction id that is not in the current data source."""


class TransactionReadOnlyError(PermissionError):
    """Raised when a direct/edit persistence request targets a backend read-only Transaction."""


def _interaction_policy_for_row(row: Dict[str, Any]) -> Tuple[str, Optional[str]]:
    """Derive the demo Transaction interaction policy from Transaction business data."""

    if row["status"] == "Completed" and row["account"] == "Settlement":
        return (
            "readOnly",
            "Completed Settlement transactions are locked from selection and editing.",
        )

    if row["status"] == "Pending" and row["account"] == "Treasury":
        return (
            "selectionDisabled",
            "Pending Treasury transactions require individual review, so selection-based bulk actions are disabled.",
        )

    return "enabled", None


def _refresh_interaction_metadata(row: Dict[str, Any]) -> None:
    """Recompute derived interaction metadata after authoritative row data changes."""

    mode, reason = _interaction_policy_for_row(row)
    row["interactionMode"] = mode
    row["interactionReason"] = reason


def _build_transactions(count: int = 750) -> List[Dict[str, Any]]:
    today = date.today()
    rows: List[Dict[str, Any]] = []

    for index in range(count):
        row = {
            "id": f"txn-{index + 1:05d}",
            "reference": f"TRX-{100000 + index}",
            "account": ACCOUNTS[index % len(ACCOUNTS)],
            "amount": round(500 + ((index * 791.37) % 250000), 2),
            "currency": CURRENCIES[index % len(CURRENCIES)],
            "status": STATUSES[index % len(STATUSES)],
            "transactionDate": today - timedelta(days=index % 365),
        }
        _refresh_interaction_metadata(row)
        rows.append(row)

    return rows


# The sample source is deterministic so the grid boundary works before a Databricks data source is
# selected. Replacing this list with a repository/query service does not change the DRF contract.
TRANSACTIONS = _build_transactions()


def _as_comparable(value: Any) -> Any:
    if isinstance(value, str):
        return value.casefold()
    if isinstance(value, date):
        return value.isoformat()
    return value


def _matches_filter(row: Dict[str, Any], filter_spec: Dict[str, Any]) -> bool:
    field = filter_spec["field"]
    operator = filter_spec["operator"]
    expected = _as_comparable(filter_spec["value"])
    actual = _as_comparable(row[field])

    if operator == "contains":
        return str(expected) in str(actual)
    if operator == "startsWith":
        return str(actual).startswith(str(expected))
    if operator == "endsWith":
        return str(actual).endswith(str(expected))
    if operator == "equals":
        return actual == expected
    if operator == "notEqual":
        return actual != expected
    if operator == "greaterThan":
        return actual > expected
    if operator == "greaterThanOrEqual":
        return actual >= expected
    if operator == "lessThan":
        return actual < expected
    if operator == "lessThanOrEqual":
        return actual <= expected

    return False


def _apply_filters(
    rows: Iterable[Dict[str, Any]], filters: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    return [row for row in rows if all(_matches_filter(row, item) for item in filters)]


def _apply_sort(
    rows: List[Dict[str, Any]], sort_model: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    sorted_rows = list(rows)

    # Applying sort keys in reverse preserves the order of earlier keys through Python's stable sort.
    for sort_item in reversed(sort_model):
        field = sort_item["field"]
        sorted_rows.sort(
            key=lambda row: _as_comparable(row[field]),
            reverse=sort_item["direction"] == "desc",
        )

    return sorted_rows


def _find_transaction(transaction_id: str) -> Dict[str, Any]:
    for row in TRANSACTIONS:
        if row["id"] == transaction_id:
            return row

    raise TransactionNotFoundError(transaction_id)


def _is_selection_eligible(row: Dict[str, Any]) -> bool:
    """
    Backend-authoritative eligibility for checkbox/selection-based actions.

    Select All may target rows that never had an AG Grid RowNode, so the backend must enforce row
    eligibility over the authoritative dataset. Disabled rows are not frontend `exclude` IDs: those
    IDs represent user deselections, while this rule represents business eligibility.
    """

    return row.get("interactionMode", "enabled") == "enabled"


def _is_editable(row: Dict[str, Any]) -> bool:
    """Backend-authoritative eligibility for direct/explicit editing."""

    return row.get("interactionMode", "enabled") != "readOnly"


def update_transaction(
    transaction_id: str,
    changes: Dict[str, Any],
) -> Dict[str, Any]:
    """Apply one already-validated direct edit and return the authoritative updated row."""

    row = _find_transaction(transaction_id)
    if not _is_editable(row):
        raise TransactionReadOnlyError(transaction_id)

    row.update(changes)
    _refresh_interaction_metadata(row)
    return row


def bulk_update_transactions(
    updates: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Apply an already-validated group of explicit row patches as one logical operation."""

    # Resolve every ID before mutation so missing/read-only rows cannot cause a partial bulk save.
    resolved = [
        (_find_transaction(item["id"]), item["changes"])
        for item in updates
    ]

    if any(not _is_editable(row) for row, _changes in resolved):
        raise TransactionReadOnlyError()

    for row, changes in resolved:
        row.update(changes)
        _refresh_interaction_metadata(row)

    return [row for row, _changes in resolved]


def resolve_transactions_by_selection(
    selection: Dict[str, Any],
    filters: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Resolve the backend-eligible rows represented by one logical server-backed selection.

    This is operation-neutral on purpose. Status updates and selected CSV export must mean the same
    rows, so mutation/export code calls this resolver rather than each reimplementing include/exclude
    semantics independently.

    - include + ids: resolve those exact IDs, then keep backend-eligible rows;
    - exclude + filters: all matching eligible rows minus user exception IDs;
    - exclude + no filters: all eligible records minus user exception IDs.
    """

    selected_ids = selection.get("ids", [])

    if selection["mode"] == "include":
        # Resolve EVERY explicit ID first. A stale/missing ID is a malformed exact selection and should
        # fail instead of silently exporting/updating only the subset that still exists.
        resolved_rows = [_find_transaction(transaction_id) for transaction_id in selected_ids]

        # UI selectability should already keep disabled rows out, but the backend remains authoritative
        # for stale/crafted requests and for business policy changes between selection and action time.
        return [row for row in resolved_rows if _is_selection_eligible(row)]

    # In exclude mode, non-empty filters define Select All Filtered. No filters means All Records.
    candidates = _apply_filters(TRANSACTIONS, filters) if filters else list(TRANSACTIONS)
    excluded_ids = set(selected_ids)

    return [
        row
        for row in candidates
        if _is_selection_eligible(row) and row["id"] not in excluded_ids
    ]


def update_transactions_by_selection(
    selection: Dict[str, Any],
    filters: List[Dict[str, Any]],
    changes: Dict[str, Any],
) -> int:
    """Apply one business patch to the backend-eligible logical selection."""

    selected_rows = resolve_transactions_by_selection(selection, filters)

    for row in selected_rows:
        row.update(changes)
        # A selected business action may change fields that determine future row interaction policy.
        _refresh_interaction_metadata(row)

    return len(selected_rows)


def query_transactions(query: Dict[str, Any]) -> Dict[str, Any]:
    filtered_rows = _apply_filters(TRANSACTIONS, query.get("filters", []))
    sorted_rows = _apply_sort(filtered_rows, query.get("sort", []))

    offset = query["offset"]
    end = offset + query["limit"]

    return {
        "rows": sorted_rows[offset:end],
        # This is the normal dataset size, not an eligibility-aware selection count. Dataset-wide
        # selected-count UI currently uses it deliberately; a future API can add eligible totals if a
        # product requires exact disabled-row-aware counts across unloaded records.
        "totalCount": len(TRANSACTIONS),
        "filteredCount": len(filtered_rows),
    }
