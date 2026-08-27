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

Shared behavior such as `useCurrentPageEditActions()` receives the root-owned GridApi instead of capturing a second API reference.

The application shell renders a concrete row-model root directly. Switching between Infinite and SSRM for evaluation is an application/import choice, not a common grid-composition layer.

## Editing state is application-owned

Unsaved transaction edits are keyed by stable backend row ID, not by RowNode or cache position. This is intentional because Infinite/SSRM can evict and recreate RowNodes before a future save action occurs.

```ts
changesById = {
  A: { amount: 50 },
  C: { status: 'Completed' },
};
```

Only fields that differ from their original value remain in this state. Returning a field to its original value removes that field from the eventual update payload.

The reusable engine is `useTrackedGridEditing(...)`. Transactions supplies only its editable fields, row identity/value accessors and row-editability predicate.

## Row-level interaction policy

Editing eligibility is separate from selection eligibility.

Transactions currently receives a backend-provided interaction mode:

```text
enabled
-> selectable and editable

selectionDisabled
-> not selectable / not part of selection-based bulk actions
-> still editable

readOnly
-> not selectable / not part of selection-based bulk actions
-> not editable
```

Editable columns use AG Grid's native `editable` callback. The shared tracked-edit engine also receives the same feature-owned row-editability predicate because Flow 1/2 and draft restoration write through RowNode APIs and must not bypass a read-only row.

A selection-disabled row can still be edited directly or by a page-level edit operation. A read-only row is skipped by programmatic edit application/restoration, does not expose modifying row Save/Discard controls, and is rejected by backend detail/bulk persistence if a stale or crafted request still targets it.

See `docs/row-interaction.md` for the complete reusable policy.

## Flow 1

A normal direct cell edit changes only its source row. The source row does **not** need to be selected. An explicit Flow 1 action can then propagate the most recently directly edited field/value to either:

- editable rows on the entire current pagination page; or
- editable selected rows on the current pagination page.

Selection is a target for the explicit Apply action. Editing a source row never changes its selection.

## Flow 2

Flow 2 is an explicit multi-field edit operation. A future UI may be a modal, drawer, toolbar or another presentation. The UI supplies one or more opted-in field/value pairs and the shared operation applies those values to either:

- editable rows on the entire current pagination page; or
- editable selected rows on the current pagination page.

Unchecked/unprovided fields remain unchanged. Read-only rows are not valid edit targets even when they are currently materialised in the page.

## Current page is not cache scope

Both editing flows use the shared `getCurrentPageNodes()` grid helper. A visible pagination page is a user/business scope and must not be widened to whatever Infinite/SSRM cache blocks happen to be loaded. If one expected page row is still unresolved, the operation fails rather than partially resolving the page.

After page resolution, the tracked-edit engine applies changes only to rows for which the feature row-editability predicate allows editing.

## Accumulated edits across pages

Manual edits, Flow 1 and Flow 2 all feed the same row-ID change engine. A user can edit Page 1, move to Page 5, edit more rows, then return later; accumulated edits remain represented even if AG Grid evicted old RowNodes.

Draft restoration after a row reload happens only while that backend row remains editable. A backend row that is now read-only must not receive a programmatic draft write merely because local draft state exists.

## Two different payload concepts

### All local UI edits

Every changed row can be represented as concrete updates regardless of current selection:

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

The implemented backend Bulk Update action uses:

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
- Select All does not manufacture edits for untouched rows;
- read-only backend rows are rejected if they somehow appear in an explicit persistence request.

The resulting update contract remains concrete IDs plus concrete changed fields. It does not send the selection `include/exclude` object as the edit payload.

## Persistence endpoints

Editing persistence and logical selection business actions intentionally use different backend contracts:

```text
PATCH /api/transactions/{id}/
-> save one explicit dirty row
-> backend rejects read-only target

PATCH /api/transactions/bulk/
-> save many explicit dirty-row patches
-> backend validates all rows before mutation and rejects read-only targets atomically

PATCH /api/transactions/selection/
-> apply one business change to the logical include/exclude selection,
   including unloaded server-backed rows
-> backend removes selection-ineligible rows from the target
```

