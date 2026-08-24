from datetime import date, timedelta
from typing import Any, Dict, Iterable, List


STATUSES = ("Completed", "Pending", "Failed")
ACCOUNTS = ("Operating", "Treasury", "Payroll", "Settlement")
CURRENCIES = ("INR", "USD", "EUR")


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


def query_transactions(query: Dict[str, Any]) -> Dict[str, Any]:
    filtered_rows = _apply_filters(TRANSACTIONS, query.get("filters", []))
    sorted_rows = _apply_sort(filtered_rows, query.get("sort", []))

    offset = query["offset"]
    end = offset + query["limit"]

    return {
        "rows": sorted_rows[offset:end],
        "totalCount": len(sorted_rows),
    }
