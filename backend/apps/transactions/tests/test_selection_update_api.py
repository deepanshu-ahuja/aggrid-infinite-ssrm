from unittest.mock import patch

from rest_framework.test import APISimpleTestCase


class TransactionSelectionUpdateApiTests(APISimpleTestCase):
    endpoint = "/api/transactions/selection/"

    def setUp(self):
        self.rows = [
            {"id": "txn-a", "status": "Pending", "account": "Operating"},
            {"id": "txn-b", "status": "Pending", "account": "Operating"},
            {"id": "txn-c", "status": "Pending", "account": "Treasury"},
            {"id": "txn-d", "status": "Completed", "account": "Operating"},
        ]
        self.transactions_patch = patch(
            "apps.transactions.services.TRANSACTIONS",
            self.rows,
        )
        self.transactions_patch.start()
        self.addCleanup(self.transactions_patch.stop)

    def test_updates_only_explicit_included_ids(self):
        response = self.client.patch(
            self.endpoint,
            {
                "selection": {
                    "mode": "include",
                    "ids": ["txn-a", "txn-c"],
                },
                "changes": {"status": "Failed"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updatedCount"], 2)
        self.assertEqual(
            [row["status"] for row in self.rows],
            ["Failed", "Pending", "Failed", "Completed"],
        )

    def test_explicit_selection_skips_rows_outside_backend_selection_universe(self):
        self.rows[1]["interactionMode"] = "selectionDisabled"
        self.rows[2]["interactionMode"] = "readOnly"

        response = self.client.patch(
            self.endpoint,
            {
                "selection": {
                    "mode": "include",
                    "ids": ["txn-a", "txn-b", "txn-c"],
                },
                "changes": {"status": "Failed"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updatedCount"], 1)
        self.assertEqual(
            [row["status"] for row in self.rows],
            ["Failed", "Pending", "Pending", "Completed"],
        )

    def test_updates_filtered_dataset_except_excluded_ids(self):
        response = self.client.patch(
            self.endpoint,
            {
                "selection": {
                    "mode": "exclude",
                    "ids": ["txn-b"],
                },
                "filters": [
                    {
                        "field": "account",
                        "operator": "equals",
                        "value": "Operating",
                    }
                ],
                "changes": {"status": "Failed"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updatedCount"], 2)
        self.assertEqual(
            [row["status"] for row in self.rows],
            ["Failed", "Pending", "Pending", "Failed"],
        )

    def test_select_all_filtered_skips_disabled_rows_without_frontend_exclusions(self):
        self.rows[1]["interactionMode"] = "selectionDisabled"
        self.rows[3]["interactionMode"] = "readOnly"

        response = self.client.patch(
            self.endpoint,
            {
                "selection": {
                    "mode": "exclude",
                    "ids": [],
                },
                "filters": [
                    {
                        "field": "account",
                        "operator": "equals",
                        "value": "Operating",
                    }
                ],
                "changes": {"status": "Failed"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updatedCount"], 1)
        self.assertEqual(
            [row["status"] for row in self.rows],
            ["Failed", "Pending", "Pending", "Completed"],
        )

    def test_updates_all_records_except_excluded_ids(self):
        response = self.client.patch(
            self.endpoint,
            {
                "selection": {
                    "mode": "exclude",
                    "ids": ["txn-c"],
                },
                "changes": {"status": "Failed"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updatedCount"], 3)
        self.assertEqual(
            [row["status"] for row in self.rows],
            ["Failed", "Failed", "Pending", "Failed"],
        )

    def test_select_all_records_skips_disabled_rows_without_frontend_exclusions(self):
        self.rows[1]["interactionMode"] = "selectionDisabled"
        self.rows[2]["interactionMode"] = "readOnly"

        response = self.client.patch(
            self.endpoint,
            {
                "selection": {
                    "mode": "exclude",
                    "ids": [],
                },
                "changes": {"status": "Failed"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updatedCount"], 2)
        self.assertEqual(
            [row["status"] for row in self.rows],
            ["Failed", "Pending", "Pending", "Failed"],
        )

    def test_rejects_filters_for_explicit_selection(self):
        response = self.client.patch(
            self.endpoint,
            {
                "selection": {
                    "mode": "include",
                    "ids": ["txn-a"],
                },
                "filters": [
                    {
                        "field": "status",
                        "operator": "equals",
                        "value": "Pending",
                    }
                ],
                "changes": {"status": "Failed"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_rejects_removed_scope_field_in_selection(self):
        response = self.client.patch(
            self.endpoint,
            {
                "selection": {
                    "scope": "all",
                    "mode": "exclude",
                    "ids": [],
                },
                "changes": {"status": "Failed"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("scope", response.data["selection"])
