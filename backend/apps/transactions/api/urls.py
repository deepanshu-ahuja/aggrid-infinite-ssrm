from django.urls import path

from .views import (
    TransactionBulkUpdateView,
    TransactionDetailView,
    TransactionQueryView,
    TransactionSelectionUpdateView,
)


urlpatterns = [
    path("query/", TransactionQueryView.as_view(), name="transaction-query"),
    path("bulk/", TransactionBulkUpdateView.as_view(), name="transaction-bulk-update"),
    path(
        "selection/",
        TransactionSelectionUpdateView.as_view(),
        name="transaction-selection-update",
    ),
    path("<str:transaction_id>/", TransactionDetailView.as_view(), name="transaction-detail"),
]
