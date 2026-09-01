from datetime import date, timedelta
from typing import Any, Dict, Iterable, List


LOAN_STATUSES = ("Active", "Pending", "Closed")
LOAN_CURRENCIES = ("USD", "EUR", "INR")
LOAN_REGIONS = ("North", "South", "East", "West")
FINANCE_STATUSES = ("Open", "Submitted", "Approved", "Escalated")
FINANCE_CURRENCIES = ("USD", "EUR", "GBP", "JPY")
FINANCE_DESKS = ("Credit", "Rates", "Treasury", "Structured")


def _build_loans(count: int = 180) -> List[Dict[str, Any]]:
    today = date.today()
    rows: List[Dict[str, Any]] = []
    for index in range(count):
        rows.append(
            {
                "id": f"LN-{1000 + index}",
                "borrower": f"Borrower {index + 1:03d}",
                "principal": round(250_000 + ((index * 117_913.75) % 8_000_000), 2),
                "currency": LOAN_CURRENCIES[index % len(LOAN_CURRENCIES)],
                "status": LOAN_STATUSES[index % len(LOAN_STATUSES)],
                "originationDate": (today - timedelta(days=(index * 11) % 900)).isoformat(),
                "internalScore": 45 + (index * 7) % 55,
                "region": LOAN_REGIONS[index % len(LOAN_REGIONS)],
            }
        )
    return rows


def _build_finance_rows(count: int = 210) -> List[Dict[str, Any]]:
    today = date.today()
    rows: List[Dict[str, Any]] = []
    for index in range(count):
        rows.append(
            {
                # Finance deliberately does not use `id`; the configurable rowId.path must remain
                # entity-owned rather than assuming one universal backend identity property.
                "recordKey": f"FIN-{5000 + index}",
                "facility": f"Facility {chr(65 + (index % 12))}-{index + 1:03d}",
                "counterparty": f"Counterparty {index % 37:02d}",
                "exposure": round(700_000 + ((index * 319_771.25) % 15_000_000), 2),
                "currency": FINANCE_CURRENCIES[index % len(FINANCE_CURRENCIES)],
                "desk": FINANCE_DESKS[index % len(FINANCE_DESKS)],
                "reviewStatus": FINANCE_STATUSES[index % len(FINANCE_STATUSES)],
                "utilizationPct": round(18 + ((index * 13.7) % 79), 1),
                "nextReviewDate": (today + timedelta(days=(index * 17) % 365)).isoformat(),
            }
        )
    return rows


LOANS = _build_loans()
FINANCE_ROWS = _build_finance_rows()


def _comparable(value: Any) -> Any:
    return value.casefold() if isinstance(value, str) else value


def _matches(row: Dict[str, Any], field: str, operator: str, expected: Any) -> bool:
    actual = _comparable(row[field])
    expected_value = _comparable(expected)
    if operator == "contains":
        return str(expected_value) in str(actual)
    if operator == "startsWith":
        return str(actual).startswith(str(expected_value))
    if operator == "endsWith":
        return str(actual).endswith(str(expected_value))
    if operator == "equals":
        return actual == expected_value
    if operator == "notEqual":
        return actual != expected_value
    if operator == "greaterThan":
        return actual > expected_value
    if operator == "greaterThanOrEqual":
        return actual >= expected_value
    if operator == "lessThan":
        return actual < expected_value
    if operator == "lessThanOrEqual":
        return actual <= expected_value
    return False


