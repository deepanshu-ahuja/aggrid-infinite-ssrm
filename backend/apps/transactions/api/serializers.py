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
# identity/reference/interaction-policy fields must never become writable merely because they are present on a row.
TRANSACTION_EDITABLE_FIELDS = (
    "account",
    "amount",
    "currency",
    "status",
    "transactionDate",
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
    """Validated patch for one Transaction; identity/reference/interaction policy are not writable."""

    # Keep these authoritative constraints aligned with the static frontend Transaction validation rules.
    # Frontend validation improves editing UX; this serializer remains the security/data-integrity boundary.
    account = serializers.CharField(required=False, allow_blank=False, max_length=100)
    amount = serializers.FloatField(required=False, min_value=0, max_value=1_000_000)
    currency = serializers.CharField(required=False, allow_blank=False, max_length=3)
    status = serializers.ChoiceField(
        choices=("Completed", "Pending", "Failed"),
        required=False,
    )
    transactionDate = serializers.DateField(required=False)

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
    """
    Compact logical selection used by server-backed actions.

    The selection itself intentionally contains only `mode + ids`:

    - include + ids -> exactly those rows;
    - exclude + ids -> dataset-wide selection with those ids as USER exceptions.

    For exclude mode, the top-level operation filters decide which dataset is meant. Non-empty filters
    mean the filtered dataset; no filters means all records. A separate serialized `scope` would only
    duplicate information already present in the request.

    Business-disabled rows are deliberately NOT encoded here as exclude IDs. Selection eligibility is
    authoritative backend domain logic, while this serializer represents only the user's logical
    selection/deselection intent.
    """

    mode = serializers.ChoiceField(choices=("include", "exclude"))
    ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )

    def to_internal_value(self, data):
        # Reject old/unknown fields (especially the removed `scope`) rather than silently accepting a
        # request whose sender believes those fields still affect backend selection semantics.
        if isinstance(data, dict):
            unknown_fields = set(data) - set(self.fields)
            if unknown_fields:
                raise serializers.ValidationError(
                    {
                        field: ["Unknown selection field."]
                        for field in sorted(unknown_fields)
                    }
                )

        return super().to_internal_value(data)

    def validate_ids(self, ids):
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Selection ids must be unique.")
        return ids

    def validate(self, attrs):
        if attrs["mode"] == "include" and not attrs.get("ids", []):
            raise serializers.ValidationError(
                "Include selection requires at least one id."
            )
        return attrs


class TransactionSelectionTargetSerializer(serializers.Serializer):
    """
    Operation-neutral server-backed selection target.

    Both mutation and export inherit this validation so the same request always resolves the same
    logical row set. Adding another selected-row operation must not create a subtly different
    interpretation of include/exclude/filter semantics.
    """

    selection = TransactionSelectionSerializer()
    filters = TransactionFilterSerializer(many=True, required=False, default=list)

    def validate(self, attrs):
        selection = attrs["selection"]
        filters = attrs.get("filters", [])

        # Exact include ids are the whole selection, so visible filters must never constrain them.
        # Exclude mode uses non-empty filters for Select All Filtered and no filters for All Records.
        if selection["mode"] == "include" and filters:
            raise serializers.ValidationError(
                {"filters": "Filters are not valid for include selection."}
            )

        return attrs


class TransactionSelectionUpdateSerializer(TransactionSelectionTargetSerializer):
    # Mutation adds only the requested patch; selection/filter validation stays inherited above.
    changes = TransactionChangesSerializer()


class TransactionSerializer(serializers.Serializer):
    id = serializers.CharField()
    reference = serializers.CharField()
    account = serializers.CharField()
    amount = serializers.FloatField()
    currency = serializers.CharField()
    status = serializers.CharField()
    transactionDate = serializers.DateField()
    interactionMode = serializers.ChoiceField(
        choices=("enabled", "selectionDisabled", "readOnly")
    )
    interactionReason = serializers.CharField(allow_null=True, required=False)
