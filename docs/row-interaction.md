# Server-backed row interaction policy

This document describes the reusable row-interaction capability used by server-backed AG Grid tables.

The goal is to let each feature decide **why** a row is restricted while keeping the grid behavior itself domain-neutral and consistent across Infinite Row Model and SSRM.

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

The concrete grid maps the feature-provided interaction mode to `rowSelection.isRowSelectable`. This makes the checkbox non-selectable at the AG Grid boundary rather than maintaining a parallel React selected-ID rule.

Custom selection mechanics must also avoid touching disabled nodes:

- Infinite current-page header passes only `RowNode`s whose native `selectable` flag is not false to `setNodesSelected`;
- Infinite custom filtered/all selection reconciliation never calls `setSelected(true)` for a disabled node;
- SSRM current-page selection passes only selectable nodes to the native selection API;
- SSRM custom Select All Filtered reconciliation skips disabled nodes.

Do not enumerate disabled IDs into application include/exclude state.

## Editing and read-only rows

Selection restriction and editing restriction are separate capabilities.

`selectionDisabled` means only that the row cannot participate in checkbox/logical bulk selection. The row may still be edited and may still expose modifying row-level actions.

`readOnly` is the stronger state. Editable columns use AG Grid's native `editable` callback so a read-only row cannot enter an editor. Programmatic current-page edit propagation and tracked-edit restoration also receive the same row-editability predicate so application code cannot bypass the UI rule through `setDataValue`.

Modifying row-level controls should use the same read-only predicate rather than maintain another feature-specific lock check.

A muted row class may be used to communicate read-only state visually, but styling is presentation only; it is never the enforcement mechanism.

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
2. use the shared `GridRowInteractionMode` predicates;
3. pass its feature-owned selectability callback into native AG Grid row selection;
4. use row-editability for editable columns and programmatic edit helpers;
5. enforce the equivalent eligibility/read-only rules in its own backend service/repository;
6. keep disabled rows out of include/exclude bookkeeping.

The future table may have completely different reasons for restriction. Those reasons remain feature/domain-specific; only the resulting grid capability is shared.

## Tests that matter

At minimum, cover:

- native checkbox selectability for all three modes;
- Select Current Page skips disabled rows;
- Select All Filtered does not programmatically select disabled loaded rows;
- newly loaded/reloaded disabled rows are not selected during reconciliation;
- Select All Records / Filtered wire payloads do not enumerate disabled IDs;
- backend selection actions skip disabled unloaded rows;
- `selectionDisabled` direct edit is allowed;
- `readOnly` direct edit is rejected;
- explicit bulk edit containing a read-only row is rejected atomically.
