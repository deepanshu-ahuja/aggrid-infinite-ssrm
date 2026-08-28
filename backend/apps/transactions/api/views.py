import csv
from io import StringIO

from django.http import HttpResponse
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.transactions.services import (
    TransactionNotFoundError,
    TransactionReadOnlyError,
    bulk_update_transactions,
    query_transactions,
    resolve_transactions_by_selection,
    update_transaction,
    update_transactions_by_selection,
)

from .serializers import (
    TransactionBulkUpdateSerializer,
    TransactionChangesSerializer,
    TransactionQuerySerializer,
    TransactionSelectionTargetSerializer,
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
    """Save one row patch while keeping backend row-policy enforcement authoritative."""

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
        except TransactionReadOnlyError:
            return Response(
                {"detail": "Transaction is read-only."},
                status=status.HTTP_409_CONFLICT,
            )

        return Response({"row": TransactionSerializer(row).data})


class TransactionBulkUpdateView(APIView):
    """
    Save many explicit row patches in one request.

    The service resolves every id and validates row editability before applying changes, so a missing
    or read-only row rejects the operation before any valid row is mutated. A future database
    implementation should preserve that contract with a real transaction.
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
        except TransactionReadOnlyError:
            return Response(
                {"detail": "One or more transactions are read-only."},
                status=status.HTTP_409_CONFLICT,
            )

        serialized_rows = TransactionSerializer(rows, many=True).data
        return Response(
            {
                "rows": serialized_rows,
                "updatedCount": len(serialized_rows),
            }
        )


class TransactionSelectionUpdateView(APIView):
    """
    Apply one validated patch to backend-eligible rows in the grid's logical selection.

    The service resolves include/exclude/filter semantics through the same operation-neutral resolver
    used by selected export. This view therefore owns only HTTP validation/error mapping + mutation
    response shape; it does not implement a second interpretation of what "selected" means.
    """

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


class TransactionSelectionExportView(APIView):
    """
    Resolve the logical server-backed selection and return its eligible rows as CSV.

    This endpoint is intentionally backend-owned for Infinite/SSRM selected export. Dataset-wide
    selection may represent unloaded rows, so the browser must not fetch every selected record merely
    to construct a file. The same resolver used by selection mutation keeps export semantics aligned.
    """

    CSV_FIELDS = (
        "id",
        "reference",
        "account",
        "amount",
        "currency",
        "status",
        "transactionDate",
    )

    def post(self, request):
        serializer = TransactionSelectionTargetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            rows = resolve_transactions_by_selection(
                data["selection"],
                data.get("filters", []),
            )
        except TransactionNotFoundError:
            # Include mode names exact rows, so stale IDs are an invalid exact export target. Exclude
            # exception IDs never need resolving and therefore cannot trigger this branch.
            return Response(
                {"detail": "One or more selected transactions were not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Use Python's CSV writer rather than manual string concatenation so commas, quotes and newlines
        # in exported values remain standards-compliant without duplicating escaping rules.
        buffer = StringIO()
        writer = csv.DictWriter(buffer, fieldnames=self.CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

        # UTF-8 BOM helps spreadsheet applications detect the encoding without changing CSV values.
        response = HttpResponse(
            "\ufeff" + buffer.getvalue(),
            content_type="text/csv; charset=utf-8",
        )
        response["Content-Disposition"] = 'attachment; filename="transactions-selected.csv"'
        return response
