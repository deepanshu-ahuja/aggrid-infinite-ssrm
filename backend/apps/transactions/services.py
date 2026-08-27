from datetime import date, timedelta
from typing import Any, Dict, Iterable, List


STATUSES = ("Completed", "Pending", "Failed")
ACCOUNTS = ("Operating", "Treasury", "Payroll", "Settlement")
CURRENCIES = ("INR", "USD", "EUR")


class TransactionNotFoundError(LookupError):
    """Raised when an update targets a Transaction id that is not in the current data source."""


def _build_transactions(count: int = 750) -> List[Dict[str, Any]]:
    today = date.today()
    rows: List[Dict[str, Any]] = []

    for index in range(count):
        rows.append(
            {
                "id": f"txn-{index + 1:05d}",
                "reference": f"TRX-{100000 + index}",
                "account": ACCOUNTS[index % len(ACCOUNTS)],
                "amount": round(500 + ((index * 791.37) % 250000), 2),
                "currency": CURRENCIES[index % len(CURRENCIES)],
                "status": STATUSES[index % len(STATUSES)],
                "transactionDate": today - timedelta(days=index % 365),
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


def update_transaction(
    transaction_id: str,
    changes: Dict[str, Any],
) -> Dict[str, Any]:
    """Apply one already-validated patch and return the authoritative updated row."""

    row = _find_transaction(transaction_id)
    row.update(changes)
    return row


def bulk_update_transactions(
    updates: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Apply an already-validated group of row patches as one logical operation.

    Resolve every id before mutating anything. With the current in-memory source this gives the API
    atomic not-found behavior: if any requested Transaction is missing, none of the valid rows are
    changed. A future database/repository implementation should preserve that contract with a real
    transaction boundary.
    """

    resolved = [
        (_find_transaction(item["id"]), item["changes"])
        for item in updates
    ]

    for row, changes in resolved:
        row.update(changes)

    return [row for row, _changes in resolved]


def update_transactions_by_selection(
    selection: Dict[str, Any],
    filters: List[Dict[str, Any]],
    changes: Dict[str, Any],
) -> int:
    """
    Apply one patch to the logical selection represented by the server-backed grid.

    The backend deliberately infers dataset meaning from the compact wire contract:

    - include + ids -> resolve and update exactly those ids;
    - exclude + non-empty filters -> matching rows minus exception ids;
    - exclude + no filters -> all rows minus exception ids.

    A separate `scope` field is unnecessary because filters already distinguish filtered-wide from
    all-record selection. If a filtered Select All has no active filters, its dataset is mathematically
    the same as all records.
    """

    selected_ids = selection.get("ids", [])

    if selection["mode"] == "include":
        # Exact selection is atomic: resolve every id before changing any row so a stale/missing id
        # cannot leave a partially updated explicit batch.
        selected_rows = [_find_transaction(transaction_id) for transaction_id in selected_ids]
    else:
        candidates = _apply_filters(TRANSACTIONS, filters) if filters else list(TRANSACTIONS)
        excluded_ids = set(selected_ids)
        selected_rows = [row for row in candidates if row["id"] not in excluded_ids]

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
