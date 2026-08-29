# Transaction Editing

## Native-first ownership

Each concrete grid root owns its rendered `<AgGridReact>` and authoritative `GridApi`:

```text
TransactionsClientGrid
TransactionsInfiniteGrid
TransactionsSsrmGrid
```

Shared editing behavior receives the root-owned API where it needs AG Grid operations. It does not own another GridApi or recreate native grid state.

## Editable fields

Transactions currently exposes five persisted editable fields:

```text
account
amount
currency
status
transactionDate
```

The feature owns the editable field list, field access, row-editability rules, editor choice, validation rule selection and user-facing validation messages.

Shared grid code owns how committed edits are tracked, reconciled and coordinated with validation state.

Current editor examples deliberately demonstrate more than one AG Grid integration style:

```text
Account
→ custom MUI TextField popup editor
→ exact validation helper text is visible beside the input while editing

Amount
→ native AG Grid number editor

Currency
→ native AG Grid text editing

Status
→ custom MUI Select editor

Transaction date
→ custom MUI date-input popup editor
→ browser date picker + exact validation helper text
```

The MUI editors are examples of feature-owned executable UI. They do not justify wrapping every AG Grid editor in a universal abstraction.

## End-to-end editing flow

```text
                         ┌───────────────────────────┐
                         │ User / programmatic edit  │
                         └─────────────┬─────────────┘
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │ useTrackedGridEditing     │
                         │ records LOCAL draft       │
                         └─────────────┬─────────────┘
                                       │
                       ┌───────────────┴────────────────┐
                       │                                │
                       ▼                                ▼
          BASE / LOCAL / REMOTE state       Transaction validation rules
          dirty + conflict tracking         validate effective LOCAL value
                       │                                │
                       └───────────────┬────────────────┘
                                       ▼
                            Cell / editor presentation
                                       │
                         ┌─────────────┴─────────────┐
                         │                           │
                         ▼                           ▼
                      Discard                      Save
                         │                           │
             restore BASE / REMOTE        guard conflict + validation
                         │                           │
              clear LOCAL + errors                  ▼
                                             PATCH backend
                                                    │
                               ┌────────────────────┴───────────────────┐
                               │                                        │
                               ▼                                        ▼
                            success                                  400 field errors
                               │                                        │
                      acknowledge exact value                 keep LOCAL dirty/visible
                               │                              map errors to rowId + field
                               ▼                                        │
                    authoritative refresh                              ▼
                               │                              validationState update
                               ▼
                 reconcile remaining LOCAL work
```

Editing, conflict state and validation state participate in one lifecycle but remain distinct state concerns.

## Durable editing state

Unsaved editing state is application-owned and keyed by stable backend row ID rather than RowNode identity.

```text
changesById
→ current LOCAL unsaved values

originalsById
→ BASE values captured when a field first became dirty

conflictsById
→ latest REMOTE values for unresolved field conflicts
```

Validation is stored separately:

```text
validationState[rowId][field]
→ client or server validation errors for the effective LOCAL field value
```

This stable-ID ownership is used across all three row models because authoritative row objects can be replaced:

- Client receives new editable `rowData` objects after authoritative TanStack Query data changes;
- Infinite can recreate/evict RowNodes as cache blocks change;
- SSRM can recreate RowNodes/store data during refresh.

## Draft values versus persisted values

The authoritative Transaction/API shape remains strict:

```text
amount          → finite number
transactionDate → ISO calendar date string
```

The LOCAL draft layer additionally permits `null` for a deliberately cleared editor value.

That distinction is required because validation intentionally keeps invalid LOCAL work visible:

```text
user clears Amount or Transaction date
→ LOCAL draft = null
→ draft remains visible/dirty
→ validation records the field error
→ Save is blocked
→ user may correct or Discard
```

The persistence mapper never sends those invalid draft-only values. A valid save must first pass validation and then be converted back to the strict API patch shape.

## Direct cell editing

AG Grid's committed `cellValueChanged` event is the boundary for recording a direct user edit.

A user can edit a row without selecting it.

```text
BASE value
→ user commits different LOCAL value
→ field/row becomes dirty
→ effective LOCAL value is validated

invalid LOCAL
→ remains visible
→ remains dirty
→ exact field error is available from the field/editor presentation
→ editor remains available for correction

LOCAL returned to BASE
→ field draft clears
→ validation clears
→ row becomes clean when no other dirty fields remain
```

Programmatic writes performed by the editing engine are marked/guarded so AG Grid events caused by our own `setDataValue(...)` calls are not recorded again as fake user edits.

## Field-specific validation presentation

A red/invalid cell is not intended to be the only explanation of an error.

Current field-specific presentation is:

