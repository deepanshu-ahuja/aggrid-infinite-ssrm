from django.test import override_settings
from rest_framework.test import APISimpleTestCase

from apps.review import services


class ReviewE2EResetApiTests(APISimpleTestCase):
    endpoint = "/api/review/__e2e__/reset/"

    def setUp(self):
        # Preserve list identity because production/demo services mutate these authoritative lists in
        # place and the E2E reset contract deliberately guarantees the same identity after reset.
        self.original_loans = list(services.LOANS)
        self.original_finance_rows = list(services.FINANCE_ROWS)

    def tearDown(self):
        services.LOANS.clear()
        services.LOANS.extend(self.original_loans)
        services.FINANCE_ROWS.clear()
        services.FINANCE_ROWS.extend(self.original_finance_rows)

    def test_reset_route_is_not_available_in_normal_application_mode(self):
        response = self.client.post(self.endpoint, {}, format="json")
        self.assertEqual(response.status_code, 404)

    @override_settings(E2E_TESTING=True)
    def test_reset_restores_both_review_sources_after_mutation(self):
        services.LOANS[0]["borrower"] = "Changed by earlier browser test"
        services.LOANS[1]["status"] = "Closed"
        services.FINANCE_ROWS[0]["counterparty"] = "Changed counterparty"
        services.FINANCE_ROWS[1]["reviewStatus"] = "Escalated"

        response = self.client.post(self.endpoint, {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            {"loanRowCount": 180, "financeRowCount": 210},
        )
        self.assertEqual(services.LOANS[0]["id"], "LN-1000")
        self.assertEqual(services.LOANS[0]["borrower"], "Borrower 001")
        self.assertEqual(services.LOANS[1]["status"], "Pending")
        self.assertEqual(services.FINANCE_ROWS[0]["recordKey"], "FIN-5000")
        self.assertEqual(services.FINANCE_ROWS[0]["counterparty"], "Counterparty 00")
        self.assertEqual(services.FINANCE_ROWS[1]["reviewStatus"], "Submitted")
