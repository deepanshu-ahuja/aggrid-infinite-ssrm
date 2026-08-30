# SSRM Native Editing Spike — Manual Verification

Route: `/ssrm-native-editing`

This route is an isolated comparison target. The existing `/ssrm` implementation is intentionally unchanged.

## Architecture under test

```text
SSRM datasource
    ↓
AG Grid RowNodes
    ↓
native editing / Cell Selection / Fill Handle
    ↓
cellValueChanged
    ↓
BASE + LOCAL only for actually dirty fields
```

There is no copied API-response block cache and no BASE/LOCAL/REMOTE conflict state.

AG Grid owns normal cell editing, Cell Selection, Ctrl/Cmd+D Copy Range Down, Ctrl/Cmd+Enter Bulk Cell Edit, Fill Handle, and editor validation presentation. The draft layer owns first BASE, latest unsaved LOCAL, dirty row/cell counts, selected ∩ dirty payloads, reapplying LOCAL after SSRM RowNode recreation, acknowledgement, and discard cleanup.

## Single edit / true revert

1. Edit one editable cell and commit a valid value.
2. Confirm the cell receives dirty styling and row/cell counts increase.
3. Edit a second field in the same row; edited rows must remain 1 while edited cells becomes 2.
4. Put one field back to its exact BASE value; only that field becomes clean.
5. Put the last changed field back to BASE; the row draft disappears completely.

## Save Selected = selected ∩ dirty

1. Make three rows dirty.
2. Select ten rows, including only two dirty rows.
3. Click `Save selected edits (2)` and inspect the PATCH request.

Expected: only the two selected dirty rows are sent; unchanged selected rows and the unselected dirty row are omitted. The unselected dirty row stays dirty after success.

## Ctrl/Cmd+D

1. Put a valid value in the top editable cell.
2. Select that cell and cells below it in the same column.
3. Press Ctrl+D / Cmd+D.

Expected: AG Grid copies the top value down and each real change flows through `cellValueChanged`; no custom Apply Last Edit flow participates.

## Ctrl/Cmd+Enter

1. Select several editable cells in one column.
2. Start editing the focused cell and enter a valid value.
3. Press Ctrl+Enter / Cmd+Enter.

Expected: AG Grid applies the value to editable cells in the selected range. For the custom Account editor, verify the shortcut reaches AG Grid rather than being swallowed by the MUI input.

## Fill Handle

1. Select an editable cell.
2. Drag the Fill Handle vertically across rows.

Expected: AG Grid performs the fill and changed cells are captured by the same dirty tracker. Non-editable targets remain unchanged.

## Native validation

Provided editor: enter an Amount outside 0–1,000,000 or invalid Currency and try to finish. Custom editor: clear Account or Transaction date and try to finish.

Expected with `invalidEditValueMode="block"`: AG Grid keeps invalid editor state active and presents validation feedback; an invalid edit that never commits does not become a dirty draft. Custom MUI editors provide errors through `useGridCellEditor({ getValidationErrors, getValidationElement })`.

## SSRM RowNode recreation

1. Make a row dirty.
2. Navigate far enough to recreate/evict its SSRM RowNode/store.
3. Return.

Expected: the LOCAL draft is reapplied and counts stay stable. Only edited BASE + LOCAL fields were retained; no fetched server blocks were copied into React.

## Discard

Make selected rows dirty and click `Discard selected edits`.

Expected: selected draft entries are removed, SSRM is refreshed, server values return, and unselected dirty rows remain dirty. Discard deliberately refreshes authoritative data rather than treating stored BASE as the latest server cache.

## No conflict flow

This spike intentionally has no conflict popover or BASE/LOCAL/REMOTE reconciliation. A refreshed dirty row gets its LOCAL draft reapplied until Save or Discard removes it. This matches the exclusive claimed-task editing workflow being evaluated.
