# Transaction editing

This document records the editing decisions for the Transactions grid while the final UI is still intentionally undecided. The behavior must remain reusable even if Flow 1 and Flow 2 later move to completely different components.

## Native-first rule

Before adding React state or a custom grid abstraction, check ownership in this order:

1. AG Grid native API/state/event.
2. Row-model-specific API: Infinite Row Model or Enterprise SSRM.
3. Application state only when the grid cannot represent the business meaning.
4. Shared hook/helper only when behavior is genuinely common.

Every remaining custom grid state should be explainable by answering: **why can AG Grid / this row model not own this state?**

## Root GridApi ownership

Each concrete row-model root owns its rendered `<AgGridReact>` and one authoritative `GridApi` reference:

- `TransactionsInfiniteGrid` owns the Infinite `GridApi`;
- `TransactionsSsrmGrid` owns the SSRM `GridApi`.

Native grid information is read from that API when needed. Do not move the authoritative GridApi into a lower presentation component and then mirror filter, sort, pagination, native selection, or other native grid information upward through React state/refs.

Shared behavior such as `useTransactionEditFlows()` receives the root-owned GridApi instead of capturing a second API reference.

`TransactionsPage` and the previous Infinite PageGrid / DatasetGrid / Table component chain were removed because they made GridApi ownership indirect and spread row-model lifecycle behavior across several layers.

The application shell now renders a concrete row-model root directly. Switching between Infinite and SSRM for evaluation is an application/import choice, not a common grid-composition layer.

## Editing state is application-owned

Unsaved transaction edits are keyed by stable backend row ID, not by RowNode or cache position. This is intentional because Infinite/SSRM can evict and recreate RowNodes before a future save action occurs.

```ts
changesById = {
  A: { amount: 50 },
  C: { status: 'Completed' },
};
```

Only fields that differ from their original value remain in this state. Returning a field to its original value removes that field from the eventual update payload.

## Flow 1

A normal direct cell edit changes only its source row. The source row does **not** need to be selected. An explicit Flow 1 action can then propagate the most recently directly edited field/value to either:

- the entire current pagination page; or
- selected rows on the current pagination page.

Selection is a target for the explicit Apply action. Editing a source row never changes its selection.

## Flow 2

Flow 2 is an explicit multi-field edit operation. A future UI may be a modal, drawer, toolbar or another presentation. The UI supplies one or more opted-in field/value pairs and the shared operation applies those values to either:

- the entire current pagination page; or
- selected rows on the current pagination page.

Unchecked/unprovided fields remain unchanged.

## Current page is not cache scope

Both editing flows use the shared `getCurrentPageNodes()` grid helper. A visible pagination page is a user/business scope and must not be widened to whatever Infinite/SSRM cache blocks happen to be loaded. If one expected page row is still unresolved, the operation fails rather than partially editing the page.

## Accumulated edits across pages

Manual edits, Flow 1 and Flow 2 all feed the same row-ID change engine. A user can edit Page 1, move to Page 5, edit more rows, then return later; accumulated edits remain represented even if AG Grid evicted old RowNodes.

## Two different payload concepts

### All local UI edits

Development preview of every changed row, regardless of selection:

```json
{
  "updates": [
    { "id": "A", "changes": { "amount": 100 } },
    { "id": "B", "changes": { "status": "Completed" } }
  ]
}
```

This answers: **what has the user changed in the UI?**

### Backend bulk-edit payload

A future backend Bulk Update action uses:

```text
accumulated edited rows
        ∩
current logical selection
        ↓
backend bulk-edit payload
```

Rules:

- selected but never edited -> omitted;
- edited but not selected -> omitted;
- edited and selected -> included;
- an edited+selected row from another visited page remains eligible;
- Select All does not manufacture edits for untouched rows.

The resulting update contract remains concrete IDs plus concrete changed fields. It does not send the selection `include/exclude` object as the edit payload.

## Selection relationship

Selection and editing remain separate concerns:

- selection tells Flow 1/2 which current-page rows receive an explicit propagated change;
- selection also determines which accumulated edited rows are eligible for a future backend bulk action;
- editing a row does not automatically select it;
- selecting a row does not automatically create an edit.

## Reusable code boundaries

- `useTransactionEditing()` owns accumulated transaction changes and restoration after RowNode reload.
- `useTransactionEditFlows()` owns Flow 1 / Flow 2 current-page targeting and application, using the root-owned GridApi supplied by the concrete grid.
- `getCurrentPageNodes()` is a shared grid pagination primitive used where row-model-independent page boundaries are required.
- `buildSelectedTransactionUpdatePayload()` is a pure helper for `edited ∩ selected` backend payloads.
- `InfiniteCurrentPageSelectionHeader` is shared Infinite-row-model behavior: it reads native page RowNodes and calls native `setNodesSelected()` without storing selected IDs.
- `TransactionEditingControls` is prototype presentation only and is not the editing architecture.

## Row-model boundary after native-state audit

Infinite and SSRM are intentionally not forced through the same selection implementation.

### Infinite current-page/manual selection

AG Grid is the selection source of truth. Stable `getRowId` lets the Infinite Row Model retain row selection through sorting, filtering and cache recreation. The current-page header is only a custom shortcut because Infinite does not provide a usable native server-backed Select All header. It derives its checkbox appearance from native RowNodes and changes selection through native `setNodesSelected()`.

### Infinite filtered/all dataset selection

Application selection state remains deliberate here. Infinite cannot represent Select All across unloaded server rows, nor the `exclude [exceptions]` meaning required for All Filtered / All Records. One compact logical controller owns that unsupported dataset-wide meaning and synchronises only currently materialised RowNodes for checkbox display.

Applied filters are read directly from the Infinite root GridApi when a filtered action payload is built. There is no separate filter-model React state/ref bridge.

### SSRM

Manual selection and All Records remain Enterprise/native and are read through `getServerSideSelectionState()` / written through `setServerSideSelectionState()` where needed. Current Page uses native RowNodes + `setNodesSelected()` because SSRM does not support `selectAll: 'currentPage'`.

Select All Filtered keeps small application state because SSRM does not support `selectAll: 'filtered'` across unloaded rows. The applied filter is still AG Grid-owned and is read directly through the SSRM root GridApi at action time; the previous filtered-selection filter-model ref was removed.

## Preferences

Infinite and SSRM each own native Grid State lifecycle wiring in their root. Preference keys remain separate for the two row models.

The current `browserGridStateStore` uses `localStorage`, but that is only the current storage implementation. The `GridStateStore` boundary is retained so a future profile/preferences API can replace browser storage without redesigning AG Grid state ownership.

## Current implementation checkpoint

The native/state/reuse/root-ownership cleanup is complete for the current foundation. The final Flow 1 / Flow 2 presentation and future backend Bulk Update endpoint remain intentionally deferred until the editing UX discussion resumes.
