# Unsaved Edit Conflict Reconciliation

This document describes the **current implemented** BASE/LOCAL/REMOTE conflict behavior shared by Client-Side, Infinite and SSRM Transaction grids.

It is an implementation reference, not a roadmap.

## Why reconciliation exists

A row can have a LOCAL unsaved edit while fresh authoritative data later arrives with a different value for the same field.

Example:

```text
BASE   = Pending
LOCAL  = Failed
REMOTE = Completed
```

Blindly restoring LOCAL would hide a real server change. Blindly replacing LOCAL with REMOTE would make unsaved work disappear. The grid therefore reconciles only fields that already have local drafts.

## State model

The shared tracked-edit state stores field-level information by stable backend row ID:

```text
changesById
→ current LOCAL unsaved values

originalsById
→ BASE values captured when each field became dirty

conflictsById
→ latest REMOTE values only for unresolved field conflicts
```

Dirty and conflict are different concepts:

```text
dirty
→ user has unsaved LOCAL work

conflict
→ fresh REMOTE also changed that same field differently
```

A row may have several dirty fields while only one field is conflicted.

## Reconciliation rules

For every dirty field when genuinely fresh authoritative row data arrives:

```text
REMOTE === BASE
→ server did not change this field
→ keep LOCAL dirty
→ no conflict

REMOTE === LOCAL
→ authoritative data already contains the user's desired value
→ clear that field from dirty state
→ no conflict

REMOTE differs from BASE and LOCAL
→ keep LOCAL visible
→ retain REMOTE in conflict state
→ mark only that field conflicted
```

The pure state transitions live in `frontend/src/shared/grid/editing/trackedGridEditing.ts`.

## Fresh authoritative data versus our own LOCAL overlay

`RowNode.setDataValue(...)` mutates the row data shown by AG Grid.

A later page/model event can revisit the same row object without any new server data. Treating that locally-mutated value as REMOTE would incorrectly make the tracker think the server converged to LOCAL.

`useTrackedGridEditing()` therefore records which concrete RowNode/data object has already received LOCAL overlay values.

```text
same locally overlaid data object revisited
→ do not treat it as fresh REMOTE

new authoritative row object arrives
→ run BASE/LOCAL/REMOTE reconciliation
```

Durable edit/conflict state remains keyed by backend row ID; RowNode identity is used only to distinguish presentation replay from fresh authoritative data.

## Row-model authoritative arrival

The conflict state machine is shared, but each row model has its own authoritative-data lifecycle.

### Client-Side

```text
TanStack Query authoritative collection changes
→ fresh editable rowData objects
→ onRowDataUpdated
→ reconcile + restore remaining LOCAL values
```

### Infinite

```text
cache block loads/refreshes/recreates rows
→ model/pagination lifecycle
→ reconcile + restore remaining LOCAL values
```

### SSRM

```text
server-side store loads/refreshes/recreates rows
→ model lifecycle
→ reconcile + restore remaining LOCAL values
```

## User experience

A real conflict keeps LOCAL visible in the cell.

Transactions currently provides:

- conflict cell styling;
- tooltip with LOCAL/REMOTE context;
- click-to-open conflict popover;
- `Use server` action;
- `Keep my edit` action.

A conflicted field does not open its normal editor until the conflict is resolved.

## Use server

`Use server` abandons the LOCAL draft for that field:

```text
visible value = REMOTE
LOCAL removed
BASE removed
conflict removed
```

Other dirty fields on the same row remain unchanged.

## Keep my edit

`Keep my edit` records that the user reviewed the newer authoritative value and still wants LOCAL:

```text
BASE = latest REMOTE
LOCAL remains
conflict removed
dirty remains true
```

A later Save then writes the reviewed LOCAL value intentionally.

## Discard

Discard means forget LOCAL unsaved work.

For a conflicted field:

```text
visible value → latest REMOTE
LOCAL/BASE/conflict for that field → removed
```

For an ordinary dirty field without a conflict:

```text
visible value → BASE
LOCAL/BASE for that field → removed
```

## Mutation guards

Conflict state affects mutation entry points; it is not presentation-only.

### Row Save

A dirty row with any unresolved conflict cannot be saved.

The UI disables/explains the row Save control, and the root callback checks conflict state again before persistence.

### Save Selected Edits

Selected Save targets:

```text
accumulated dirty rows ∩ current logical selection
```

If that exact selected-dirty update set contains any unresolved conflict, the entire selected Save is blocked. Conflicted rows are not silently omitted.

### Selected Change Status

The current selected business action writes only `status`.

Therefore the frontend guard is field-aware:

```text
selected status conflict
→ Change Status blocked

selected amount/account/currency conflict only
→ Change Status remains available
```

Only locally tracked conflicts can participate in this frontend guard. Unloaded rows without LOCAL drafts have no client-side conflict state.

## Row interaction relationship

A fresh authoritative row may also change interaction policy.

If a row becomes read-only while LOCAL work already exists, the existing LOCAL value can remain visible for conflict review; new editing and persistence remain governed by the latest row policy.

Conflict state does not override backend authority.

## Current limitation

This client-side reconciliation detects divergence only after fresh authoritative data reaches the browser.

It does not provide backend stale-write/version protection for a client that never refreshed before writing. That is outside the currently implemented conflict mechanism.

## Implementation boundaries

```text
frontend/src/shared/grid/editing/trackedGridEditing.ts
→ pure reconciliation, conflict queries and resolution transitions

frontend/src/shared/grid/editing/useTrackedGridEditing.ts
→ authoritative-row detection, LOCAL overlay/restoration and GridApi application

frontend/src/features/transactions/grid/TransactionEditConflictPopover.tsx
→ Transaction conflict presentation

frontend/src/features/transactions/grid/TransactionsClientGrid.tsx
frontend/src/features/transactions/grid/TransactionsInfiniteGrid.tsx
frontend/src/features/transactions/grid/TransactionsSsrmGrid.tsx
→ row-model-specific authoritative lifecycle + mutation guards
```

## Verification scenarios

Current manual/automated verification should cover these behaviors independently across relevant row models:

1. REMOTE still equals BASE → LOCAL remains ordinary dirty.
2. REMOTE converges to LOCAL → field auto-cleans.
3. REMOTE differs from BASE and LOCAL → field conflict is created and LOCAL remains visible.
4. `Use server` applies REMOTE and clears that field draft/conflict.
5. `Keep my edit` clears conflict while keeping LOCAL dirty against REMOTE as the new BASE.
6. only the divergent field is conflicted when a row has multiple dirty fields.
7. Row Save is blocked while its row has an unresolved conflict.
8. Save Selected is blocked when its exact dirty target contains a conflict.
9. Change Status is blocked by a selected `status` conflict but not an unrelated field conflict.
10. Discard restores latest REMOTE for conflicted fields.
11. revisiting the same locally-overlaid RowNode/data object does not fake server convergence.
12. genuinely fresh Client rowData, Infinite cache rows and SSRM store rows do run reconciliation.

Manual browser verification remains separately tracked and is not claimed complete here.
