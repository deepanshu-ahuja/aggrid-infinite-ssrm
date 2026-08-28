from rest_framework.test import APISimpleTestCase


class TransactionClientCollectionApiTests(APISimpleTestCase):
    endpoint = "/api/transactions/"

    def test_returns_complete_working_set_for_client_side_grid(self):
        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 750)
        self.assertEqual(response.data[0]["id"], "txn-00001")
        self.assertEqual(response.data[-1]["id"], "txn-00750")

        ids = [row["id"] for row in response.data]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(
            all(
                row["interactionMode"]
                in ("enabled", "selectionDisabled", "readOnly")
                for row in response.data
            )
        )

    def test_collection_does_not_require_server_grid_query_parameters(self):
        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)
        self.assertNotIn("totalCount", response.data[0])
        self.assertNotIn("filteredCount", response.data[0])
