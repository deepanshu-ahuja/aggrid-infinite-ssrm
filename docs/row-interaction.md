# Server-backed row interaction policy

This document describes the reusable row-interaction capability used by server-backed AG Grid tables.

The goal is to let each feature decide **why** a row is restricted while keeping the grid behavior itself domain-neutral and consistent across Infinite Row Model and SSRM.

For the concrete implementation checklist and browser/network test steps, see [Row interaction capability: what exists and how to test it](./row-interaction-manual-testing.md).

## Interaction modes

Shared grid code understands only three modes:

```ts
export type GridRowInteractionMode =
  | 'enabled'
  | 'selectionDisabled'
  | 'readOnly';
```

Their meaning is:

| Mode | Selectable | Selection-based bulk actions | Editable | Modifying row actions |
| --- | --- | --- | --- | --- |
| `enabled` | Yes | Yes | Yes | Yes |
| `selectionDisabled` | No | No | Yes | Yes |
| `readOnly` | No | No | No | No |

A feature owns the condition that produces the mode. Shared grid code must not contain domain checks such as transaction status, payable state, permissions, workflow state, or lock reason.

A feature may also return an explanatory reason such as `interactionReason`. The reason is presentation metadata only. It tells the user why the backend policy restricted the row; the grid must never parse the text to decide behavior.

## Restricted rows must be visibly understandable

A disabled checkbox by itself is not enough because a user needs to understand that the row is intentionally restricted and, when possible, why.

The two restricted states should look different because they mean different things:

```text
selectionDisabled
→ native checkbox is disabled and rendered with a clear neutral-grey disabled treatment
→ row gets a light warning/review background and marker
→ visible "Selection disabled" indicator
→ reason available in the UI
→ editing and row-level modifying actions still allowed

readOnly
→ native checkbox is disabled and rendered with a clear neutral-grey disabled treatment
→ whole row gets a stronger neutral-grey locked treatment
→ visible lock + "Read only" indicator
→ reason available in the UI
→ editing and modifying row-level actions blocked
```

Selected rows use the normal AG Grid selection/accent treatment and must remain visually distinct from either restricted state.

Presentation is still not enforcement. Native AG Grid selectability/editability callbacks and backend validation remain authoritative.

## Reusable row-class mapping

The common interaction-to-class mapping lives in:

`frontend/src/shared/grid/rows/gridRowInteractionClass.ts`

A table using the recommended common row contract needs only:

```ts
const getRowClass = createGridRowInteractionClassGetter<MyRow>();
```

The helper owns the AG Grid `RowClassParams` callback shape, loading/stub-row handling, default interaction classes, and class merging. A feature should not copy the same `if (readOnly) ... if (selectionDisabled) ...` switch into every grid.

The recommended API property is:

```ts
interactionMode: GridRowInteractionMode;
```

This is a convention, not a forced backend shape. If another feature stores the mode elsewhere, adapt it:

```ts
const getRowClass = createGridRowInteractionClassGetter<MyRow>({
  getMode: (row) => row.permissions.gridInteractionMode,
});
```

The public TypeScript overloads deliberately require `getMode` when the row type does not expose the recommended `interactionMode` property. This prevents a future feature from silently using the helper with the wrong row shape.

A feature may override only the interaction class names:

```ts
const getRowClass = createGridRowInteractionClassGetter<MyRow>({
  classNames: {
    readOnly: 'my-grid--locked',
    selectionDisabled: 'my-grid--selection-disabled',
  },
});
```

Or append one feature-only class while preserving the common interaction class:

```ts
const getRowClass = createGridRowInteractionClassGetter<MyRow>({
  getAdditionalClass: (row) =>
    row.isHighValue ? 'my-feature-row--high-value' : undefined,
});
```

That small extension point must not become the future general conditional-row-style engine. Complex condition arrays / arbitrary style rules remain a separate capability so row-interaction code stays focused.

## Current Transactions demo policy

The reusable grid capability does **not** know Transaction fields. For local/demo data, the Transactions backend derives the generic modes from Transaction business data so developers can understand why a row is restricted by looking at the row itself:

```text
status = Pending AND account = Treasury
→ selectionDisabled
→ reason: Pending Treasury transactions require individual review,
          so selection-based bulk actions are disabled

status = Completed AND account = Settlement
→ readOnly
→ reason: Completed Settlement transactions are locked from selection and editing

otherwise
→ enabled
```

This policy intentionally lives in `backend/apps/transactions/services.py`, not under `shared/grid`. It is only an example Transaction policy; another feature should derive the generic modes from its own fields and business rules.

The policy is recomputed after authoritative writes. For example, if an enabled Settlement Transaction is legitimately changed to `Completed`, the returned/refreshed row becomes `readOnly`. A future Payables table could use completely different fields and rules while reusing the same three generic interaction modes.

## Selection-disabled rows are outside the selectable universe

A disabled row is **not** an implicit exclusion.

