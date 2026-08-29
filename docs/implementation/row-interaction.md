# Row Interaction Capability

The feature/backend decides why a row is restricted. Shared grid code consumes only the generic interaction result.

## Current interaction modes

```ts
export type GridRowInteractionMode =
  | 'enabled'
  | 'selectionDisabled'
  | 'readOnly';
```

Current meaning:

| Mode | Selectable | Selection-based actions | Editable | Modifying row actions |
| --- | --- | --- | --- | --- |
| `enabled` | Yes | Yes | Yes | Yes |
| `selectionDisabled` | No | No | Yes | Yes |
| `readOnly` | No | No | No | No |

The mode is capability data. Shared code does not inspect Transaction status/account or other domain conditions to derive it.

A row may also include `interactionReason` for user-facing explanation. The reason text is presentation only and is never parsed to decide behavior.

## Current Transactions backend policy

The demo backend currently derives modes from Transaction business data:

```text
status = Pending AND account = Treasury
→ selectionDisabled
→ Pending Treasury transactions require individual review

status = Completed AND account = Settlement
→ readOnly
→ Completed Settlement transactions are locked

otherwise
→ enabled
```

This rule lives in the Transactions backend service. Shared grid code sees only the resulting generic mode/reason.

The backend recomputes interaction policy after authoritative writes, so a row can change mode when its business data changes.

## Frontend loaded-row ownership

Loaded rows use native AG Grid callbacks wherever possible.

### Selection

The feature maps the current interaction mode to `rowSelection.isRowSelectable`.

AG Grid evaluates that callback and exposes the result on `RowNode.selectable`.

Shared/custom selection mechanics consume the native `node.selectable` flag rather than re-running Transaction business rules.

### Editing

Editable columns use native `ColDef.editable` callbacks.

Shared programmatic edit helpers also receive the same feature-owned row-editability predicate so `RowNode.setDataValue(...)` cannot bypass the read-only rule.

### Mutable row presentation

Interaction presentation is dynamic because authoritative writes can change `interactionMode` while AG Grid keeps the same RowNode alive.

The common interaction classes therefore use native `rowClassRules`:

```text
selectionDisabled
→ grid-row--selection-disabled while the rule is true

enabled
→ the selection-disabled/read-only rules become false
→ AG Grid removes those rule-owned classes

readOnly
→ grid-row--read-only while the rule is true
```

Do not use additive `getRowClass` for mutable interaction modes. AG Grid can re-run `getRowClass` after data refresh but does not remove a class that an earlier callback result added. That can leave a now-enabled row with stale restricted-row colour/checkbox treatment even though the Access cell already shows the new authoritative mode.

The concrete Transaction roots keep `getTransactionRowClass` only as the feature boundary for unrelated additive/static Transaction classes; it currently returns no class. Interaction-mode presentation belongs to `transactionRowClassRules`.

## Row-model selection behavior

### Client-Side

The complete working set is local. Native AG Grid selection evaluates `isRowSelectable` for the full Client dataset.

Therefore `selectionDisabled` and `readOnly` rows never enter the native selected set, including native Page/Filtered/All Select All.

### Infinite

Loaded/manual/current-page selection skips RowNodes whose native `selectable` flag is false.

For filtered/all dataset-wide logical selection, restricted rows are **not** converted into user exception IDs. The frontend keeps the compact logical selection and backend authority removes ineligible rows when the operation resolves its target.

### SSRM

Native SSRM explicit/All Records selection relies on native selectability for loaded rows and backend eligibility for authoritative selected operations.

Custom Current Page / All Filtered synchronization also skips non-selectable loaded RowNodes.

## Authoritative interaction-mode transitions

A refresh after Save, selected action or Import can change a row's mode. The next rendered/native state must move together rather than mixing old and new policy.

For example:

```text
selectionDisabled → enabled
→ Access restriction disappears
→ selection-disabled row class is removed
→ checkbox becomes selectable
→ clicking it creates normal selected state/header indeterminate state

enabled → selectionDisabled
→ warning presentation appears
→ selection-disabled row class is added
→ checkbox becomes non-selectable

enabled → readOnly
→ locked presentation appears
→ read-only row class is added
→ checkbox becomes non-selectable
→ editing is blocked
```

This transition contract is exercised in the real-grid Playwright suite for Client, Infinite and SSRM through the Import authoritative-refresh path.

## Restricted rows are not user deselection exceptions

A row outside the selectable universe is different from a row the user explicitly deselected.

For example:

