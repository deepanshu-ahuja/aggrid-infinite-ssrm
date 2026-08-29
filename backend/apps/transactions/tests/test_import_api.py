from unittest.mock import patch

from rest_framework.test import APISimpleTestCase

from apps.transactions.services import _build_transactions, list_transactions


class TransactionImportApiTests(APISimpleTestCase):
    def setUp(self):
        self.transactions_patch = patch(
            "apps.transactions.services.TRANSACTIONS",
            _build_transactions(),
        )
        self.transactions_patch.start()
        self.addCleanup(self.transactions_patch.stop)

    def _payload(self, content):
        return {"filename": "transactions.csv", "content": content}

    def test_preview_validates_without_mutating(self):
        before = next(row for row in list_transactions() if row["id"] == "txn-00001")["account"]
        response = self.client.post(
            "/api/transactions/import/preview/",
            self._payload("id,account\ntxn-00001,Imported account\n"),
            format="json",
        )
        after = next(row for row in list_transactions() if row["id"] == "txn-00001")["account"]

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["valid"])
        self.assertEqual(response.data["rowCount"], 1)
        self.assertEqual(before, after)

    def test_apply_updates_only_after_complete_validation(self):
        response = self.client.post(
            "/api/transactions/import/apply/",
            self._payload(
                "id,account,status\n"
                "txn-00001,Imported account,Failed\n"
                "txn-00003,Another account,Completed\n"
            ),
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updatedCount"], 2)
        rows = {row["id"]: row for row in list_transactions()}
        self.assertEqual(rows["txn-00001"]["account"], "Imported account")
        self.assertEqual(rows["txn-00001"]["status"], "Failed")
        self.assertEqual(rows["txn-00003"]["account"], "Another account")

    def test_invalid_apply_is_atomic(self):
        original = {row["id"]: row["account"] for row in list_transactions() if row["id"] in {"txn-00001", "txn-00003"}}
        response = self.client.post(
            "/api/transactions/import/apply/",
            self._payload(
                "id,account\n"
                "txn-00001,Would change\n"
                "txn-00003,\n"
            ),
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["valid"])
        rows = {row["id"]: row["account"] for row in list_transactions() if row["id"] in original}
        self.assertEqual(rows, original)

    def test_preview_reports_duplicate_missing_and_read_only_targets(self):
        response = self.client.post(
            "/api/transactions/import/preview/",
            self._payload(
                "id,account\n"
                "txn-00001,First\n"
                "txn-00001,Duplicate\n"
                "txn-missing,Missing\n"
                "txn-00004,Locked\n"
            ),
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["valid"])
        self.assertEqual(len(response.data["errors"]), 3)
        self.assertIn("id", response.data["errors"][0]["fields"])
        self.assertIn("id", response.data["errors"][1]["fields"])
        self.assertIn("id", response.data["errors"][2]["fields"])

    def test_selection_disabled_row_remains_import_editable(self):
        response = self.client.post(
            "/api/transactions/import/apply/",
            self._payload("id,account\ntxn-00002,Individually editable\n"),
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        row = next(row for row in list_transactions() if row["id"] == "txn-00002")
        self.assertEqual(row["account"], "Individually editable")

    def test_preview_rejects_unknown_columns_and_non_csv_filename(self):
        response = self.client.post(
            "/api/transactions/import/preview/",
            self._payload("id,reference\ntxn-00001,NOPE\n"),
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["valid"])

        response = self.client.post(
            "/api/transactions/import/preview/",
            {"filename": "transactions.txt", "content": "id,account\ntxn-00001,X\n"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("filename", response.data)
