from rest_framework.test import APISimpleTestCase


class TransactionQueryApiTests(APISimpleTestCase):
    endpoint = "/api/transactions/query/"

    def test_returns_a_page_and_both_dataset_counts(self):
        response = self.client.post(
            self.endpoint,
            {"offset": 0, "limit": 25, "sort": [], "filters": []},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["rows"]), 25)
        self.assertEqual(response.data["totalCount"], 750)
        self.assertEqual(response.data["filteredCount"], 750)
        self.assertTrue(
            all(
                row["interactionMode"]
                in ("enabled", "selectionDisabled", "readOnly")
                for row in response.data["rows"]
            )
        )

        rows_by_id = {row["id"]: row for row in response.data["rows"]}
        self.assertEqual(rows_by_id["txn-00001"]["interactionMode"], "enabled")
        self.assertIsNone(rows_by_id["txn-00001"]["interactionReason"])
        self.assertEqual(rows_by_id["txn-00002"]["interactionMode"], "selectionDisabled")
        self.assertIn("Pending Treasury", rows_by_id["txn-00002"]["interactionReason"])
        self.assertEqual(rows_by_id["txn-00004"]["interactionMode"], "readOnly")
        self.assertIn("Completed Settlement", rows_by_id["txn-00004"]["interactionReason"])

    def test_filters_using_backend_contract_not_ag_grid_payload(self):
        response = self.client.post(
            self.endpoint,
            {
                "offset": 0,
                "limit": 50,
                "sort": [{"field": "reference", "direction": "asc"}],
                "filters": [
                    {
                        "field": "status",
                        "operator": "equals",
                        "value": "Completed",
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(row["status"] == "Completed" for row in response.data["rows"]))
        self.assertTrue(
            all(
                row["interactionMode"]
                == ("readOnly" if row["account"] == "Settlement" else "enabled")
                for row in response.data["rows"]
            )
        )
        self.assertEqual(response.data["totalCount"], 750)
        self.assertEqual(response.data["filteredCount"], 250)

    def test_rejects_unknown_fields(self):
        response = self.client.post(
            self.endpoint,
            {
                "offset": 0,
                "limit": 10,
                "sort": [{"field": "dropTable", "direction": "asc"}],
                "filters": [],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)


class TransactionUpdateApiTests(APISimpleTestCase):
    def test_updates_one_transaction_and_returns_authoritative_row(self):
        response = self.client.patch(
            "/api/transactions/txn-00003/",
            {"account": "Updated Account", "amount": 1234.5},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["row"]["id"], "txn-00003")
        self.assertEqual(response.data["row"]["account"], "Updated Account")
        self.assertEqual(response.data["row"]["amount"], 1234.5)
        self.assertEqual(response.data["row"]["interactionMode"], "enabled")

    def test_selection_disabled_row_remains_directly_editable(self):
        response = self.client.patch(
            "/api/transactions/txn-00002/",
            {"amount": 4321.0},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["row"]["interactionMode"], "selectionDisabled")
        self.assertEqual(response.data["row"]["amount"], 4321.0)

    def test_allowed_edit_recomputes_interaction_policy(self):
        response = self.client.patch(
            "/api/transactions/txn-00008/",
            {"status": "Completed"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["row"]["interactionMode"], "readOnly")
        self.assertIn("Completed Settlement", response.data["row"]["interactionReason"])

    def test_read_only_row_rejects_direct_edit(self):
        response = self.client.patch(
            "/api/transactions/txn-00004/",
            {"account": "MUST-NOT-CHANGE"},
            format="json",
        )

        self.assertEqual(response.status_code, 409)

    def test_single_update_rejects_read_only_fields(self):
        response = self.client.patch(
            "/api/transactions/txn-00005/",
            {"reference": "SHOULD-NOT-CHANGE"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("reference", response.data)

    def test_single_update_rejects_empty_patch(self):
        response = self.client.patch(
            "/api/transactions/txn-00003/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_single_update_returns_not_found_for_unknown_id(self):
        response = self.client.patch(
            "/api/transactions/txn-missing/",
            {"account": "Updated Account"},
            format="json",
        )

        self.assertEqual(response.status_code, 404)

    def test_bulk_update_applies_multiple_row_patches(self):
        response = self.client.patch(
            "/api/transactions/bulk/",
            {
                "updates": [
                    {
                        "id": "txn-00005",
                        "changes": {"account": "Bulk A"},
                    },
                    {
                        "id": "txn-00006",
                        "changes": {"amount": 9876.5, "currency": "GBP"},
                    },
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updatedCount"], 2)
        self.assertEqual(
            [row["id"] for row in response.data["rows"]],
            ["txn-00005", "txn-00006"],
        )
        self.assertEqual(response.data["rows"][0]["account"], "Bulk A")
        self.assertEqual(response.data["rows"][1]["amount"], 9876.5)
        self.assertEqual(response.data["rows"][1]["currency"], "GBP")

    def test_bulk_update_rejects_duplicate_ids(self):
        response = self.client.patch(
            "/api/transactions/bulk/",
            {
                "updates": [
                    {"id": "txn-00008", "changes": {"account": "A"}},
                    {"id": "txn-00008", "changes": {"account": "B"}},
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_bulk_update_does_not_mutate_valid_rows_when_any_id_is_missing(self):
        before = self.client.post(
            "/api/transactions/query/",
            {
                "offset": 0,
                "limit": 10,
                "sort": [],
                "filters": [
                    {
                        "field": "reference",
                        "operator": "equals",
                        "value": "TRX-100008",
                    }
                ],
            },
            format="json",
        )
        original_account = before.data["rows"][0]["account"]

        response = self.client.patch(
            "/api/transactions/bulk/",
            {
                "updates": [
                    {
                        "id": "txn-00009",
                        "changes": {"account": "MUST-NOT-BE-SAVED"},
                    },
                    {
                        "id": "txn-missing",
                        "changes": {"account": "Missing"},
                    },
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 404)

        after = self.client.post(
            "/api/transactions/query/",
            {
                "offset": 0,
                "limit": 10,
                "sort": [],
                "filters": [
                    {
                        "field": "reference",
                        "operator": "equals",
                        "value": "TRX-100008",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(after.data["rows"][0]["account"], original_account)

    def test_bulk_update_is_atomic_when_any_row_is_read_only(self):
        before = self.client.post(
            "/api/transactions/query/",
            {
                "offset": 0,
                "limit": 10,
                "sort": [],
                "filters": [
                    {
                        "field": "reference",
                        "operator": "equals",
                        "value": "TRX-100007",
                    }
                ],
            },
            format="json",
        )
        original_account = before.data["rows"][0]["account"]

        response = self.client.patch(
            "/api/transactions/bulk/",
            {
                "updates": [
                    {
                        "id": "txn-00008",
                        "changes": {"account": "MUST-NOT-BE-SAVED"},
                    },
                    {
                        "id": "txn-00004",
                        "changes": {"account": "Read Only"},
                    },
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, 409)

        after = self.client.post(
            "/api/transactions/query/",
            {
                "offset": 0,
                "limit": 10,
                "sort": [],
                "filters": [
                    {
                        "field": "reference",
                        "operator": "equals",
                        "value": "TRX-100007",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(after.data["rows"][0]["account"], original_account)
