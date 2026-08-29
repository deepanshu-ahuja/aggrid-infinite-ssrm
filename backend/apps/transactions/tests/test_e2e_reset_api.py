from django.test import override_settings
from rest_framework.test import APISimpleTestCase

from apps.transactions import services


class TransactionE2EResetApiTests(APISimpleTestCase):
    endpoint = "/api/transactions/__e2e__/reset/"

    def setUp(self):
        # Preserve the module-level object identity because the production/demo service does the same.
        self.original_rows = list(services.TRANSACTIONS)

    def tearDown(self):
        services.TRANSACTIONS.clear()
        services.TRANSACTIONS.extend(self.original_rows)

    def test_reset_route_is_not_available_in_normal_application_mode(self):
        response = self.client.post(self.endpoint, {}, format="json")
        self.assertEqual(response.status_code, 404)

    @override_settings(E2E_TESTING=True)
    def test_reset_restores_deterministic_demo_rows_after_mutation(self):
        services.TRANSACTIONS[0]["account"] = "Changed by earlier browser test"

        response = self.client.post(self.endpoint, {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"rowCount": 750})
        self.assertEqual(services.TRANSACTIONS[0]["id"], "txn-00001")
        self.assertEqual(services.TRANSACTIONS[0]["account"], "Operating")
        self.assertEqual(services.TRANSACTIONS[1]["interactionMode"], "selectionDisabled")
        self.assertEqual(services.TRANSACTIONS[3]["interactionMode"], "readOnly")