def _filter_rows(rows: Iterable[Dict[str, Any]], filters: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    specs = list(filters)
    return [
        row
        for row in rows
        if all(_matches(row, spec["field"], spec["operator"], spec["value"]) for spec in specs)
    ]


def _sort_rows(rows: Iterable[Dict[str, Any]], sort_items: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    sorted_rows = list(rows)
    for item in reversed(list(sort_items)):
        sorted_rows.sort(
            key=lambda row: _comparable(row[item["field"]]),
            reverse=item["direction"] == "desc",
        )
    return sorted_rows


def query_loans(query: Dict[str, Any]) -> Dict[str, Any]:
    """Loan intentionally uses the repository's normal flat grid query wire contract."""
    filtered = _filter_rows(LOANS, query.get("filters", []))
    sorted_rows = _sort_rows(filtered, query.get("sort", []))
    offset = query["offset"]
    end = offset + query["limit"]
    return {
        "rows": sorted_rows[offset:end],
        "totalCount": len(LOANS),
        "filteredCount": len(filtered),
    }


_FINANCE_OPERATOR_MAP = {
    "has": "contains",
    "eq": "equals",
    "neq": "notEqual",
    "prefix": "startsWith",
    "suffix": "endsWith",
    "gt": "greaterThan",
    "gte": "greaterThanOrEqual",
    "lt": "lessThan",
    "lte": "lessThanOrEqual",
}


def _finance_filters(criteria: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {
            "field": item["attribute"],
            "operator": _FINANCE_OPERATOR_MAP[item["comparison"]],
            "value": item["operand"],
        }
        for item in criteria
    ]


def _finance_sort(order_by: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {
            "field": item["attribute"],
            "direction": "desc" if item["descending"] else "asc",
        }
        for item in order_by
    ]


def search_finance(request: Dict[str, Any]) -> Dict[str, Any]:
    """
    Finance deliberately exposes a wire contract that is NOT GridListRequest/GridListResponse.

    The frontend Finance adapter must translate AG Grid's flat request into `window/orderBy/criteria`
    and then normalize `records/counts` back to GridBlockResult. This proves the generic configurable
    SSRM runtime is not coupled to one company/backend paging vocabulary.
    """
    filtered = _filter_rows(FINANCE_ROWS, _finance_filters(request.get("criteria", [])))
    sorted_rows = _sort_rows(filtered, _finance_sort(request.get("orderBy", [])))
    start = request["window"]["from"]
    end = start + request["window"]["size"]
    return {
        "records": sorted_rows[start:end],
        "counts": {
            "universe": len(FINANCE_ROWS),
            "matching": len(filtered),
        },
    }


def _find_by_key(rows: Iterable[Dict[str, Any]], key_name: str, key: str) -> Dict[str, Any]:
    for row in rows:
        if row[key_name] == key:
            return row
    raise LookupError(key)


def _resolve_standard_selection(
    rows: Iterable[Dict[str, Any]],
    key_name: str,
    selection: Dict[str, Any],
    filters: Iterable[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    rows_list = list(rows)
    ids = selection.get("ids", [])
    if selection["mode"] == "include":
        return [_find_by_key(rows_list, key_name, item) for item in ids]

    candidates = _filter_rows(rows_list, filters) if list(filters) else rows_list
    excluded = set(ids)
    return [row for row in candidates if row[key_name] not in excluded]


def submit_loans(request: Dict[str, Any]) -> Dict[str, Any]:
    selected = _resolve_standard_selection(
        LOANS,
        "id",
        request["selection"],
        request.get("filters", []),
    )
    for row in selected:
        if row["status"] != "Closed":
            row["status"] = "Pending"
    return {"submittedCount": len(selected)}


def submit_finance(request: Dict[str, Any]) -> Dict[str, Any]:
    target = request["target"]
    if target["mode"] == "explicit":
        selected = [_find_by_key(FINANCE_ROWS, "recordKey", key) for key in target.get("keys", [])]
    else:
        candidates = (
            _filter_rows(FINANCE_ROWS, _finance_filters(target.get("criteria", [])))
            if target.get("criteria")
            else list(FINANCE_ROWS)
        )
        excluded = set(target.get("exceptKeys", []))
        selected = [row for row in candidates if row["recordKey"] not in excluded]

    for row in selected:
        row["reviewStatus"] = "Submitted"

    # Response is intentionally different from Loan and Transactions. The frontend runtime adapter
    # normalizes this into one small Review action result for the common Review component.
    return {
        "outcome": {"accepted": len(selected)},
        "operationId": f"finance-submit-{len(selected)}",
    }