`/bulk/` persists concrete edits already present in `changesById`; it does not reinterpret `include/exclude` selection as a dataset-wide edit instruction.

`/selection/` is a separate business-action path. It receives the compact logical selection plus translated filters when the target is Select All Filtered. Selection-disabled/read-only rows are outside that selection universe and are not serialized as exception IDs.

Keeping these contracts separate prevents local draft persistence from being confused with dataset-wide selection actions.

## Selection relationship

Selection and editing remain separate concerns:

- selection tells Flow 1/2 which current-page rows receive an explicit propagated change when target=`selected`;
- selection also determines which accumulated edited rows are eligible for backend bulk persistence;
- editing a row does not automatically select it;
- selecting a row does not automatically create an edit;
- selection-disabled rows may still be edited, which is why editability must not be inferred from checkbox state;
- read-only rows are neither selectable nor editable.

## Reusable code boundaries

- `useTrackedGridEditing(...)` owns generic accumulated changes, RowNode restoration and programmatic edit application.
- `useCurrentPageEditActions(...)` owns Flow 1 / Flow 2 current-page targeting/application using the root-owned GridApi.
- `useCurrentPageRowTarget(...)` / `getCurrentPageNodes()` are shared action-neutral current-page resolution primitives.
- `buildSelectedTrackedGridUpdatePayload(...)` is the generic pure helper for `edited ∩ logical selection` backend payloads.
- `InfiniteCurrentPageSelectionHeader` is shared Infinite-row-model behavior: it reads native page RowNodes and calls native selection APIs without storing selected IDs.
- `GridRowInteractionMode` and its predicates under `shared/grid/rows` describe generic selectable/editable/read-only effects; Transactions owns the mapping from its backend row data.
- `TransactionEditingControls` is current presentation, not the editing architecture.

## Row-model boundary after native-state audit

Infinite and SSRM are intentionally not forced through the same selection implementation.

### Infinite current-page/manual selection

AG Grid is the selection source of truth. Stable `getRowId` lets the Infinite Row Model retain row selection through sorting, filtering and cache recreation. The current-page header is only a custom shortcut because Infinite does not provide a usable native server-backed Select All header. It derives its checkbox appearance from selectable native RowNodes and changes selection through native selection APIs.

### Infinite filtered/all dataset selection

Application selection state remains deliberate here. Infinite cannot represent Select All across unloaded server rows, nor the `exclude [exceptions]` meaning required for All Filtered / All Records. One compact logical controller owns that unsupported dataset-wide meaning and synchronises only currently materialised eligible RowNodes for checkbox display.

Disabled rows are not added as exclusion IDs. Applied filters are read directly from the Infinite root GridApi when a filtered action payload is built. There is no separate filter-model React state/ref bridge.

### SSRM

Manual selection and All Records remain Enterprise/native and are read through `getServerSideSelectionState()` / written through `setServerSideSelectionState()` where needed. Current Page uses eligible native RowNodes + `setNodesSelected()` because SSRM does not support `selectAll: 'currentPage'`.

Select All Filtered keeps small application state because SSRM does not support `selectAll: 'filtered'` across unloaded rows. The applied filter is still AG Grid-owned and is read directly through the SSRM root GridApi at action time; the filtered-selection filter-model ref is unnecessary.

## Preferences

Infinite and SSRM each own native Grid State lifecycle wiring in their root. Preference keys remain separate for the two row models.

The current `browserGridStateStore` uses `localStorage`, but that is only the current storage implementation. The `GridStateStore` boundary is retained so a future profile/preferences API can replace browser storage without redesigning AG Grid state ownership.

## Current implementation checkpoint

The native/state/reuse/root-ownership cleanup, current editing persistence paths, and reusable selection-disabled/read-only row policy are implemented for the grid foundation. Single-row Save uses the detail endpoint and aggregate Save uses the explicit bulk endpoint described above. The final Flow 1 / Flow 2 presentation remains intentionally undecided.

The remaining product-level editing question is how a server-side logical-selection action should interact with conflicting unsaved local drafts. That policy must be chosen deliberately rather than hidden inside shared grid code.
