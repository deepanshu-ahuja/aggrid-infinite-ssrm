from datetime import date, timedelta
from typing import Any, Dict, Iterable, List, Optional


STATUSES = ("Completed", "Pending", "Failed")
ACCOUNTS = ("Operating", "Treasury", "Payroll", "Settlement")
CURRENCIES = ("INR", "USD", "EUR")


class TransactionNotFoundError(LookupError):
    """Raised when an update targets a Transaction id that is not in the current data source."""


class TransactionReadOnlyError(PermissionError):
    """Raised when a direct/edit persistence request targets a backend read-only Transaction."""


def _interaction_mode_for_index(index: int) -> str:
    """Deterministic sample policy used only to exercise generic grid interaction states locally."""

    row_number = index + 1
    if row_number % 17 == 0:
        return "readOnly"
    if row_number % 11 == 0:
        return "selectionDisabled"
    return "enabled"


def _interaction_reason(mode: str) -> Optional[str]:
    """
    Human-readable sample reason returned with a restricted row.

    Real features should return the domain reason produced by their backend policy. The grid consumes
    this text only for explanation/presentation; it never uses the reason string to enforce behavior.
    """

    if mode == "selectionDisabled":
        return "Demo eligibility rule: every 11th row is excluded from selection-based bulk actions."
    if mode == "readOnly":
        return "Demo lock rule: every 17th row is read-only and cannot be selected or edited."
    return None


def _build_transactions(count: int = 750) -> List[Dict[str, Any]]:
    today = date.today()
    rows: List[Dict[str, Any]] = []

    for index in range(count):
        interaction_mode = _interaction_mode_for_index(index)
        rows.append(
            {
                "id": f"txn-{index + 1:05d}",
                "reference": f"TRX-{100000 + index}",
                "account": ACCOUNTS[index % len(ACCOUNTS)],
                "amount": round(500 + ((index * 791.37) % 250000), 2),
                "currency": CURRENCIES[index % len(CURRENCIES)],
                "status": STATUSES[index % len(STATUSES)],
                "transactionDate": today - timedelta(days=index % 365),
                "interactionMode": interaction_mode,
                "interactionReason": _interaction_reason(interaction_mode),
            }
        )

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
    Backend-authoritative selection eligibility.

    Missing metadata defaults to enabled so older fixtures remain valid, while real query responses
    always include `interactionMode`. Both selection-disabled and read-only rows live outside the
    selectable universe and therefore never need to be manufactured as include/exclude exceptions.
    """

    return row.get("interactionMode", "enabled") == "enabled"


def _is_editable(row: Dict[str, Any]) -> bool:
    """Selection-disabled rows may still be edited; only the stronger read-only mode blocks writes."""

    return row.get("interactionMode", "enabled") != "readOnly"


def update_transaction(
    transaction_id: str,
    changes: Dict[str, Any],
) -> Dict[str, Any]:
    """Apply one already-validated patch and return the authoritative updated row."""

    row = _find_transaction(transaction_id)
    if not _is_editable(row):
        raise TransactionReadOnlyError(transaction_id)

    row.update(changes)
    return row


def bulk_update_transactions(
    updates: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Apply an already-validated group of row patches as one logical operation.

    Resolve every id and verify edit eligibility before mutating anything. With the current in-memory
    source this gives atomic not-found/read-only behavior. A future database/repository implementation
    should preserve that contract with a real transaction boundary.
    """

    resolved = [
        (_find_transaction(item["id"]), item["changes"])
        for item in updates
    ]

    if any(not _is_editable(row) for row, _changes in resolved):
        raise TransactionReadOnlyError()

    for row, changes in resolved:
        row.update(changes)

    return [row for row, _changes in resolved]


def update_transactions_by_selection(
    selection: Dict[str, Any],
    filters: List[Dict[str, Any]],
    changes: Dict[str, Any],
) -> int:
    """
    Apply one patch to the eligible logical selection represented by the server-backed grid.

    The compact include/exclude contract is unchanged by row eligibility:

    - include + ids -> resolve those exact ids, then keep only backend-eligible rows;
    - exclude + non-empty filters -> matching eligible rows minus user exception ids;
    - exclude + no filters -> all eligible rows minus user exception ids.

    Disabled rows are not encoded as exclusions. They are outside the selectable universe entirely,
    including when they were never loaded by the browser.
    """

    selected_ids = selection.get("ids", [])

    if selection["mode"] == "include":
        # Resolve every requested id first so a stale/missing explicit id cannot leave a partial batch.
        resolved_rows = [_find_transaction(transaction_id) for transaction_id in selected_ids]
        selected_rows = [row for row in resolved_rows if _is_selection_eligible(row)]
    else:
        candidates = _apply_filters(TRANSACTIONS, filters) if filters else list(TRANSACTIONS)
        excluded_ids = set(selected_ids)
        selected_rows = [
            row
            for row in candidates
            if _is_selection_eligible(row) and row["id"] not in excluded_ids
        ]

    for row in selected_rows:
        row.update(changes)

    return len(selected_rows)


def query_transactions(query: Dict[str, Any]) -> Dict[str, Any]:
    filtered_rows = _apply_filters(TRANSACTIONS, query.get("filters", []))
    sorted_rows = _apply_sort(filtered_rows, query.get("sort", []))

    offset = query["offset"]
    end = offset + query["limit"]

    return {
        "rows": sorted_rows[offset:end],
        # Complete dataset size is stable across the current filter and is useful for actions such as
        # Infinite "Select All Records" without issuing a second count-only request.
        "totalCount": len(TRANSACTIONS),
        # AG Grid row-model sizing must follow the CURRENT query result, not the unfiltered dataset.
        "filteredCount": len(filtered_rows),
    }
