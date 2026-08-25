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
