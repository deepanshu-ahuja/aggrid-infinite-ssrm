# Unsaved edit conflict reconciliation

This document records why the grid needs field-level refresh reconciliation, how the reusable state machine works, what the Transactions UI does with it, and which mutations are intentionally blocked until a conflict is resolved.

## Problem

Infinite Row Model and SSRM both replace/reload server rows. A Transaction can therefore have a local unsaved edit while an authoritative refresh returns a different value for the same field.

Example:

```text
BASE   = Pending
LOCAL  = Failed
REMOTE = Completed
```

Blindly restoring `LOCAL` after refresh hides a real server change. Blindly rendering `REMOTE` loses the user's visible unsaved work and can make the value jump when the editor opens. Blindly saving `LOCAL` can overwrite a server change without the user ever reviewing it.

The grid therefore reconciles only fields that already have local drafts. Unedited fields continue to render the fresh server row directly and do not acquire extra React state.

## State model

The shared tracked-edit engine stores field-level information by stable backend row ID:

- `changesById` = current LOCAL unsaved values;
- `originalsById` = BASE values captured when each field first became dirty;
- `conflictsById` = latest REMOTE values only for fields whose refreshed server value differs from both BASE and LOCAL.

Conflict is not another word for dirty:

```text
dirty    = user has an unsaved local choice
conflict = server also changed that same field differently
```

A row can have several dirty fields and only one conflicted field.

## Reconciliation rules

For every locally edited field when genuinely fresh server row data materialises:

```text
REMOTE === BASE
-> server did not change this field
-> keep LOCAL dirty
-> no conflict

REMOTE === LOCAL
-> server already contains the user's desired value
-> clear this field from dirty state automatically
-> no conflict

REMOTE differs from BASE and LOCAL
-> keep LOCAL visible
-> retain REMOTE in conflict metadata
-> mark only this field conflicted
```

The reusable pure transition lives in `shared/grid/editing/trackedGridEditing.ts`.

## Distinguishing fresh rows from our own local overlay

`RowNode.setDataValue()` mutates the row data shown by AG Grid. A later pagination/model event may revisit that same RowNode even though no new backend row arrived.

If the hook treated that locally mutated value as REMOTE, it could incorrectly conclude `REMOTE === LOCAL` and clear the draft.

`useTrackedGridEditing()` therefore remembers the exact RowNode + row-data object reference into which it wrote LOCAL values. Re-visiting the same locally overlaid data object skips remote reconciliation. When AG Grid receives fresh server data, the row-data reference changes and three-way reconciliation runs again.

This marker is lifecycle metadata only. Durable edit/conflict state remains keyed by backend row ID and does not depend on RowNode identity.

## User experience

A real conflict keeps the user's LOCAL value visible in the cell. The cell receives a warning border/glyph and tooltip. Clicking the conflicted cell opens a small Transactions-owned popover showing:

```text
Your edit: Failed
Server value: Completed

[Use server] [Keep my edit]
```

A conflicted field cannot open its normal editor until that choice is made. This avoids changing the value again while the LOCAL-vs-REMOTE decision is still unresolved.

There is intentionally no bulk conflict-resolution command in this revision. Conflicts are reviewed per field so one click cannot accidentally overwrite many unrelated server changes.

## Resolution semantics

### Use server

`Use server` means the local field draft is abandoned:

```text
visible value = REMOTE
LOCAL removed
BASE removed
conflict removed
```

If the row has other non-conflicting drafts, they remain dirty.

### Keep my edit

`Keep my edit` means the user has explicitly reviewed the newer server value and still wants LOCAL:

```text
BASE = latest REMOTE
LOCAL stays unchanged
conflict removed
dirty remains true
```

A later Save can then deliberately persist LOCAL against that reviewed baseline.

### Discard

Discard means "forget my local unsaved work". For a conflicted field, the latest REMOTE value is restored, not the older BASE value. Ordinary dirty fields without a conflict restore BASE.

## Mutation guards

Conflict indication is not merely visual. Mutation entry points defensively inspect conflict state.

### Row Save

A row with any unresolved field conflict cannot be saved. The row Save control is disabled with explanatory text. The root callback also checks again before calling persistence so UI presentation is not the only guard.

### Save selected edits

The existing aggregate save still targets:

```text
accumulated dirty rows ∩ current logical selection
```

If any row in that exact selected-dirty update set has an unresolved conflict, the aggregate Save is blocked. It does not silently omit conflicted rows and partially save the rest.

Discard selected edits remains available because discarding local work does not overwrite server data.

### Server-side selection business actions

A logical selection action is blocked only when it would write a field that is currently conflicted on a locally tracked selected row.

Current Transactions selection actions write only `status`, therefore:

```text
selected status conflict + Mark Completed/Pending/Failed
-> blocked until status conflict is resolved

selected amount conflict + Mark Completed/Pending/Failed
-> allowed; the action does not decide the amount conflict
```

This field-overlap rule prevents broad row-level locking and keeps unrelated operations usable.

Only locally tracked conflicts are relevant to this frontend guard. Unloaded rows without local drafts have no client-side LOCAL value to reconcile.

## Infinite and SSRM boundaries

The reconciliation state machine is shared because BASE/LOCAL/REMOTE semantics are row-model independent.

The refresh mechanisms remain native and row-model specific:

- Infinite root uses `refreshInfiniteCache()`;
- SSRM root uses `refreshServerSide()`.