```text
MUI Account editor
→ helper text such as "Account is required."

MUI Transaction date editor
→ helper text such as "Transaction date is required."

Flow 2 MUI inputs
→ helper text for each checked invalid value

committed invalid grid cell
→ field-local validation styling + tooltip containing that field's message
```

Validation decoration must not alter AG Grid column geometry. Invalid styling is therefore geometry-neutral and may not push, overlap or visually invade a neighboring cell.

Renderers and formatters must also tolerate invalid LOCAL drafts. For example, temporarily blank/invalid Currency must not make Amount formatting throw an `Intl.NumberFormat` exception, and a blank/invalid Date draft must not crash date presentation.

## Current-page programmatic edit actions

The editing controls can apply changes to concrete rows on the exact current pagination page.

Implemented flows include:

- apply the most recent direct edit's field/value;
- apply an explicit set of opted-in editable field/value pairs;
- target all editable rows on the current page or editable selected rows on the current page.

Current Page is a pagination scope, not a cache-block scope. If the expected page is not fully resolved, the operation refuses partial application.

Programmatic edits use the same validation callback as direct cell edits. They do not bypass validation, and invalid values are still recorded as LOCAL drafts so the user can see/correct/discard them.

A checked blank numeric Flow 2 input is significant rather than silently ignored:

```text
Amount checked + blank
→ amount: null LOCAL draft
→ number validation fails
→ affected editable rows remain dirty/invalid
```

Likewise, blank Currency is applied as invalid LOCAL work without allowing dependent Amount formatting to crash.

## Row interaction and editing

```text
enabled
→ selectable and editable

selectionDisabled
→ not selectable
→ still directly/programmatically editable

readOnly
→ not selectable
→ not editable
```

Editable columns use native AG Grid `editable` callbacks. Programmatic current-page editing uses the same feature-owned row-editability predicate so application code cannot bypass the read-only rule through `RowNode.setDataValue(...)`.

If a row becomes read-only after fresh authoritative data arrives while a LOCAL draft already exists, the existing LOCAL draft can remain visible for review; new editing and persistence remain governed by current row policy.

## Dirty-row count

Edited count means dirty rows, not dirty fields.

```text
one row with three dirty fields
→ edited row count = 1
```

The count comes from the tracked update payload rather than visible RowNodes.

## Row Save

A dirty row can be saved independently of checkbox selection.

Before persistence:

```text
row has unresolved conflict
→ Save blocked

row has validation error
→ Save blocked

otherwise
→ PATCH /api/transactions/{id}/
```

Successful flow:

```text
tracked row changes
→ feature mapper restores strict API field types
→ PATCH /api/transactions/{id}/
→ backend validates explicit patch + row policy
→ authoritative updated row returned
→ exact submitted tracked values acknowledged
→ row-model-specific authoritative refresh/cache update
```

`transactionDate` is persisted through the same explicit update endpoint as the other editable fields. DRF `DateField` remains authoritative for persisted date syntax.

A rejected 400 field validation response does not acknowledge the draft. The LOCAL value therefore stays visible and dirty while backend messages are mapped into the same stable validation state.

## Save Selected Edits

Selected Save operates on:

```text
accumulated dirty rows
        ∩
current logical selection
```

Therefore:

- selected clean rows are omitted;
- unselected dirty rows remain untouched;
- touched rows are sent as explicit IDs + explicit field changes;
- Select All does not manufacture edits for untouched/unloaded rows;
- the exact selected-dirty update set is checked for conflicts and validation errors;
- if that exact target contains either, the entire selected Save is blocked rather than silently omitting problematic rows;
- an invalid dirty row outside the selected target does not block Save Selected.

Persistence uses:

```text
PATCH /api/transactions/bulk/
```

The backend validates the requested batch before applying it. Indexed DRF field errors are mapped back to the corresponding submitted stable row IDs and fields.

## Validation and conflict are separate

```text
validation
→ is the effective LOCAL value acceptable?

conflict
→ did REMOTE diverge from BASE while LOCAL exists?
```

A field can therefore be:

```text
valid + no conflict
invalid + no conflict
valid + conflict
invalid + conflict
```

Cell presentation supports both states at the same time. Validation does not disable editing; conflict does, because conflict requires an explicit `Use server` / `Keep my edit` decision first.

Detailed validation behavior: [Grid validation](grid-validation.md).

Detailed BASE/LOCAL/REMOTE behavior: [Edit conflict reconciliation](edit-conflict-reconciliation.md).

## Conflict resolution + validation

### Use server

```text
visible value → REMOTE
LOCAL draft removed
conflict removed
validation for discarded LOCAL removed
```

Other dirty fields on the row remain untouched.

### Keep my edit

```text
BASE → latest REMOTE
LOCAL retained
conflict removed
LOCAL revalidated
```

