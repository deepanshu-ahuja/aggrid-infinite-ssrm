"""Test-only helpers for real-browser regression data isolation."""

from apps.transactions import services


def reset_transaction_demo_data() -> int:
    """
    Restore the authoritative in-memory Transaction source to its deterministic startup dataset.

    Playwright runs many browser tests against one Django process. Mutation scenarios therefore share
    the module-level `services.TRANSACTIONS` list unless every test restores it first. Mutate the list
    in place instead of rebinding it so any code holding the authoritative list object keeps seeing the
    reset contents.

    When Transactions eventually move behind a database/repository, the E2E reset boundary can keep
    this public purpose while its implementation changes to clear/seed the dedicated test datastore.
    """

    fresh_rows = services._build_transactions()
    services.TRANSACTIONS.clear()
    services.TRANSACTIONS.extend(fresh_rows)
    return len(services.TRANSACTIONS)