If Select All Records produces:

```ts
{ mode: 'exclude', ids: [] }
```

that compact selection remains unchanged even if some loaded or unloaded rows are disabled.

Do not turn disabled rows into:

```ts
{ mode: 'exclude', ids: ['disabled-a', 'disabled-b'] }
```

`exclude` IDs represent rows the user explicitly deselected while Select All is active. Disabled rows were never eligible for the selection in the first place.

The same rule applies to:

- manual checkbox selection;
- Select Current Page;
- Select All Filtered;
- Select All Records;
- selection restoration when Infinite blocks or SSRM rows materialise again.

## Frontend ownership

For loaded rows, use AG Grid's native row-selectability capability.

The concrete grid maps the feature-provided interaction mode to `rowSelection.isRowSelectable`. AG Grid evaluates that callback and exposes the result on `RowNode.selectable`. Shared selection mechanics consume that native flag instead of re-running feature conditions.

Custom selection mechanics must also avoid touching disabled nodes:

- Infinite current-page header passes only `RowNode`s whose native `selectable` flag is true to `setNodesSelected`;
- Infinite custom filtered/all selection reconciliation never calls `setSelected(true)` for a disabled node;
- SSRM current-page selection passes only selectable nodes to the native selection API;
- SSRM custom Select All Filtered reconciliation skips disabled nodes.

Do not enumerate disabled IDs into application include/exclude state.

## Editing and read-only rows

Selection restriction and editing restriction are separate capabilities.

`selectionDisabled` means only that the row cannot participate in checkbox/logical bulk selection. The row may still be edited and may still expose modifying row-level actions.

`readOnly` is the stronger state. Editable columns use AG Grid's native `editable` callback so a read-only row cannot enter an editor. Programmatic current-page edit propagation and tracked-edit restoration also receive the same row-editability predicate so application code cannot bypass the UI rule through `setDataValue`.

Modifying row-level controls should use the same read-only predicate rather than maintain another feature-specific lock check.

## Backend ownership

The backend is authoritative for rows the browser has never loaded.

The frontend must never load the full dataset merely to discover disabled IDs before a dataset-wide action.

For a logical selection action the backend resolves the target inside the eligible universe:

```text
include + ids
→ resolve the requested ids
→ keep only selection-eligible rows
→ apply the action

exclude + filters
→ apply filters
→ keep only selection-eligible rows
→ apply explicit user exclusions
→ apply the action

exclude without filters
→ all records
→ keep only selection-eligible rows
→ apply explicit user exclusions
→ apply the action
```

This means a disabled record is skipped whether or not it is currently loaded in AG Grid.

Direct edit persistence is different from selection eligibility. A `selectionDisabled` row may still be saved directly. A `readOnly` row must be rejected by the backend even if a stale or crafted request attempts to update it.

For explicit multi-row edit persistence, validate every requested row before mutating any row so a read-only target does not leave a partially applied batch.

## Infinite and SSRM remain separate

The semantic rule is shared, but row-model implementation remains native to each model.

Do not create a universal selection controller merely because both models consume the same row interaction mode.

Infinite keeps its custom dataset-wide logical selection because it cannot represent selection across unloaded rows natively. SSRM keeps native explicit/All Records selection and only customises the unsupported Select All Filtered path.

## Adding another server-backed table

A future table such as Payables should:

1. expose its own backend-provided interaction mode or map its backend data to the shared three-mode contract;
2. preferably expose the common `interactionMode` field, or provide a small `getMode(row)` adapter;
3. optionally expose a feature-owned human-readable restriction reason;
4. reuse `createGridRowInteractionClassGetter` instead of copying AG Grid row-class logic;
5. pass its feature-owned selectability callback into native AG Grid row selection;
6. use row-editability for editable columns and programmatic edit helpers;
7. enforce equivalent eligibility/read-only rules in its own backend service/repository;
8. keep disabled rows out of include/exclude bookkeeping;
9. provide presentation that makes restricted states distinguishable without making styling the enforcement mechanism.

The future table may have completely different reasons for restriction. Those reasons remain feature/domain-specific; only the resulting grid capability is shared.

## Tests that matter

At minimum, cover:

- generic interaction-mode capability mapping;
- shared default row classes;
- custom `getMode` adapter;
- interaction class-name overrides;
- appended feature-only row class;
- native checkbox selectability for all three modes;
- Select Current Page skips disabled rows;
- Select All Filtered does not programmatically select disabled loaded rows;
- newly loaded/reloaded disabled rows are not selected during reconciliation;
- Select All Records / Filtered wire payloads do not enumerate disabled IDs;
- backend selection actions skip disabled unloaded rows;
- `selectionDisabled` direct edit is allowed;
- `readOnly` direct edit is rejected;
- explicit bulk edit containing a read-only row is rejected atomically;
- restricted rows expose a clear state/reason in the UI without using presentation as enforcement.
