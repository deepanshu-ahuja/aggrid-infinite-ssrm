import csv
from io import StringIO
from typing import Any, Dict, List

from rest_framework import serializers

from apps.transactions.services import list_transactions

from .serializers import TRANSACTION_EDITABLE_FIELDS, TransactionChangesSerializer


REQUIRED_ID_COLUMN = "id"
ALLOWED_IMPORT_COLUMNS = (REQUIRED_ID_COLUMN, *TRANSACTION_EDITABLE_FIELDS)


class TransactionImportRequestSerializer(serializers.Serializer):
    """Transport contract for the current CSV import workflow."""

    filename = serializers.CharField(max_length=255)
    content = serializers.CharField(allow_blank=False, max_length=1_000_000)

    def validate_filename(self, value):
        if not value.lower().endswith(".csv"):
            raise serializers.ValidationError("Only CSV files are supported.")
        return value


def _normalise_row_errors(detail: Any) -> Dict[str, List[str]]:
    if not isinstance(detail, dict):
        return {"row": [str(detail)]}

    result: Dict[str, List[str]] = {}
    for field, messages in detail.items():
        if isinstance(messages, (list, tuple)):
            result[str(field)] = [str(message) for message in messages]
        else:
            result[str(field)] = [str(messages)]
    return result


def validate_transaction_import_csv(content: str) -> Dict[str, Any]:
    """
    Parse and validate one update-only CSV without mutating authoritative Transactions.

    CSV is intentionally translated into the same explicit `{id, changes}` shape as ordinary bulk
    persistence. The import remains a separate workflow, but persisted field validation is reused from
    `TransactionChangesSerializer` so Import and cell editing cannot drift on writable values.
    """

    stream = StringIO(content.lstrip("\ufeff"))
    reader = csv.DictReader(stream)
    headers = reader.fieldnames
    file_errors: List[str] = []

    if not headers:
        return {"valid": False, "rowCount": 0, "updates": [], "errors": [{"row": None, "fields": {"file": ["CSV header row is required."]}}]}

    if len(headers) != len(set(headers)):
        file_errors.append("CSV headers must be unique.")

    unknown_headers = [header for header in headers if header not in ALLOWED_IMPORT_COLUMNS]
    if unknown_headers:
        file_errors.append(f"Unsupported columns: {', '.join(sorted(unknown_headers))}.")

    if REQUIRED_ID_COLUMN not in headers:
        file_errors.append("The id column is required.")

    editable_headers = [header for header in headers if header in TRANSACTION_EDITABLE_FIELDS]
    if not editable_headers:
        file_errors.append("At least one editable field column is required.")

    if file_errors:
        return {
            "valid": False,
            "rowCount": 0,
            "updates": [],
            "errors": [{"row": None, "fields": {"file": file_errors}}],
        }

    authoritative_by_id = {row["id"]: row for row in list_transactions()}
    seen_ids = set()
    updates = []
    errors = []

    for csv_row_number, raw_row in enumerate(reader, start=2):
        transaction_id = (raw_row.get(REQUIRED_ID_COLUMN) or "").strip()
        row_errors: Dict[str, List[str]] = {}

        if not transaction_id:
            row_errors[REQUIRED_ID_COLUMN] = ["Transaction id is required."]
        elif transaction_id in seen_ids:
            row_errors[REQUIRED_ID_COLUMN] = ["Each transaction id may appear only once in an import."]
        else:
            seen_ids.add(transaction_id)
            authoritative_row = authoritative_by_id.get(transaction_id)
            if authoritative_row is None:
                row_errors[REQUIRED_ID_COLUMN] = ["Transaction not found."]
            elif authoritative_row.get("interactionMode") == "readOnly":
                row_errors[REQUIRED_ID_COLUMN] = ["Transaction is read-only."]

        changes = {field: raw_row.get(field, "") for field in editable_headers}
        changes_serializer = TransactionChangesSerializer(data=changes)
        if not changes_serializer.is_valid():
            row_errors.update(_normalise_row_errors(changes_serializer.errors))

        if row_errors:
            errors.append({"row": csv_row_number, "id": transaction_id or None, "fields": row_errors})
            continue

        updates.append({"id": transaction_id, "changes": changes_serializer.validated_data})

    if not updates and not errors:
        errors.append({"row": None, "fields": {"file": ["CSV must contain at least one data row."]}})

    return {
        "valid": len(errors) == 0,
        "rowCount": len(updates) + len(errors),
        "updates": updates,
        "errors": errors,
    }
