# GRIDCAP-ROWMODEL-CLIENT | GRIDCAP-DATA-LOAD
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.transactions.services import list_transactions

from .serializers import TransactionSerializer


class TransactionCollectionView(APIView):
    """
    Return the complete Transaction working set for Client-Side Row Model consumers.

    The Client-Side grid deliberately fetches the bounded dataset once, then AG Grid owns local
    sorting, filtering, pagination and selection. Keep that contract separate from `TransactionQueryView`,
    whose request model exists for server-backed Infinite/SSRM block loading.
    """

    def get(self, request):
        rows = list_transactions()
        return Response(TransactionSerializer(rows, many=True).data)