Revalidation replaces stale backend validation messages with the current client-rule result for the value the user explicitly chose to keep.

## Discard

Discard forgets LOCAL unsaved work without a backend write.

For ordinary dirty fields:

```text
visible value → BASE
LOCAL draft → removed
validation → removed
```

For conflicted fields:

```text
visible value → latest REMOTE
LOCAL draft/conflict → removed
validation → removed
```

Discard is idempotent. The editing engine's own programmatic restore event cannot recreate the discarded draft.

## Safe acknowledgement of in-flight saves

Persistence acknowledgement clears only the exact value that was successfully submitted.

If a user changes the same field again while an older successful save request is in flight, the newer LOCAL value remains dirty after the older request succeeds.

This prevents an older success response from erasing newer unsaved work.

## Authoritative refresh and LOCAL restoration

When fresh authoritative row data arrives, `restoreTrackedEdits(...)` first reconciles dirty fields and then overlays remaining LOCAL values back into concrete rows.

The hook distinguishes fresh authoritative row objects from row data that it already mutated for LOCAL presentation. That prevents page/model revisits from falsely looking like server convergence.

If fresh REMOTE already equals LOCAL:

```text
REMOTE == LOCAL
→ field auto-cleans
→ validation for that no-longer-local field clears
```

Authoritative arrival differs by row model:

### Client-Side

```text
TanStack Query authoritative data changes
→ new editable rowData projection
→ onRowDataUpdated
→ reconcile + restore remaining LOCAL values
```

### Infinite

```text
cache rows load/refresh/recreate
→ model/pagination lifecycle
→ reconcile + restore remaining LOCAL values
```

### SSRM

```text
server-side store rows load/refresh/recreate
→ model lifecycle
→ reconcile + restore remaining LOCAL values
```

## Selection relationship

Selection and editing remain separate concerns:

- editing a row does not select it;
- selecting a row does not create a draft;
- selection can target current-page edit propagation;
- selection determines which accumulated drafts participate in selected Save/Discard;
- logical selection defines the target of selected business actions;
- `selectionDisabled` rows may still be directly edited;
- `readOnly` rows cannot receive new edits.

## Backend contracts

```text
PATCH /api/transactions/{id}/
→ save one explicit dirty row

PATCH /api/transactions/bulk/
→ save explicit dirty-row patches

PATCH /api/transactions/selection/
→ apply one Transaction business change to a logical selected target
```

`/bulk/` persists already-existing LOCAL drafts. `/selection/` applies a business action and can target unloaded server rows. They are intentionally separate operations.

`TransactionChangesSerializer` is authoritative for persisted edit validation. Frontend rules provide immediate UX and Save guards but never replace backend validation.

## Reusable implementation boundaries

```text
frontend/src/shared/grid/editing/trackedGridEditing.ts
→ pure dirty/conflict state transitions and queries

frontend/src/shared/grid/editing/useTrackedGridEditing.ts
→ durable draft lifecycle, RowNode restoration, authoritative reconciliation,
  and coordination of separate validation state

frontend/src/shared/grid/validation/gridValidation.ts
→ domain-neutral validation execution/state/query primitives

frontend/src/shared/grid/validation/defaultGridValidationRules.ts
→ registered executable validators

frontend/src/shared/grid/editing/useCurrentPageEditActions.ts
→ exact current-page targeting and programmatic application

frontend/src/features/transactions/grid/transactionEditing.ts
→ Transaction editable fields + draft types + row editability + validation callback

frontend/src/features/transactions/grid/TransactionAccountEditor.tsx
→ MUI Account text cell editor with field-specific helper text

frontend/src/features/transactions/grid/TransactionDateEditor.tsx
→ MUI/native-date-picker cell editor with field-specific helper text

frontend/src/features/transactions/grid/transactionValidation.ts
→ Transaction validation rules/messages + backend field-error mapping

frontend/src/features/transactions/grid/transactionUpdate.mapper.ts
→ strict persisted patch mapping, including ISO transactionDate

frontend/src/features/transactions/grid/useTransactionEditPersistence.ts
→ Transaction Save lifecycle + server validation error routing
```

## Verification expectations

Focused automated tests cover pure tracked state, direct/programmatic validation, correction, Discard, conflict resolution, backend field-error mapping, programmatic-write guarding, persistence acknowledgement and concrete-grid integration.

TypeScript Playwright under `tests/browser/` exercises the real Django + Vite + Chromium + AG Grid integration for critical paths. Current browser coverage includes Account MUI editing, Date-picker validation, Flow 2 blank Amount/Currency regressions, Row Save/Discard, explicit selected actions and export across Client, Infinite and SSRM.

The broader human-readable regression steps remain under `docs/implementation/testing/`. A Playwright pass proves only the scenarios automated there; it does not imply every manual checklist item was executed.
