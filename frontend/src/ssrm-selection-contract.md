# SSRM Selection Contract

This document is the source of truth for Transactions selection when AG Grid uses the **Server-Side Row Model (SSRM)**.

The rule is simple:

> Use AG Grid's native SSRM selection state wherever it can represent the requirement. Add custom application state only for behaviour SSRM does not support.

---

## 1. Stable row IDs are mandatory

Transactions uses the backend ID:

```ts
getRowId={({ data }) => data.id}
```

Sorting, filtering, pagination and store reloads can move/recreate RowNodes, but the Transaction ID remains stable.

---

## 2. Native SSRM header checkbox = All Records

The grid is configured explicitly as:

```ts
rowSelection={{
  mode: 'multiRow',
  headerCheckbox: true,
  selectAll: 'all',
  groupSelects: 'self',
}}
```

For SSRM, native `currentPage` and `filtered` Select-All modes are not supported. The native header therefore remains the **All Records** control.

Native SSRM state can represent unloaded rows:

```ts
{
  selectAll: true,
  toggledNodes: ['A'],
}
```

means:

```text
all records except A
```

Use:

```ts
api.getServerSideSelectionState()
api.setServerSideSelectionState(...)
```

rather than `getSelectedRows()` as the source of truth for dataset-wide selection.

---

## 3. Individual/manual selection

Normal row checkboxes remain native AG Grid SSRM selection.

```text
select A and B
→ selectAll = false
→ toggledNodes = [A, B]
```

Our adapter maps that to:

```text
include [A, B]
```

Sorting/filtering do not automatically clear this selection.

---

## 4. Select Current Page

Because SSRM has no native current-page Select-All mode, the explicit button:

```text
Select current page
```

uses the pagination API to identify the current page and calls native `setNodesSelected()` for those RowNodes.

Ordinary explicit selections are preserved and page IDs are added.

If native All Records or custom All Filtered is active, clicking Current Page intentionally switches back to explicit selection first.

If the expected page RowNodes are still unresolved/loading, the command does **not** partially select the page. It shows a warning and leaves selection unchanged.

---

## 5. Select All Filtered

This is the one custom SSRM dataset-selection mode.

When the user clicks:

```text
Select all filtered
```

the application:

1. clears competing native selection;
2. captures AG Grid's currently applied filter model;
3. stores logical `exclude + []`;
4. synchronises currently loaded matching RowNodes for checkbox feedback.

Example:

```text
filter = Status = Completed
Select all filtered
→ exclude []
```

User unchecks A:

```text
→ exclude [A]
```

Future bulk-action meaning:

```text
all backend rows matching Status = Completed except A
```

The same `mapTransactionFilterModel()` used by normal row loading maps the filter for bulk actions.

---

## 6. Newly loaded SSRM rows during filtered Select All

Unloaded matching rows are represented logically by `exclude`.

When SSRM later loads/reloads RowNodes:

```text
onModelUpdated
→ iterate loaded RowNodes
→ resolve selection by ID
→ node.setSelected(..., 'api')
```

`onRowSelected` ignores `source='api'` so checkbox restoration does not feed back into the exception list.

---

## 7. Filter lifecycle

### Native manual selection

Preserve.

### Native All Records

Preserve. A visible filter does not redefine “all records”.

### Custom All Filtered

Clear when the defining filter changes:

```text
Status = Completed
exclude [A]

change filter to Failed
→ include []
```

The user must click Select All Filtered again for the new query.

---

## 8. Sorting and pagination

Sorting never clears selection because it changes order, not identity.

Pagination never clears native explicit or native All Records selection.

The Current Page button acts only on the page visible when the user clicks it.

---

## 9. Native SSRM state adapter

Flat native SSRM state maps to the same logical contract used by bulk builders:

```text
selectAll false + toggledNodes [A,B]
→ include [A,B]

selectAll true + toggledNodes [A]
→ exclude [A]
```

Transactions explicitly uses `groupSelects: 'self'` so this adapter expects flat selection state.

If grouping/tree selection is introduced later, do not flatten hierarchical SSRM state. Review the selection/backend contract deliberately.

---

## 10. Payload preview

The temporary `Preview selection payload` button performs no backend bulk action.

Native explicit/current-page:

```json
{
  "mode": "include",
  "ids": ["A", "B"]
}
```

Native All Records:

```json
{
  "mode": "exclude",
  "ids": ["A"],
  "filters": []
}
```

Custom All Filtered:

```json
{
  "mode": "exclude",
  "ids": ["A"],
  "filters": [
    {
      "field": "status",
      "operator": "equals",
      "value": "Completed"
    }
  ]
}
```

---

## 11. Retry

Datasource failure continues to use SSRM-native failure bookkeeping (`params.fail()`).

Retry uses:

```ts
api.retryServerSideLoads();
```

Do not rebuild the datasource or maintain a second failed-block registry.

Selection is not cleared merely because a server-side load fails/retries.

---

## 12. Native vs custom boundary

| Behaviour                           | Owner                              |
| ----------------------------------- | ---------------------------------- |
| Individual rows                     | Native AG Grid SSRM                |
| Explicit multi-row selection        | Native AG Grid SSRM                |
| Header Select All Records           | Native AG Grid SSRM                |
| Unloaded all-record selection       | Native SSRM selection state        |
| Current-page button                 | Small command over native RowNodes |
| All-filtered dataset intent         | Application state                  |
| Filtered exclusions                 | Application state                  |
| Loaded-row sync during All Filtered | Application → AG Grid RowNodes     |
| Failed-load retry                   | Native SSRM                        |

---

## 13. Rules for future developers and coding assistants

1. Keep stable backend Row IDs.
2. Keep the native SSRM header as All Records.
3. Do not configure SSRM header Select All as `currentPage` or `filtered`.
4. Use native SSRM selection state for manual/all-record selection.
5. Use current-page RowNodes for the explicit page command.
6. Keep custom state only for All Filtered.
7. Capture the defining filter model when All Filtered is activated.
8. Reset custom All Filtered when that filter changes.
9. Preserve native All Records across visible filter changes.
10. Preserve selection on sorting/pagination.
11. Reuse `mapTransactionFilterModel()` for filtered bulk actions.
12. Use `retryServerSideLoads()` for SSRM retry.
13. Reject hierarchical SSRM state until grouping semantics are deliberately supported.
14. Prefer AG Grid native APIs before adding custom state.
