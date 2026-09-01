from django.conf import settings
from django.http import Http404
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.review.e2e import reset_review_demo_data


class ReviewE2EResetView(APIView):
    """Reset mutable Review demo data only inside the explicitly enabled E2E backend process."""

    def post(self, request):
        # Keep the same default-off security boundary as the Transaction reset route. A normal local or
        # deployed application process must never expose a remotely callable demo-data reset endpoint.
        if not settings.E2E_TESTING:
            raise Http404

        return Response(reset_review_demo_data())
