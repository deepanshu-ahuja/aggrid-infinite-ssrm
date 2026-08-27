from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.transactions.services import (
    TransactionNotFoundError,
    bulk_update_transactions,
    query_transactions,
    update_transaction,
    update_transactions_by_selection,
)

from .serializers import (
    TransactionBulkUpdateSerializer,
    TransactionChangesSerializer,
    TransactionQuerySerializer,
    TransactionSelectionUpdateSerializer,
    TransactionSerializer,
)


class TransactionQueryView(APIView):
    def post(self, request):
        query_serializer = TransactionQuerySerializer(data=request.data)
        query_serializer.is_valid(raise_exception=True)

        result = query_transactions(query_serializer.validated_data)
        rows = TransactionSerializer(result["rows"], many=True).data

        return Response(
            {
                "rows": rows,
                "totalCount": result["totalCount"],
                "filteredCount": result["filteredCount"],
            }
        )


class TransactionDetailView(APIView):
    """Save one row patch. A future row-level Save button can call this endpoint directly."""

    def patch(self, request, transaction_id):
        changes_serializer = TransactionChangesSerializer(data=request.data)
        changes_serializer.is_valid(raise_exception=True)

        try:
            row = update_transaction(
                transaction_id,
                changes_serializer.validated_data,
            )
        except TransactionNotFoundError:
            return Response(
                {"detail": "Transaction not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({"row": TransactionSerializer(row).data})


class TransactionBulkUpdateView(APIView):
    """
    Save many explicit row patches in one request.

    The service resolves every id before applying changes, so a missing row rejects the operation
    before any valid row is mutated. That is the contract a future database implementation should
    preserve with a real transaction.
    """

    def patch(self, request):
        bulk_serializer = TransactionBulkUpdateSerializer(data=request.data)
        bulk_serializer.is_valid(raise_exception=True)

        try:
            rows = bulk_update_transactions(
                bulk_serializer.validated_data["updates"]
            )
        except TransactionNotFoundError:
            return Response(
                {"detail": "One or more transactions were not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serialized_rows = TransactionSerializer(rows, many=True).data
        return Response(
            {
                "rows": serialized_rows,
                "updatedCount": len(serialized_rows),
            }
        )


class TransactionSelectionUpdateView(APIView):
    """Apply one validated patch to the logical selection represented by the grid."""

    def patch(self, request):
        serializer = TransactionSelectionUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            updated_count = update_transactions_by_selection(
                data["selection"],
                data.get("filters", []),
                data["changes"],
            )
        except TransactionNotFoundError:
            # Only explicit/include selection resolves exact ids. Dataset-wide exclude selection can
            # safely ignore stale exception ids because they do not identify rows to mutate.
            return Response(
                {"detail": "One or more selected transactions were not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({"updatedCount": updated_count})
