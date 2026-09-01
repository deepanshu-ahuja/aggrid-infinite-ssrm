from django.test import TestCase
from rest_framework.test import APIClient

from apps.review.services import FINANCE_ROWS, LOANS, _build_finance_rows, _build_loans


class ReviewEntityApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        # The demo source is mutable because Submit actions are real backend mutations. Reset it per
        # test so one action assertion cannot change later query expectations.
        LOANS[:] = _build_loans()
        FINANCE_ROWS[:] = _build_finance_rows()

    def test_loan_query_uses_standard_grid_contract(self):
        response = self.client.post(
            "/api/review/loans/query/",
            {
                "offset": 0,
                "limit": 5,
                "sort": [{"field": "principal", "direction": "desc"}],
                "filters": [{"field": "status", "operator": "equals", "value": "Active"}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload["rows"]), 5)
        self.assertEqual(payload["totalCount"], 180)
        self.assertTrue(payload["filteredCount"] > 5)
        self.assertTrue(all(row["status"] == "Active" for row in payload["rows"]))
        principals = [row["principal"] for row in payload["rows"]]
        self.assertEqual(principals, sorted(principals, reverse=True))

    def test_finance_search_uses_deliberately_different_wire_contract(self):
        response = self.client.post(
            "/api/review/finance/search/",
            {
                "window": {"from": 0, "size": 4},
                "orderBy": [{"attribute": "exposure", "descending": True}],
                "criteria": [{"attribute": "desk", "comparison": "eq", "operand": "Credit"}],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertNotIn("rows", payload)
        self.assertEqual(len(payload["records"]), 4)
        self.assertEqual(payload["counts"]["universe"], 210)
        self.assertTrue(all(row["desk"] == "Credit" for row in payload["records"]))
        exposures = [row["exposure"] for row in payload["records"]]
        self.assertEqual(exposures, sorted(exposures, reverse=True))

    def test_loan_and_finance_submit_actions_also_keep_independent_payload_shapes(self):
        loan_response = self.client.post(
            "/api/review/loans/submit/",
            {"selection": {"mode": "include", "ids": ["LN-1000"]}, "filters": []},
            format="json",
        )
        self.assertEqual(loan_response.status_code, 200)
        self.assertEqual(loan_response.json(), {"submittedCount": 1})
        self.assertEqual(LOANS[0]["status"], "Pending")

        finance_key = FINANCE_ROWS[0]["recordKey"]
        finance_response = self.client.post(
            "/api/review/finance/commands/submit/",
            {
                "command": "SUBMIT_REVIEW",
                "target": {"mode": "explicit", "keys": [finance_key]},
            },
            format="json",
        )
        self.assertEqual(finance_response.status_code, 200)
        self.assertEqual(finance_response.json()["outcome"]["accepted"], 1)
        self.assertIn("operationId", finance_response.json())
        self.assertEqual(FINANCE_ROWS[0]["reviewStatus"], "Submitted")
