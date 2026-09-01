from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.review.services import query_loans, search_finance, submit_finance, submit_loans
from .serializers import (
    FinanceSearchSerializer,
    FinanceSubmitSerializer,
    LoanQuerySerializer,
    LoanSubmitSerializer,
)


class LoanQueryView(APIView):
    def post(self, request):
        serializer = LoanQuerySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(query_loans(serializer.validated_data))


class LoanSubmitView(APIView):
    def post(self, request):
        serializer = LoanSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = submit_loans(serializer.validated_data)
        except LookupError as error:
            return Response(
                {"detail": f"Unknown Loan id: {error.args[0]}"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(result)


class FinanceSearchView(APIView):
    def post(self, request):
        serializer = FinanceSearchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(search_finance(serializer.validated_data))


class FinanceSubmitView(APIView):
    def post(self, request):
        serializer = FinanceSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = submit_finance(serializer.validated_data)
        except LookupError as error:
            return Response(
                {"detail": f"Unknown Finance record key: {error.args[0]}"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(result)
