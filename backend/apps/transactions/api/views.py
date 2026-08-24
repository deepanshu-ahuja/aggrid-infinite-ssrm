from rest_framework.response import Response
from rest_framework.views import APIView

from apps.transactions.services import query_transactions

from .serializers import TransactionQuerySerializer, TransactionSerializer


class TransactionQueryView(APIView):
    def post(self, request):
        query_serializer = TransactionQuerySerializer(data=request.data)
        query_serializer.is_valid(raise_exception=True)

        result = query_transactions(query_serializer.validated_data)
        rows = TransactionSerializer(result["rows"], many=True).data

        return Response({"rows": rows, "totalCount": result["totalCount"]})
