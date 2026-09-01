"""Test-only helpers for real-browser Review data isolation."""

from apps.review import services


def reset_review_demo_data() -> dict[str, int]:
    """
    Restore the deterministic Loan and Finance sources used by the configurable Review browser route.

    Playwright runs against one no-reload Django process, so Review Submit mutations otherwise survive
    into later tests. Mutate both module-level lists in place so any code holding their object identity
    continues to observe the authoritative reset contents.

    If Review later moves to database-backed repositories, keep this E2E boundary and replace only the
    implementation with reset/seed operations against the dedicated E2E datastore.
    """

    fresh_loans = services._build_loans()
    services.LOANS.clear()
    services.LOANS.extend(fresh_loans)

    fresh_finance_rows = services._build_finance_rows()
    services.FINANCE_ROWS.clear()
    services.FINANCE_ROWS.extend(fresh_finance_rows)

    return {
        "loanRowCount": len(services.LOANS),
        "financeRowCount": len(services.FINANCE_ROWS),
    }
