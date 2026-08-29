# Grid Validation

## Purpose

Grid validation is a first-class editing capability shared across Client, Infinite and SSRM.

It validates effective editable values without moving Transaction business rules into shared AG Grid code.

Backend validation remains authoritative for persisted writes. Frontend validation provides immediate field feedback, stable validation state, and Save guards while keeping invalid LOCAL edits visible and dirty.

## Ownership and call chain

```text
┌─────────────────────────────────────────────────────────────┐
│ transactionValidation.ts                                    │
│ Transaction-owned rule selection + messages                 │
│                                                             │
│ validateTransactionField(field, value)                      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ resolved rules + value
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ gridValidation.ts                                           │
│ Shared rule execution + stable validation-state helpers     │
│                                                             │
│ validateGridValue(value, rules, registry)                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ lookup rule.key
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ defaultGridValidationRules.ts                               │
│ Registered executable validators                            │
│                                                             │
│ required | maxLength | numberRange                          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ valid / invalid
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ GridValidationError[]                                       │
│ normalized client field result                              │
└─────────────────────────────────────────────────────────────┘
```

The dependency direction is intentional:

```text
Transaction feature
→ chooses rule keys, params and messages
→ shared validation engine executes them
→ frontend registry owns executable validator functions
```

`shared/grid` never imports Transaction validation rules.

## Rule data versus executable code

Rules are data:

```text
{
  key: "maxLength",
  params: { max: 100 },
  message: "Account must be 100 characters or fewer."
}
```

Executable validation stays in the frontend registry:

```text
"maxLength"
→ defaultGridValidatorRegistry.maxLength
```

Unknown rule keys fail predictably rather than being ignored.

No arbitrary executable JavaScript or expression is accepted from backend/configuration.

## Current Transaction rules

| Field | Rules |
| --- | --- |
| `account` | required; maximum 100 characters |
| `amount` | numeric range 0 through 1,000,000 |
| `currency` | required; maximum 3 characters |
| `status` | required |

The backend additionally enforces the allowed `status` choices.

## Stable validation state

Validation state is separate from tracked edit/conflict state and is keyed by stable backend row ID + editable field:

```text
validationState[rowId][field]
→ GridValidationError[]
```

Each error records:

```text
message
source = client | server
ruleKey?   // present for registered client-rule failures
```

This state does not depend on RowNode identity, so it survives the row recreation mechanics of all three row models.

```text
Client
→ authoritative rowData objects can be replaced

Infinite
→ cache blocks / RowNodes can be recreated or evicted

SSRM
→ server-side store rows / RowNodes can be recreated
```

## Editing integration

`useTrackedGridEditing()` coordinates validation because it already owns every lifecycle that creates, replaces or removes an effective LOCAL value.

Validation state remains separate; the hook only coordinates when it must be updated.

```text
AG Grid direct edit
        │
        ▼
record LOCAL dirty value
        │
        ├───────────────┐
        ▼               ▼
tracked edit state   validateTransactionField(...)
                        │
                        ▼
                 validationState[rowId][field]
```

### Direct cell editing

A committed direct edit:

```text
cellValueChanged
→ record LOCAL edit
→ validate the new effective value
→ keep LOCAL visible whether valid or invalid
```

Invalid LOCAL input is not reverted automatically.

### Programmatic current-page editing

Current-page edit helpers use the same lifecycle:

```text
applyChangesToNodes(...)
→ record LOCAL edits
→ run the same feature validator for every changed field
→ write the values into the concrete RowNodes
```

Programmatic edit flows therefore cannot bypass validation semantics.

## Invalid LOCAL behavior

```text
invalid LOCAL value
→ stays visible
→ stays dirty
→ field gets validation error state
→ user can continue editing the field
→ relevant Save is blocked
```

Validation does not disable the editor because correction must remain possible in place.

## Save guards

### Row Save

Row Save is blocked when the dirty row has either:

```text
unresolved conflict
OR
validation error
```

The row Save button is disabled and explains the blocking condition.

### Save Selected Edits

Save Selected still targets exactly:

```text
accumulated dirty rows
        ∩
current logical selection
```

Validation checks only the fields in that exact update payload.

```text
selected dirty target contains invalid field
→ block the whole Save Selected request

unselected invalid dirty row exists elsewhere
→ does not block Save Selected
```

Conflicted rows are handled independently by the existing conflict guard.

## Correction, revert and Discard

### Correction

Editing a field again immediately re-runs feature validation.

```text
server/client error exists
→ user changes LOCAL value
→ validate new LOCAL value
→ old field errors are replaced
```

A valid correction removes the field validation entry.

### Manual revert to BASE

When a field returns to BASE, tracked editing removes the LOCAL draft. The validation pass on the reverted value clears stale errors as well.

### Server convergence

When genuinely fresh authoritative data arrives:

```text
REMOTE == LOCAL
→ tracked draft auto-cleans
→ field validation state clears
```

This also handles the case where that field was the row's last dirty field and the entire row draft entry disappears.

### Discard

