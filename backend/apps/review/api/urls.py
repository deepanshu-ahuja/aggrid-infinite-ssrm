from django.urls import path

from .views import FinanceSearchView, FinanceSubmitView, LoanQueryView, LoanSubmitView


urlpatterns = [
    # Loan and Finance intentionally do not share one polymorphic endpoint. Their frontend entity
    # runtimes normalize different backend contracts into the common configurable-grid runtime shape.
    path("loans/query/", LoanQueryView.as_view(), name="review-loan-query"),
    path("loans/submit/", LoanSubmitView.as_view(), name="review-loan-submit"),
    path("finance/search/", FinanceSearchView.as_view(), name="review-finance-search"),
    path("finance/commands/submit/", FinanceSubmitView.as_view(), name="review-finance-submit"),
]
