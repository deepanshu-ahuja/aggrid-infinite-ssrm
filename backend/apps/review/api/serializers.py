from rest_framework import serializers


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
LOAN_FIELDS = (
    "borrower",
    "principal",
    "currency",
    "status",
    "originationDate",
    "internalScore",
    "region",
)
FINANCE_FIELDS = (
    "facility",
    "counterparty",
    "exposure",
    "currency",
    "desk",
    "reviewStatus",
    "utilizationPct",
    "nextReviewDate",
)
FINANCE_COMPARISONS = ("has", "eq", "neq", "prefix", "suffix", "gt", "gte", "lt", "lte")


class PrimitiveFilterValueField(serializers.JSONField):
    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        if isinstance(value, bool) or not isinstance(value, (str, int, float)):
            raise serializers.ValidationError("Filter values must be strings or numbers.")
        return value


class LoanSortSerializer(serializers.Serializer):
    field = serializers.ChoiceField(choices=LOAN_FIELDS)
    direction = serializers.ChoiceField(choices=("asc", "desc"))


class LoanFilterSerializer(serializers.Serializer):
    field = serializers.ChoiceField(choices=LOAN_FIELDS)
    operator = serializers.ChoiceField(choices=FILTER_OPERATORS)
    value = PrimitiveFilterValueField()


class LoanQuerySerializer(serializers.Serializer):
    # Loan intentionally follows the repository's standard GridListRequest-like API vocabulary.
    offset = serializers.IntegerField(min_value=0)
    limit = serializers.IntegerField(min_value=1, max_value=200)
    sort = LoanSortSerializer(many=True, required=False, default=list)
    filters = LoanFilterSerializer(many=True, required=False, default=list)


class LogicalSelectionSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=("include", "exclude"))
    ids = serializers.ListField(child=serializers.CharField(), required=False, default=list)

    def validate_ids(self, ids):
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Selection ids must be unique.")
        return ids

    def validate(self, attrs):
        if attrs["mode"] == "include" and not attrs.get("ids"):
            raise serializers.ValidationError("Include selection requires at least one id.")
        return attrs


class LoanSubmitSerializer(serializers.Serializer):
    selection = LogicalSelectionSerializer()
    filters = LoanFilterSerializer(many=True, required=False, default=list)

    def validate(self, attrs):
        if attrs["selection"]["mode"] == "include" and attrs.get("filters"):
            raise serializers.ValidationError({"filters": "Exact IDs must not be constrained by filters."})
        return attrs


class FinanceWindowSerializer(serializers.Serializer):
    # Finance deliberately uses different names and nesting from the Loan/Transaction query contract.
    from_ = serializers.IntegerField(source="from", min_value=0)
    size = serializers.IntegerField(min_value=1, max_value=200)


class FinanceOrderSerializer(serializers.Serializer):
    attribute = serializers.ChoiceField(choices=FINANCE_FIELDS)
    descending = serializers.BooleanField()


class FinanceCriterionSerializer(serializers.Serializer):
    attribute = serializers.ChoiceField(choices=FINANCE_FIELDS)
    comparison = serializers.ChoiceField(choices=FINANCE_COMPARISONS)
    operand = PrimitiveFilterValueField()


class FinanceSearchSerializer(serializers.Serializer):
    window = FinanceWindowSerializer()
    orderBy = FinanceOrderSerializer(many=True, required=False, default=list)
    criteria = FinanceCriterionSerializer(many=True, required=False, default=list)


class FinanceSubmitTargetSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=("explicit", "all"))
    keys = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    exceptKeys = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    criteria = FinanceCriterionSerializer(many=True, required=False, default=list)

    def validate(self, attrs):
        mode = attrs["mode"]
        keys = attrs.get("keys", [])
        except_keys = attrs.get("exceptKeys", [])
        criteria = attrs.get("criteria", [])

        if mode == "explicit":
            if not keys:
                raise serializers.ValidationError({"keys": "Explicit Finance target requires keys."})
            if except_keys or criteria:
                raise serializers.ValidationError("Explicit Finance target cannot include exclusions/criteria.")
        elif keys:
            raise serializers.ValidationError({"keys": "All-mode Finance target uses exceptKeys instead."})

        if len(keys) != len(set(keys)) or len(except_keys) != len(set(except_keys)):
            raise serializers.ValidationError("Finance target keys must be unique.")
        return attrs


class FinanceSubmitSerializer(serializers.Serializer):
    target = FinanceSubmitTargetSerializer()
    command = serializers.ChoiceField(choices=("SUBMIT_REVIEW",))