Both roots call `restoreTrackedEdits()` when rows materialise/change. That hook performs reconciliation and then overlays still-valid LOCAL values.

Do not create one fake shared refresh API merely to make Infinite and SSRM look symmetrical.

## Presentation boundary

Shared editing owns mechanics only:

- dirty state;
- BASE/LOCAL/REMOTE reconciliation;
- conflict metadata;
- `Use server` transition;
- `Keep my edit` transition;
- generic conflict queries used by mutation guards.

Transactions owns presentation:

- conflict cell class/tooltip;
- MUI conflict popover and wording;
- row/selected-save messages;
- knowledge that the current selection business action writes `status`.

The shared hook does not import MUI, Transaction field names, or Transaction action semantics.

## Deliberately not solved here

This feature detects conflicts only after authoritative row data reaches the client.

It does **not** prevent a stale client that never refreshed from overwriting a newer server write. Multi-user optimistic concurrency/version checking is a separate backend contract and should be designed independently.

There is also no configurable `preserveDraft` mode and no bulk "keep all mine/use all server" command. Those extension points should be added only if a real feature requires different behavior.

## Manual testing

Run every scenario in both `/infinite` and `/ssrm` unless the step explicitly names one row model.

### 1. Normal dirty field, server unchanged

1. Edit `status` from `Pending` to `Failed` and do not Save.
2. Trigger a server refresh without changing that row on the backend.
3. Expected: cell still shows `Failed`, remains dirty, and has no conflict warning.
4. Expected: row Save and selected Save remain available according to normal dirty/selection rules.

### 2. Server converges to LOCAL

1. Start with BASE `Pending`; edit LOCAL to `Failed`.
2. Change the backend value to `Failed` by another authoritative path.
3. Refresh the row.
4. Expected: visible value remains `Failed`.
5. Expected: the field is automatically removed from dirty/conflict state because server already matches it.

### 3. Real status conflict

1. Start with BASE `Pending`; edit LOCAL to `Failed`.
2. Change backend status to `Completed` without saving the local edit.
3. Refresh.
4. Expected: cell still visibly shows `Failed`.
5. Expected: warning styling/glyph appears and tooltip mentions LOCAL and server values.
6. Expected: clicking the cell opens the conflict popover with `Failed` vs `Completed`.
7. Expected: normal cell editor does not open while unresolved.

### 4. Use server

Continue from scenario 3 and click `Use server`.

Expected:

- cell becomes `Completed`;
- conflict disappears;
- that status draft is removed;
- unrelated dirty fields on the same row remain dirty.

### 5. Keep my edit

Repeat scenario 3 and click `Keep my edit`.

Expected:

- cell remains `Failed`;
- conflict disappears;
- field remains dirty;
- a later normal Save is allowed and intentionally persists `Failed`.

### 6. Multiple fields, only one conflict

1. Edit `status: Pending -> Failed` and `amount: 100 -> 150` on the same row.
2. Change only backend status to `Completed`; leave backend amount at `100`.
3. Refresh.
4. Expected: only `status` is highlighted as conflicted.
5. Expected: `amount = 150` remains an ordinary dirty draft.

### 7. Row Save guard

1. Create any unresolved conflict.
2. Expected: row Save is disabled/explained.
3. Resolve the conflict.
4. Expected: row Save becomes available if the row remains a valid dirty/editable target.

### 8. Save selected edits guard

1. Create dirty edits on at least two selected rows.
2. Make one selected dirty row conflicted.
3. Expected: `Save selected edits` is blocked; no partial bulk request is sent.
4. Resolve the conflict.
5. Expected: selected Save becomes available again.

### 9. Field-aware selection action guard

1. Select a row with an unresolved `status` conflict.
2. Expected: Mark Completed/Pending/Failed controls are blocked and explain why.
3. Resolve status conflict; create an `amount` conflict instead.
4. Expected: status selection actions are available because they do not write `amount`.

### 10. Discard conflict

1. Create BASE `Pending`, LOCAL `Failed`, REMOTE `Completed`.
2. Use row/selected Discard rather than conflict resolution.
3. Expected: visible status becomes latest server value `Completed` and local conflict/draft disappears.

### 11. Page/cache revisit must not auto-clean LOCAL

1. Create an ordinary unsaved local edit.
2. Navigate pagination/model state in a way that revisits the same already-loaded RowNode without a new backend value.
3. Expected: draft remains dirty; it must not be mistaken for `REMOTE === LOCAL`.

### 12. Fresh cache/server refresh must reconcile

Infinite:

1. Create a dirty field.
2. Trigger a backend change and `refreshInfiniteCache()` through an existing persisted/selection action.
3. Expected: new row data is reconciled and a real divergence becomes a conflict.

SSRM:

1. Repeat using the SSRM screen and `refreshServerSide()` lifecycle.
2. Expected: same field-level state semantics and UI, while SSRM remains responsible for its own cache refresh.

## Automated coverage

Focused tests belong in:

- `shared/grid/editing/trackedGridEditing.test.ts` for pure reconciliation/resolution/mutation-guard semantics;
- `shared/grid/editing/useTrackedGridEditing.test.tsx` for RowNode lifecycle, local-overlay protection, refresh conflict creation and programmatic write behavior;
- Transactions grid tests for visible action wiring where appropriate.

Before merge run:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
source .venv/bin/activate
python backend/manage.py test apps.transactions
```
