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

Transactions currently exposes these editable fields:

```text
account
amount
currency
status
```

The feature owns that field list, field access and row-editability rules.

Shared grid code owns how committed edits are tracked and reconciled.

## Durable editing state

Unsaved editing state is application-owned and keyed by stable backend row ID rather than RowNode identity.

The shared state stores:

```text
changesById
→ current LOCAL unsaved values

originalsById
→ BASE values captured when a field first became dirty

conflictsById
→ latest REMOTE values for unresolved field conflicts
```

This stable-ID state is used across all three row models because authoritative row objects can be replaced:

- Client receives new editable `rowData` objects after authoritative TanStack Query data changes;
- Infinite can recreate/evict RowNodes as cache blocks change;
- SSRM can recreate RowNodes/store data during refresh.

## Direct cell editing

AG Grid's committed `cellValueChanged` event is the boundary for recording a direct user edit.

A user can edit a row without selecting it.

For an ordinary non-conflicted field:

```text
BASE value
→ user commits a different LOCAL value
→ field/row becomes dirty

LOCAL returned to BASE
→ field draft clears
→ row becomes clean when no other dirty fields remain
```

Programmatic writes performed by the editing engine are marked/guarded so AG Grid events caused by our own `setDataValue(...)` calls are not recorded again as fake user edits.

## Current-page programmatic edit actions

The editing controls can apply changes to concrete rows on the current pagination page.

Implemented flows include:

- apply the most recent direct edit's field/value;
- apply an explicit set of opted-in editable field/value pairs;
- target all editable rows on the current page or editable selected rows on the current page.

Current Page is a pagination scope, not a cache-block scope.

If the expected page is not fully resolved, the operation refuses partial application rather than acting on whichever RowNodes happen to be loaded.

## Row interaction and editing

Current generic row interaction modes are:

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

Editable columns use native AG Grid `editable` callbacks.

Programmatic current-page editing uses the same feature-owned row-editability predicate so application code cannot bypass the read-only rule through `RowNode.setDataValue(...)`.

If a row becomes read-only after fresh authoritative data arrives while a LOCAL draft already exists, the existing LOCAL draft can remain visible for conflict review; new editing and persistence remain guarded by current row policy.

## Dirty-row count

Edited count means the number of dirty rows, not dirty fields.

```text
one row with three dirty fields
→ edited row count = 1
```

The count comes from the tracked update payload rather than visible RowNodes.

## Row Save

A dirty row can be saved independently of checkbox selection.

Flow:

```text
tracked row changes
→ PATCH /api/transactions/{id}/
→ backend validates the explicit patch and row policy
→ authoritative updated row returned
→ acknowledged tracked values clear
→ row-model-specific authoritative refresh/cache update
```

A row with an unresolved conflict cannot be saved.

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
- if the exact selected-dirty update set contains an unresolved conflict, Save Selected is blocked rather than partially omitting conflicted rows.

Persistence uses:

```text
PATCH /api/transactions/bulk/
```

The backend validates the requested rows before applying the batch.

## Discard

Discard forgets LOCAL unsaved work without making a backend write.

For ordinary dirty fields:

```text
visible value → BASE
LOCAL draft → removed
```

For conflicted fields:

```text
visible value → latest REMOTE
LOCAL draft/conflict → removed
```

Discard is idempotent. The editing engine's own programmatic restore event cannot recreate the discarded draft.

## Safe acknowledgement of in-flight saves

Persistence acknowledgement clears only the exact value that was successfully submitted.

If a user changes the same field again while an older save request is in flight, the newer LOCAL value remains dirty after the older request succeeds.

This prevents an older response from erasing newer unsaved work.

## Authoritative refresh and LOCAL restoration

When fresh authoritative row data arrives, `restoreTrackedEdits(...)` first reconciles dirty fields and then overlays remaining LOCAL values back into concrete rows.

The hook distinguishes fresh authoritative row objects from row data that it already mutated for LOCAL presentation. That prevents page/model revisits from falsely looking like server convergence.

Authoritative arrival differs by row model:

### Client-Side

```text
TanStack Query authoritative data changes
→ new editable rowData projection
→ onRowDataUpdated
→ reconcile + restore tracked LOCAL values
```

### Infinite

```text
cache rows load/refresh/recreate
→ model/pagination lifecycle
→ reconcile + restore tracked LOCAL values
```

### SSRM

```text
server-side store rows load/refresh/recreate
→ model lifecycle
→ reconcile + restore tracked LOCAL values
```

## Conflict relationship

For an unresolved conflict:

- LOCAL remains visible;
- conflict metadata records REMOTE;
- the conflicted field's normal editor is blocked;
- Transactions shows `Use server` / `Keep my edit` resolution UI;
- relevant Save/business mutations are guarded until resolution.

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

The write endpoints have distinct responsibilities:

```text
PATCH /api/transactions/{id}/
→ save one explicit dirty row

PATCH /api/transactions/bulk/
→ save explicit dirty-row patches

PATCH /api/transactions/selection/
→ apply one Transaction business change to a logical selected target
```

`/bulk/` persists already-existing LOCAL drafts. `/selection/` applies a business action and can target unloaded server rows. They are intentionally separate operations.

## Reusable implementation boundaries

```text
frontend/src/shared/grid/editing/trackedGridEditing.ts
→ pure dirty/conflict state transitions and queries

frontend/src/shared/grid/editing/useTrackedGridEditing.ts
→ durable draft lifecycle, RowNode value restoration, authoritative reconciliation

frontend/src/shared/grid/editing/useCurrentPageEditActions.ts
→ exact current-page targeting and programmatic application

frontend/src/features/transactions/grid/transactionEditing.ts
→ Transaction editable fields + row editability configuration

frontend/src/features/transactions/grid/useTransactionEditPersistence.ts
→ Transaction Save request lifecycle
```

## Verification expectations

Tests should cover pure tracked state, programmatic-write guarding, Discard behavior, persistence acknowledgement and concrete-grid integration.