```ts
{ mode: 'exclude', ids: [] }
```

still means the complete logical selected universe even if some backend rows are `selectionDisabled` or `readOnly`.

Do not rewrite that as:

```ts
{ mode: 'exclude', ids: ['restricted-a', 'restricted-b'] }
```

The `ids` in exclude mode represent explicit user exceptions, not backend policy exclusions.

This distinction applies to:

- manual selection;
- Current Page;
- All Filtered;
- All Records;
- selection restoration as server-backed rows materialise.

## Backend authority

The backend independently enforces row policy because server-wide operations can target rows the browser has never loaded.

For a logical selected operation:

```text
include + ids
→ resolve requested rows
→ keep backend selection-eligible rows
→ apply operation

exclude + filters
→ apply filters
→ keep backend selection-eligible rows
→ remove explicit user exception ids
→ apply operation

exclude without filters
→ complete dataset
→ keep backend selection-eligible rows
→ remove explicit user exception ids
→ apply operation
```

A restricted row is skipped regardless of whether it was loaded in AG Grid.

## Direct edit persistence

Selection eligibility and edit eligibility remain distinct.

```text
selectionDisabled
→ direct editing/persistence allowed

readOnly
→ direct editing/persistence rejected
```

The backend detail-update path rejects read-only rows.

The explicit bulk edit path validates all requested rows before mutation so a read-only target does not leave a partially applied batch.

## Presentation

Restricted rows are visibly distinguishable from ordinary selected rows.

Current shared/feature presentation includes:

```text
selectionDisabled
→ disabled native checkbox
→ review/warning row treatment
→ visible "Selection disabled" indicator/reason

readOnly
→ disabled native checkbox
→ stronger locked row treatment
→ visible lock + "Read only" indicator/reason
```

Presentation is not enforcement. Native callbacks and backend validation remain authoritative.

## Reusable row-class helpers

`frontend/src/shared/grid/rows/gridRowInteractionClass.ts` owns generic AG Grid class mechanics.

Mutable interaction state should use:

```ts
const rowClassRules = createGridRowInteractionClassRules<MyRow>();
```

A feature with a different row shape can provide `getMode(row)` and can override the common class names.

The older `createGridRowInteractionClassGetter(...)` remains available only for genuinely additive/static class usage. It must not own a mutable restriction class because old `getRowClass` results can accumulate on a surviving RowNode.

## Editing/conflict relationship

A fresh authoritative row can change interaction mode while LOCAL work already exists.

The tracked-edit engine may keep existing LOCAL values visible long enough to reconcile/review them, but the latest read-only policy still blocks new editing and authoritative persistence.

Row interaction does not override conflict semantics, and conflict state does not override backend row policy.

## Implementation map

```text
frontend/src/shared/grid/rows/gridRowInteraction.ts
→ generic interaction-mode predicates

frontend/src/shared/grid/rows/gridRowInteractionClass.ts
→ dynamic rowClassRules + additive/static row-class helper

frontend/src/features/transactions/grid/transactionRowInteraction.ts
→ Transaction adapters + transactionRowClassRules

frontend/src/features/transactions/transactionsGrid.config.ts
→ supplies Transaction interaction rowClassRules to all three row-model defaults

frontend/src/features/transactions/grid/TransactionsClientGrid.tsx
frontend/src/features/transactions/grid/TransactionsInfiniteGrid.tsx
frontend/src/features/transactions/grid/TransactionsSsrmGrid.tsx
→ native selectability/editability integration

backend/apps/transactions/services.py
→ Transaction business policy + authoritative selection/edit eligibility
```

## Verification expectations

Verification should cover:

- mode predicate/class-rule mapping;
- native checkbox selectability for all three modes;
- `selectionDisabled → enabled`, `enabled → selectionDisabled` and `enabled → readOnly` authoritative transitions;
- stale restricted row classes are removed when the latest mode becomes enabled;
- a newly enabled checkbox can be checked and produces normal selected/header state;
- Client native Page/Filtered/All selection excluding restricted rows;
- Infinite Current Page and dataset synchronization skipping restricted loaded rows;
- SSRM Current Page/custom filtered synchronization skipping restricted loaded rows;
- server logical payloads not enumerating restricted IDs as user exceptions;
- backend selected operations skipping restricted unloaded rows;
- `selectionDisabled` direct edit allowed;
- `readOnly` direct edit rejected;
- explicit bulk edit containing a read-only row rejected before mutation;
- visible reason/presentation without using CSS as enforcement.
