from django.urls import path

from .views import (
    TransactionBulkUpdateView,
    TransactionDetailView,
    TransactionQueryView,
)


urlpatterns = [
    path("query/", TransactionQueryView.as_view(), name="transaction-query"),
    path("bulk/", TransactionBulkUpdateView.as_view(), name="transaction-bulk-update"),
    path("<str:transaction_id>/", TransactionDetailView.as_view(), name="transaction-detail"),
]
