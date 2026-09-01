from django.urls import path

from .e2e_views import ReviewE2EResetView
from .views import FinanceSearchView, FinanceSubmitView, LoanQueryView, LoanSubmitView


urlpatterns = [
    # Loan and Finance intentionally do not share one polymorphic endpoint. Their frontend entity
    # runtimes normalize different backend contracts into the common configurable-grid runtime shape.
    path("loans/query/", LoanQueryView.as_view(), name="review-loan-query"),
    path("loans/submit/", LoanSubmitView.as_view(), name="review-loan-submit"),
    path("finance/search/", FinanceSearchView.as_view(), name="review-finance-search"),
    path("finance/commands/submit/", FinanceSubmitView.as_view(), name="review-finance-submit"),
    # Playwright shares one no-reload Django process. The reset endpoint restores both mutable Review
    # datasets before every browser test and is unreachable unless settings.E2E_TESTING is enabled.
    path("__e2e__/reset/", ReviewE2EResetView.as_view(), name="review-e2e-reset"),
]
