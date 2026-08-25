# Transaction editing

This document records the editing decisions for the Transactions grid while the UI is still a prototype.
It is kept separate from the visual implementation so Flow 1 and Flow 2 can later move to completely
different components without changing the underlying behavior.

## Native-first rule

Before adding React state or a custom grid abstraction, check ownership in this order:

1. AG Grid native API/state/event.
2. Row-model-specific API: Infinite Row Model or Enterprise SSRM.
3. Application state only when the grid cannot represent the business meaning.
4. Shared hook/helper only when behavior is genuinely common.

Every remaining custom grid state should be explainable by answering: **why can AG Grid / this row model
not own this state?**

## Editing state is application-owned

Unsaved transaction edits are keyed by stable backend row ID, not by RowNode or cache position. This is
intentional because Infinite/SSRM can evict and recreate RowNodes before a future save action occurs.

```ts
changesById = {
  A: { amount: 50 },
  C: { status: 'Completed' },
};
```

Only fields that differ from their original value remain in this state. Returning a field to its original
value removes that field from the eventual update payload.

## Flow 1

A normal direct cell edit changes only its source row. The source row does **not** need to be selected.
An explicit Flow 1 action can then propagate the most recently directly edited field/value to either:

- the entire current pagination page; or
- selected rows on the current pagination page.

Selection is a target for the explicit Apply action. Editing a source row never changes its selection.

## Flow 2

Flow 2 is an explicit multi-field edit operation. A future UI may be a modal, drawer, toolbar or another
presentation. The UI supplies one or more opted-in field/value pairs and the shared operation applies
those values to either:

- the entire current pagination page; or
- selected rows on the current pagination page.

Unchecked/unprovided fields remain unchanged.

## Current page is not cache scope

Both editing flows use the shared `getCurrentPageNodes()` grid helper. A visible pagination page is a
user/business scope and must not be widened to whatever Infinite/SSRM cache blocks happen to be loaded.
If one expected page row is still unresolved, the operation fails rather than partially editing the page.

## Accumulated edits across pages

Manual edits, Flow 1 and Flow 2 all feed the same row-ID change engine. A user can edit Page 1, move to
Page 5, edit more rows, then return later; accumulated edits remain represented even if AG Grid evicted
old RowNodes.

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

The resulting update contract remains concrete IDs plus concrete changed fields. It does not send the
selection `include/exclude` object as the edit payload.

## Selection relationship

Selection and editing remain separate concerns:

- selection tells Flow 1/2 which current-page rows receive an explicit propagated change;
- selection also determines which accumulated edited rows are eligible for a future backend bulk action;
- editing a row does not automatically select it;
- selecting a row does not automatically create an edit.

## Reusable code boundaries

- `useTransactionEditing()` owns accumulated transaction changes and restoration after RowNode reload.
- `useTransactionEditFlows()` owns Flow 1/Flow 2 current-page targeting and application.
- `getCurrentPageNodes()` is a shared grid pagination primitive used where row-model-independent page
  boundaries are required.
- `buildSelectedTransactionUpdatePayload()` is a pure helper for `edited ∩ selected` backend payloads.
- `TransactionEditingControls` is prototype presentation only and is not the editing architecture.

## Row-model boundary

Infinite and SSRM must not be forced through the same selection implementation.

- Infinite: use native row selection where supported; custom state is justified only for behavior the
  Infinite Row Model cannot represent, especially dataset-wide Select All across unloaded rows.
- SSRM: prefer Enterprise server-side selection state (`getServerSideSelectionState()` /
  `setServerSideSelectionState()`) for unloaded/native selection. Custom logic is reserved for unsupported
  semantics such as Select All Filtered or Current Page behavior where documented by AG Grid.

The SSRM editing bridge should be added only after the native-selection audit is complete.
