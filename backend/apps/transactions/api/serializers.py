from rest_framework import serializers


TRANSACTION_FIELDS = (
    "reference",
    "account",
    "amount",
    "currency",
    "status",
    "transactionDate",
)

# These are the only fields the current Transactions editing feature allows users to change.
# Keep this list aligned with the frontend `TRANSACTION_EDITABLE_FIELDS` configuration. Read-only
# identity/reference/date fields must never become writable merely because they are present on a row.
TRANSACTION_EDITABLE_FIELDS = (
    "account",
    "amount",
    "currency",
    "status",
)

FILTER_OPERATORS = (
    "contains",
    "equals",
    "notEqual",
    "startsWith",
    "endsWith",
    "greaterThan",
    "greaterThanOrEqual",
    "lessThan",
    "lessThanOrEqual",
)


class TransactionSortSerializer(serializers.Serializer):
    field = serializers.ChoiceField(choices=TRANSACTION_FIELDS)
    direction = serializers.ChoiceField(choices=("asc", "desc"))


class TransactionFilterSerializer(serializers.Serializer):
    field = serializers.ChoiceField(choices=TRANSACTION_FIELDS)
    operator = serializers.ChoiceField(choices=FILTER_OPERATORS)
    value = serializers.JSONField()

    def validate_value(self, value):
        if isinstance(value, bool) or not isinstance(value, (str, int, float)):
            raise serializers.ValidationError("Filter values must be strings or numbers.")
        return value


class TransactionQuerySerializer(serializers.Serializer):
    offset = serializers.IntegerField(min_value=0)
    limit = serializers.IntegerField(min_value=1, max_value=200)
    sort = TransactionSortSerializer(many=True, required=False, default=list)
    filters = TransactionFilterSerializer(many=True, required=False, default=list)


class TransactionChangesSerializer(serializers.Serializer):
    """Validated patch for one Transaction; identity/reference/date are intentionally not writable."""

    account = serializers.CharField(required=False, allow_blank=True)
    amount = serializers.FloatField(required=False)
    currency = serializers.CharField(required=False, allow_blank=True)
    status = serializers.ChoiceField(
        choices=("Completed", "Pending", "Failed"),
        required=False,
    )

    def to_internal_value(self, data):
        # DRF Serializers ignore undeclared input fields by default. For update requests that would be
        # dangerous because a caller could believe `id`, `reference` or another read-only field was
        # accepted. Reject unknown keys explicitly instead of silently dropping them.
        if isinstance(data, dict):
            unknown_fields = set(data) - set(self.fields)
            if unknown_fields:
                raise serializers.ValidationError(
                    {
                        field: ["This field is not editable."]
                        for field in sorted(unknown_fields)
                    }
                )

        return super().to_internal_value(data)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError(
                "At least one editable field must be supplied."
            )
        return attrs


class TransactionBulkUpdateItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    changes = TransactionChangesSerializer()


class TransactionBulkUpdateSerializer(serializers.Serializer):
    updates = TransactionBulkUpdateItemSerializer(many=True, allow_empty=False)

    def validate_updates(self, updates):
        ids = [item["id"] for item in updates]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError(
                "Each transaction id may appear only once in a bulk update."
            )
        return updates


class TransactionSelectionSerializer(serializers.Serializer):
    """Logical server-backed selection used by actions above the grid."""

    scope = serializers.ChoiceField(choices=("explicit", "filtered", "all"))
    mode = serializers.ChoiceField(choices=("include", "exclude"))
    ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )

    def validate_ids(self, ids):
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Selection ids must be unique.")
        return ids

    def validate(self, attrs):
        scope = attrs["scope"]
        mode = attrs["mode"]
        ids = attrs.get("ids", [])

        # Explicit/manual/current-page selection already knows every selected id. Dataset-wide
        # selection is the opposite representation: everything in that scope except the listed ids.
        if scope == "explicit":
            if mode != "include":
                raise serializers.ValidationError(
                    "Explicit selection must use include mode."
                )
            if not ids:
                raise serializers.ValidationError(
                    "Explicit selection requires at least one id."
                )
        elif mode != "exclude":
            raise serializers.ValidationError(
                "Filtered and all-record selection must use exclude mode."
            )

        return attrs


class TransactionSelectionUpdateSerializer(serializers.Serializer):
    selection = TransactionSelectionSerializer()
    filters = TransactionFilterSerializer(many=True, required=False, default=list)
    changes = TransactionChangesSerializer()

    def validate(self, attrs):
        scope = attrs["selection"]["scope"]
        filters = attrs.get("filters", [])

        # Filters define the dataset only for Select All Filtered. Explicit ids remain exact even if
        # the user changes filters before acting, and Select All Records is intentionally filter-free.
        if scope != "filtered" and filters:
            raise serializers.ValidationError(
                {"filters": "Filters are only valid for filtered selection."}
            )

        return attrs


class TransactionSerializer(serializers.Serializer):
    id = serializers.CharField()
    reference = serializers.CharField()
    account = serializers.CharField()
    amount = serializers.FloatField()
    currency = serializers.CharField()
    status = serializers.CharField()
    transactionDate = serializers.DateField()
