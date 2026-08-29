from unittest.mock import patch

from rest_framework.test import APISimpleTestCase

from apps.transactions.services import _build_transactions


class TransactionValidationApiTests(APISimpleTestCase):
    def setUp(self):
        self.transactions_patch = patch(
            "apps.transactions.services.TRANSACTIONS",
            _build_transactions(),
        )
        self.transactions_patch.start()
        self.addCleanup(self.transactions_patch.stop)

    def test_single_update_returns_structured_field_errors(self):
        response = self.client.patch(
            "/api/transactions/txn-00003/",
            {"account": "", "amount": -1, "currency": "USDX"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("account", response.data)
        self.assertIn("amount", response.data)
        self.assertIn("currency", response.data)

    def test_single_update_rejects_amount_above_supported_range(self):
        response = self.client.patch(
            "/api/transactions/txn-00003/",
            {"amount": 1_000_000.01},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("amount", response.data)

    def test_single_update_accepts_valid_transaction_date(self):
        response = self.client.patch(
            "/api/transactions/txn-00003/",
            {"transactionDate": "2026-01-15"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["row"]["transactionDate"], "2026-01-15")

    def test_single_update_rejects_invalid_transaction_date(self):
        response = self.client.patch(
            "/api/transactions/txn-00003/",
            {"transactionDate": "not-a-date"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("transactionDate", response.data)

    def test_bulk_update_preserves_per_item_field_error_structure(self):
        response = self.client.patch(
            "/api/transactions/bulk/",
            {
                "updates": [
                    {"id": "txn-00005", "changes": {"account": "Valid"}},
                    {"id": "txn-00006", "changes": {"currency": "TOO-LONG"}},
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("updates", response.data)
        self.assertIn("currency", response.data["updates"][1]["changes"])
