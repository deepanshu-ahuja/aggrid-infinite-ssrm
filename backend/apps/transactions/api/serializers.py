from rest_framework import serializers


TRANSACTION_FIELDS = (
    "reference",
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


class TransactionSerializer(serializers.Serializer):
    id = serializers.CharField()
    reference = serializers.CharField()
    account = serializers.CharField()
    amount = serializers.FloatField()
    currency = serializers.CharField()
    status = serializers.CharField()
    transactionDate = serializers.DateField()
