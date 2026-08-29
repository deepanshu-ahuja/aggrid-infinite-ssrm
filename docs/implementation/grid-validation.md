# Grid Validation

## Purpose

Grid validation is a shared frontend capability for validating editable field values without putting Transaction business rules into shared AG Grid code.

The current implementation separates three responsibilities:

```text
feature rule selection/messages
→ shared rule execution
→ shared validation error/state primitives
```

Backend validation remains authoritative for persisted writes. Frontend validation exists to give immediate, field-level feedback and to support edit/save guards as the capability is integrated with tracked editing.

## Current implementation layers

### 1. Shared validation engine

`frontend/src/shared/grid/validation/gridValidation.ts`

Owns domain-neutral validation contracts and state helpers:

- resolved rule shape (`key`, JSON-safe `params`, optional `message`);
- validator registry contract;
- execution of rules against one effective field value;
- normalized client/server validation error shape;
- stable row-ID + field validation state;
- queries for field, row and update-level validation errors.

This layer does not know Transaction fields, Transaction messages or backend serializer classes.

### 2. Default validator registry

`frontend/src/shared/grid/validation/defaultGridValidationRules.ts`

Owns executable frontend validator functions for the currently registered shared rule keys:

```text
required
maxLength
numberRange
```

Rules reference these validators by stable string key. Configuration supplies data only; it does not supply executable JavaScript or expressions.

### 3. Transaction validation configuration

`frontend/src/features/transactions/grid/transactionValidation.ts`

Owns the concrete Transaction field rules and user-facing messages.

The feature chooses which shared validators apply to each editable Transaction field, then delegates execution back to the shared engine.

This keeps business/domain choices out of `shared/grid` while still reusing one validation mechanism.

## How the files work together

For a Transaction field validation call, the current flow is:

```text
validateTransactionField(field, value)
        │
        ▼
TRANSACTION_VALIDATION_RULES[field]
(transactionValidation.ts)
        │
        ▼
validateGridValue(value, rules, registry)
(gridValidation.ts)
        │
        ├── looks up rule.key
        ▼
defaultGridValidatorRegistry[rule.key]
(defaultGridValidationRules.ts)
        │
        ▼
registered validator executes
        │
        ▼
GridValidationError[]
source = "client"
```

Example:

```text
field = account
value = ""

Transaction rules
→ required
→ maxLength { max: 100 }

validateGridValue(...)
→ required validator returns invalid
→ maxLength validator returns valid

result
→ [{ source: "client", ruleKey: "required", message: "Account is required." }]
```

The shared engine deliberately fails if a rule key is not present in the supplied registry:

```text
unknown rule key
→ throw "Unknown grid validation rule: ..."
```

That makes configuration mistakes visible rather than silently skipping required validation.

## Validation state model

Validation state is keyed by stable backend row ID and editable field, not by transient AG Grid `RowNode` identity:

```text
validationState[rowId][field]
→ one or more validation errors
```

Each error records:

```text
message
source = client | server
ruleKey?   // present for registered client rules when applicable
```

`gridValidation.ts` currently provides helpers to:

- set/replace a field's errors;
- remove a field entry automatically when it becomes valid;
- clear all validation errors for one row;
- query field-level and row-level invalid state;
- determine whether an explicit update payload contains an invalid field;
- normalize backend field messages into the same error shape with `source: "server"`.

This state shape is designed to remain valid across Client row-data replacement, Infinite cache recreation and SSRM store recreation because the durable key is the backend row ID.

## Current Transaction rules

The current frontend rules are:

| Field | Rules |
| --- | --- |
| `account` | required; maximum 100 characters |
| `amount` | numeric range 0 through 1,000,000 |
| `currency` | required; maximum 3 characters |
| `status` | required |

`status` is additionally constrained by the backend serializer's allowed choices.

## Backend authority

`backend/apps/transactions/api/serializers.py` enforces the persisted Transaction write contract.

The current backend constraints align with the concrete frontend rules for account, amount and currency, while DRF continues to own authoritative type/choice validation.

The two layers have different responsibilities:

```text
frontend validation
→ immediate field feedback and client-side mutation guards

backend validation
→ authoritative acceptance/rejection of persisted writes
```

A backend rejection must never be treated as impossible merely because frontend validation previously passed.

## Client and server errors use one shape

Client rules produce errors through `validateGridValue(...)`.

Backend field messages can be converted through `createServerGridValidationErrors(...)` so presentation and save-state logic can consume one field-error model without pretending a server error came from a frontend rule.

```text
client rule failure
→ source: "client"
→ optional ruleKey

backend serializer rejection
→ source: "server"
→ backend message
```

## Relationship to tracked editing

Tracked editing and validation are separate state concerns.

Tracked editing currently owns:

```text
BASE / LOCAL / REMOTE
changesById
originalsById
conflictsById
```

Validation owns whether the effective editable value is acceptable.

A field can therefore conceptually be dirty, invalid and/or conflicted independently. Validation must not be encoded as conflict state, and conflict state must not be inferred from validation errors.

The shared validation foundation is implemented now. Integration of this state with direct edits, current-page programmatic edits, Save/Discard, conflict resolution and concrete Client/Infinite/SSRM presentation is not yet complete in the current PR state and must not be inferred from the existence of the engine alone.

## Implementation entry points

```text
frontend/src/shared/grid/validation/gridValidation.ts
→ shared validation contracts, execution and stable error-state helpers

frontend/src/shared/grid/validation/defaultGridValidationRules.ts
→ registered domain-neutral executable validators

frontend/src/features/transactions/grid/transactionValidation.ts
→ Transaction-owned rule selection and messages

backend/apps/transactions/api/serializers.py
→ authoritative persisted-write validation
```

Focused tests currently live at:

```text
frontend/src/shared/grid/validation/gridValidation.test.ts
frontend/src/features/transactions/grid/transactionValidation.test.ts
backend/apps/transactions/tests/test_validation_api.py
```

## Verification expectations

The foundation tests verify:

1. registered rules execute through stable keys;
2. custom feature messages override default validator messages;
3. malformed rule parameters fail predictably;
4. unknown rule keys fail predictably;
5. validation state is stored by stable row ID + field;
6. valid correction removes stale field errors;
7. update-level invalid detection checks only fields actually present in the update;
8. backend messages normalize into server-sourced field errors;
9. Transaction concrete rules accept/reject representative values;
10. DRF enforces the corresponding authoritative write constraints.
