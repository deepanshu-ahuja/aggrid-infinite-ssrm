from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.transactions.services import bulk_update_transactions

from .import_csv import TransactionImportRequestSerializer, validate_transaction_import_csv


def _public_import_result(result):
    """Do not expose backend-internal validated update objects in the preview/apply response."""

    return {
        "valid": result["valid"],
        "rowCount": result["rowCount"],
        "errors": result["errors"],
    }


class TransactionImportPreviewView(APIView):
    """Validate an update-only Transaction CSV without mutating authoritative data."""

    def post(self, request):
        request_serializer = TransactionImportRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)

        result = validate_transaction_import_csv(request_serializer.validated_data["content"])
        return Response(_public_import_result(result))


class TransactionImportApplyView(APIView):
    """
    Revalidate and atomically apply an update-only Transaction CSV.

    Apply never trusts a previous browser preview. Re-parsing at the mutation boundary means the
    backend remains authoritative even if the uploaded text or Transaction policy changed meanwhile.
    The current in-memory bulk service resolves every target before mutation; a future database-backed
    implementation must preserve the same all-or-nothing contract with a real transaction.
    """

    def post(self, request):
        request_serializer = TransactionImportRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)

        result = validate_transaction_import_csv(request_serializer.validated_data["content"])
        if not result["valid"]:
            return Response(_public_import_result(result), status=status.HTTP_400_BAD_REQUEST)

        rows = bulk_update_transactions(result["updates"])
        return Response({"updatedCount": len(rows)})
