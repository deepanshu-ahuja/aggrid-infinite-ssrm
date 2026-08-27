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
    """
    Derive the DEMO Transaction interaction policy from Transaction business data.

    This function is intentionally feature/domain code. It answers the business question "what may a
    user do with THIS Transaction?" and returns only the generic grid mode + human-readable reason.

    Shared frontend grid code must never duplicate these status/account checks. A future Payables table
    can have completely different rules while still returning the same generic modes.
    """

    # Completed + Settlement is our demo example of a permanently locked/read-only business state.
    # The generic meaning of `readOnly` is handled elsewhere: no selection, no editing, no modifying
    # row actions. Keeping the business condition here prevents AG Grid code from knowing Transaction
    # statuses/accounts.
    if row["status"] == "Completed" and row["account"] == "Settlement":
        return (
            "readOnly",
            "Completed Settlement transactions are locked from selection and editing.",
        )

    # Pending + Treasury demonstrates the weaker state: the Transaction still supports individual
    # review/editing, but it must not participate in checkbox selection or selection-based bulk actions.
    if row["status"] == "Pending" and row["account"] == "Treasury":
        return (
            "selectionDisabled",
            "Pending Treasury transactions require individual review, so selection-based bulk actions are disabled.",
        )

    # Every row that matches neither domain restriction receives normal grid behaviour.
    return "enabled", None


def _refresh_interaction_metadata(row: Dict[str, Any]) -> None:
    """
    Recompute derived interaction metadata after authoritative row data changes.

    `interactionMode` is NOT an independent mutable business field. It is derived from the real row
    values above. For example, if an allowed edit changes a Settlement row to Completed, the next
    authoritative response must immediately become `readOnly`.
    """

    mode, reason = _interaction_policy_for_row(row)

    # These values are returned to the frontend as capability/presentation metadata. The frontend uses
    # `interactionMode` to configure native AG Grid behaviour and `interactionReason` only to explain
    # the restriction to the user.
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

        # Generate interaction metadata from the same business-data policy used after later writes.
        # This avoids a special "initial demo" rule that could drift from mutation behaviour.
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
    Backend-authoritative eligibility for CHECKBOX/SELECTION-BASED actions.

    This is intentionally independent from whatever the browser currently has loaded. Select All
    Records / Select All Filtered can target rows that never had an AG Grid RowNode, so Python must
    enforce the same business eligibility over the authoritative dataset.

    Both `selectionDisabled` and `readOnly` are outside the selectable universe. They are NOT frontend
    `exclude` IDs: exclusions represent user deselections, while this function represents business
    eligibility.
    """

    # Older hand-written fixtures may omit interaction metadata, so they default to enabled. Real API
    # rows generated by this service always include the current derived mode.
    return row.get("interactionMode", "enabled") == "enabled"


def _is_editable(row: Dict[str, Any]) -> bool:
    """
    Backend-authoritative eligibility for DIRECT/EXPLICIT editing.

    Selection eligibility is deliberately stricter than edit eligibility: `selectionDisabled` rows may
    still be edited individually, while only `readOnly` blocks direct/bulk edit persistence.
    """

    return row.get("interactionMode", "enabled") != "readOnly"


def update_transaction(
    transaction_id: str,
    changes: Dict[str, Any],
) -> Dict[str, Any]:
    """Apply one already-validated direct edit and return the authoritative updated row."""

    row = _find_transaction(transaction_id)

    # Frontend `editable` should prevent a normal user edit, but the backend cannot trust UI state. A
    # stale tab or crafted request must still be rejected here.
    if not _is_editable(row):
        raise TransactionReadOnlyError(transaction_id)

    row.update(changes)

    # The update may change fields that DEFINE the interaction policy. Recompute before returning so
    # the grid refresh receives the new authoritative mode/reason immediately.
    _refresh_interaction_metadata(row)
    return row


def bulk_update_transactions(
    updates: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Apply an already-validated group of explicit row patches as one logical operation.

    Resolve every id and verify edit eligibility BEFORE mutating anything. With the current in-memory
    source this gives atomic not-found/read-only behaviour. A future database/repository implementation
    should preserve the same contract with a real transaction boundary.
    """

    # Resolve first. If any ID is stale/missing, `_find_transaction` raises before a valid row changes.
    resolved = [
        (_find_transaction(item["id"]), item["changes"])
        for item in updates
    ]

    # A single read-only target invalidates the whole explicit bulk edit. We do not partially save the
    # editable rows and then fail halfway through the batch.
    if any(not _is_editable(row) for row, _changes in resolved):
        raise TransactionReadOnlyError()

    for row, changes in resolved:
        row.update(changes)

        # Each patch can alter the business fields that determine row interaction. Keep returned rows
        # and later query results aligned with the new authoritative data.
        _refresh_interaction_metadata(row)

    return [row for row, _changes in resolved]


def update_transactions_by_selection(
    selection: Dict[str, Any],
    filters: List[Dict[str, Any]],
    changes: Dict[str, Any],
) -> int:
    """
    Apply one business patch to the ELIGIBLE logical server-backed selection.

    The compact include/exclude contract is unchanged by row eligibility:

    - include + ids -> resolve those exact ids, then keep only backend-eligible rows;
    - exclude + non-empty filters -> matching eligible rows minus user exception ids;
    - exclude + no filters -> all eligible rows minus user exception ids.

    Disabled rows are not encoded as exclusions. They are outside the selectable universe entirely,
    including when they were never loaded by the browser.
    """

    selected_ids = selection.get("ids", [])

    if selection["mode"] == "include":
        # Explicit include comes from manual/current-page selection. Resolve EVERY requested ID first so
        # a stale/missing ID cannot produce a partially applied action.
        resolved_rows = [_find_transaction(transaction_id) for transaction_id in selected_ids]

        # Defence in depth: the UI should never allow a disabled loaded row into explicit selection,
        # but Python still removes any ineligible ID from stale/crafted requests.
        selected_rows = [row for row in resolved_rows if _is_selection_eligible(row)]
    else:
        # In exclude mode, filters define Select All Filtered. No filters means Select All Records.
        # We resolve the candidate dataset first without asking the frontend to enumerate row IDs.
        candidates = _apply_filters(TRANSACTIONS, filters) if filters else list(TRANSACTIONS)

        # `selected_ids` in exclude mode contains ONLY explicit user deselections. It must not contain
        # every business-disabled row; `_is_selection_eligible` handles those independently below.
        excluded_ids = set(selected_ids)

        selected_rows = [
            row
            for row in candidates
            if _is_selection_eligible(row) and row["id"] not in excluded_ids
        ]

    for row in selected_rows:
        row.update(changes)

        # A business action can also change the fields that drive row interaction. Recompute after the
        # mutation so the refreshed grid sees the correct new mode/reason.
        _refresh_interaction_metadata(row)

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
