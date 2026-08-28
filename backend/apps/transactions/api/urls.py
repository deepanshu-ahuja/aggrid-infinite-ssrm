from django.urls import path

from .views import (
    TransactionBulkUpdateView,
    TransactionDetailView,
    TransactionQueryView,
    TransactionSelectionExportView,
    TransactionSelectionUpdateView,
)


urlpatterns = [
    path("query/", TransactionQueryView.as_view(), name="transaction-query"),
    path("bulk/", TransactionBulkUpdateView.as_view(), name="transaction-bulk-update"),
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
    # Keep the catch-all transaction id route after concrete selection routes so `selection/export`
    # can never be interpreted as a transaction identifier as this API grows.
    path("<str:transaction_id>/", TransactionDetailView.as_view(), name="transaction-detail"),
]
