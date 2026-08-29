from django.conf import settings
from django.http import Http404
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.transactions.e2e import reset_transaction_demo_data


class TransactionE2EResetView(APIView):
    """
    Reset browser-test data only when the dedicated E2E backend mode is explicitly enabled.

    The route is intentionally unusable in normal local/production processes. Keeping the guard in
    the view means the default-off setting is checked at request time as well as documented in CI,
    which prevents a normal application server from becoming a remotely resettable data source.
    """

    def post(self, request):
        if not settings.E2E_TESTING:
            raise Http404

        return Response({"rowCount": reset_transaction_demo_data()})