```text
Discard row / selected rows
→ restore BASE or latest REMOTE
→ remove LOCAL draft
→ remove validation state for discarded work
```

## Conflict relationship

Conflict and validation answer different questions:

```text
Validation
→ is the effective LOCAL value acceptable?

Conflict
→ did REMOTE diverge from BASE while LOCAL exists?
```

A field may therefore be:

```text
valid + no conflict
invalid + no conflict
valid + conflict
invalid + conflict
```

### Use server

`Use server` removes LOCAL for the conflicted field, so validation for that discarded LOCAL value is cleared.

### Keep my edit

`Keep my edit` keeps LOCAL while rebasing BASE to REMOTE. The retained LOCAL value is revalidated so stale backend errors are replaced by the current client rule result.

## Backend validation mapping

`backend/apps/transactions/api/serializers.py` remains authoritative for persisted writes.

Single-row DRF field errors:

```text
PATCH /api/transactions/{id}/
→ { account: ["..."], amount: ["..."] }
```

Bulk DRF field errors preserve update-array positions:

```text
PATCH /api/transactions/bulk/
→ updates[index].changes[field]
```

`mapTransactionServerValidationErrors(...)` translates those response shapes back to stable submitted row IDs.

```text
ApiError.details
        │
        ▼
mapTransactionServerValidationErrors(...)
        │
        ▼
rowId + field + backend messages
        │
        ▼
setServerValidationErrors(...)
        │
        ▼
validationState[rowId][field]
source = "server"
```

A rejected backend write does not acknowledge tracked changes, so the rejected LOCAL value remains visible and dirty.

## Cell presentation

Editable Transaction cells query the same root-provided validation state used by Save guards.

```text
invalid field
→ validation-error cell class
→ error tooltip/message

conflicted field
→ conflict class + conflict resolver

invalid + conflicted
→ both classes remain active
→ combined presentation preserves both meanings
```

Validation styling never becomes a second source of truth; it is presentation derived from React-owned stable validation state.

## Row-model behavior

The validation semantics are shared, but each concrete root keeps its own AG Grid lifecycle visible.

### Client

```text
direct/programmatic edit
→ shared tracked-edit + validation state
→ Row Save / Save Selected guards
→ successful PATCH returns authoritative rows
→ Client query cache receives authoritative rows
→ rowData replacement reconciles remaining LOCAL work
```

### Infinite

```text
direct/programmatic edit
→ shared tracked-edit + validation state
→ Row Save / Save Selected guards
→ successful PATCH
→ refreshInfiniteCache()
→ recreated rows reconcile remaining LOCAL work
```

### SSRM

```text
direct/programmatic edit
→ shared tracked-edit + validation state
→ Row Save / Save Selected guards
→ successful PATCH
→ refreshServerSide()
→ refreshed store rows reconcile remaining LOCAL work
```

There is no universal grid root or row-model switch introduced for validation.

## Implementation entry points

```text
frontend/src/shared/grid/validation/gridValidation.ts
→ rule contracts, execution and stable validation-state helpers

frontend/src/shared/grid/validation/defaultGridValidationRules.ts
→ registered domain-neutral executable validators

frontend/src/shared/grid/editing/useTrackedGridEditing.ts
→ validation lifecycle coordination with LOCAL edit creation/removal

frontend/src/features/transactions/grid/transactionValidation.ts
→ Transaction rules/messages + DRF field-error mapping

frontend/src/features/transactions/grid/useTransactionEditPersistence.ts
→ maps backend 400 field errors into validation state

frontend/src/features/transactions/grid/transactionColumns.tsx
→ validation/conflict cell presentation

frontend/src/features/transactions/grid/TransactionRowEditActions.tsx
→ Row Save validation/conflict guard

frontend/src/features/transactions/grid/TransactionEditingControls.tsx
→ selected-save validation/conflict presentation

frontend/src/features/transactions/grid/TransactionsClientGrid.tsx
frontend/src/features/transactions/grid/TransactionsInfiniteGrid.tsx
frontend/src/features/transactions/grid/TransactionsSsrmGrid.tsx
→ concrete row-model integration and exact Save Selected guards

backend/apps/transactions/api/serializers.py
→ authoritative persisted-write validation
```

## Verification coverage

Focused automated coverage verifies:

1. registered rule execution and unknown-key failure;
2. malformed rule parameter failure;
3. Transaction required/length/range rules;
4. stable row-ID/field validation state queries;
5. direct invalid LOCAL edit remains dirty and invalid;
6. valid correction clears stale errors;
7. programmatic current-page edits use the same validation rules;
8. Discard removes validation state;
9. server error messages use the same field-state model;
10. single and bulk DRF error shapes map back to submitted row IDs;
11. `Use server` clears validation for the discarded LOCAL field;
12. fresh REMOTE convergence clears validation when LOCAL auto-cleans;
13. backend serializers enforce authoritative Transaction constraints;
14. Row Save and exact Save Selected targets are guarded by validation state in Client, Infinite and SSRM roots.

Manual/browser verification has not been claimed unless separately recorded in the testing documentation.
