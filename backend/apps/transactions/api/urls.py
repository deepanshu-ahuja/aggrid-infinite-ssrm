from django.urls import path

from .views import TransactionQueryView


urlpatterns = [
    path("query/", TransactionQueryView.as_view(), name="transaction-query"),
]
