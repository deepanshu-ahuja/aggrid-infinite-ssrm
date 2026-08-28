import csv
from io import StringIO
from unittest.mock import patch

from rest_framework.test import APISimpleTestCase


class TransactionSelectionExportApiTests(APISimpleTestCase):
    endpoint = "/api/transactions/selection/export/"

    def setUp(self):
        self.rows = [
            {
                "id": "txn-a",
                "reference": "TRX-A",
                "status": "Pending",
                "account": "Operating",
                "amount": 10,
                "currency": "USD",
                "transactionDate": "2026-08-01",
                "interactionMode": "enabled",
            },
            {
                "id": "txn-b",
                "reference": "TRX-B",
                "status": "Pending",
                "account": "Operating",
                "amount": 20,
                "currency": "USD",
                "transactionDate": "2026-08-02",
                "interactionMode": "selectionDisabled",
            },
            {
                "id": "txn-c",
                "reference": "TRX-C",
                "status": "Pending",
                "account": "Treasury",
                "amount": 30,
                "currency": "EUR",
                "transactionDate": "2026-08-03",
                "interactionMode": "enabled",
            },
        ]
        transactions_patch = patch("apps.transactions.services.TRANSACTIONS", self.rows)
        transactions_patch.start()
        self.addCleanup(transactions_patch.stop)

    @staticmethod
    def read_csv(response):
        # Export intentionally includes a UTF-8 BOM for spreadsheet compatibility; strip it before
        # parsing assertions so tests validate CSV values rather than the encoding marker.
        text = response.content.decode("utf-8-sig")
        return list(csv.DictReader(StringIO(text)))

    def test_exports_filtered_select_all_minus_exceptions_and_backend_disabled_rows(self):
        response = self.client.post(
            self.endpoint,
            {
                "selection": {"mode": "exclude", "ids": ["txn-c"]},
                "filters": [
                    {"field": "status", "operator": "equals", "value": "Pending"}
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertEqual(
            response["Content-Disposition"],
            'attachment; filename="transactions-selected.csv"',
        )
        # txn-b matches the filter but is selectionDisabled; txn-c is the explicit user exception.
        self.assertEqual([row["id"] for row in self.read_csv(response)], ["txn-a"])

    def test_exports_exact_include_ids_without_applying_visible_filters(self):
        response = self.client.post(
            self.endpoint,
            {
                "selection": {"mode": "include", "ids": ["txn-c"]},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in self.read_csv(response)], ["txn-c"])

    def test_rejects_filters_for_explicit_include_selection(self):
        response = self.client.post(
            self.endpoint,
            {
                "selection": {"mode": "include", "ids": ["txn-a"]},
                "filters": [
                    {"field": "status", "operator": "equals", "value": "Pending"}
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
