from django.urls import path

from .client_views import TransactionCollectionView
from .e2e_views import TransactionE2EResetView
from .import_views import TransactionImportApplyView, TransactionImportPreviewView
from .views import (
    TransactionBulkUpdateView,
    TransactionDetailView,
    TransactionQueryView,
    TransactionSelectionExportView,
    TransactionSelectionUpdateView,
)


urlpatterns = [
    # Client-Side Row Model owns local sort/filter/page behavior, so it receives the complete bounded
    # Transaction working set from the collection route rather than abusing the server-grid query API.
    path("", TransactionCollectionView.as_view(), name="transaction-collection"),
    path("query/", TransactionQueryView.as_view(), name="transaction-query"),
    path("bulk/", TransactionBulkUpdateView.as_view(), name="transaction-bulk-update"),
    # Import is a separate workflow from tracked cell editing. Preview is mutation-free; Apply
    # revalidates the same CSV and persists its explicit update set atomically.
    path("import/preview/", TransactionImportPreviewView.as_view(), name="transaction-import-preview"),
    path("import/apply/", TransactionImportApplyView.as_view(), name="transaction-import-apply"),
    path(
        "selection/export/",
        TransactionSelectionExportView.as_view(),
        name="transaction-selection-export",
    ),
    path(
        "selection/",
        TransactionSelectionUpdateView.as_view(),
        name="transaction-selection-update",
    ),
    # Browser regression runs one Django process for the suite and resets its in-memory authoritative
    # data before every test. The view returns 404 unless settings.E2E_TESTING was explicitly enabled.
    path("__e2e__/reset/", TransactionE2EResetView.as_view(), name="transaction-e2e-reset"),
    # Keep the catch-all transaction id route after concrete collection/selection/test routes so fixed
    # API paths can never be interpreted as transaction identifiers as this API grows.
    path("<str:transaction_id>/", TransactionDetailView.as_view(), name="transaction-detail"),
]
