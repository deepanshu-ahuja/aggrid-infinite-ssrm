# SSRM Selection Contract

This document is the source of truth for selection when a server-backed table uses AG Grid's **Server-Side Row Model (SSRM)**.

The core rule is:

> Use native SSRM selection wherever AG Grid can represent the product requirement. Add application state only for the missing semantic gap.

Transactions is the current example feature, but the selection mechanics here are intended to be reusable.

---

## 1. Stable row IDs are mandatory

Every row must have stable backend identity:

```ts
getRowId={({ data }) => data.id}
```

Sorting, filtering, pagination and store refresh can move/recreate RowNodes. Identity must not depend on row position.

---

## 2. Native SSRM selection remains native

The native SSRM header checkbox represents **All Records**.

Native server-side selection state can represent unloaded rows:

```ts
{
  selectAll: true,
  toggledNodes: ['A'],
}
```

Meaning:

```text
all records except A
```

Use native APIs such as:

```ts
api.getServerSideSelectionState()
api.setServerSideSelectionState(...)
```

Do not use `getSelectedRows()` as the source of truth for unloaded dataset selection.

---

## 3. Logical selection published to shared/application code

The reusable logical shape is always:

```ts
{
  mode: 'include' | 'exclude',
  ids: string[],
}
```

Native explicit state maps to:

```text
selectAll false + toggledNodes [A, B]
-> include [A, B]
```

Native All Records maps to:

```text
selectAll true + toggledNodes [A]
-> exclude [A]
```

This logical shape contains no serialized `scope`.

---

## 4. Individual/manual selection

Ordinary row checkboxes use native SSRM selection.

Example:

```text
select A and B
-> include [A, B]
```

Sorting and visible filter changes do not automatically clear explicit IDs.

---

## 5. Select Current Page

Current Page is an explicit command over the RowNodes for the current page.

It ultimately produces ordinary explicit selection:

```text
include [ids on current page plus any preserved explicit ids]
```

Page is how the user selected the IDs; it is not a backend selection scope.

If the expected page rows are not available yet, do not partially select an incomplete page. Surface the existing warning/error behavior and leave selection consistent.

---

## 6. Select All Filtered

Select All Filtered is the custom SSRM selection mode in the current product design.

When activated:

```text
current applied filter
+
exclude []
```

means:

```text
all backend rows matching that filter
```

If the user unchecks A:

```text
exclude [A]
```

means:

```text
all matching rows except A
```

The filter itself remains AG Grid-owned. When the real action is built, the root reads `api.getFilterModel()` and the feature translates it through the same mapper used by normal row loading.

Do not maintain a second action-only filter interpretation.

---

## 7. Filter lifecycle

Use the selection meaning, not one blanket reset rule.

```text
native explicit/include
-> preserve on visible filter change

native All Records/exclude
-> preserve on visible filter change

custom Select All Filtered/exclude
-> reset when the defining filter changes
```

The filtered exclusion list belongs to one specific query and must not silently move to a different query.

---

## 8. Sorting and pagination

Sorting changes order, not identity, so it does not clear selection.

Pagination changes visibility, not logical selection, so it does not clear native explicit or All Records selection.

Current Page acts only on the page visible when the command is invoked.

---

## 9. Newly loaded/reloaded rows during custom filtered selection

Custom filtered selection exists beyond currently loaded RowNodes.

When SSRM materialises/replaces rows:

```text
logical filtered selection
-> resolve loaded row ID
-> sync RowNode checkbox programmatically
```

Programmatic checkbox restoration must not feed back into the logical exception state.

---

## 10. Backend action wire contract

The backend does not need `scope`.

### Explicit/manual/current-page

```json
{
  "selection": {
    "mode": "include",
    "ids": ["A", "B"]
  }
}
```

Meaning: exactly A and B.

### Select All Filtered

```json
{
  "selection": {
    "mode": "exclude",
    "ids": ["A"]
  },
  "filters": [
    {
      "field": "status",
      "operator": "equals",
      "value": "Completed"
    }
  ]
}
```

Meaning: all matching backend rows except A.

### All Records

```json
{
  "selection": {
    "mode": "exclude",
    "ids": ["A"]
  }
}
```

Meaning: all records except A.

The frontend still knows internally whether exclude currently represents filtered-wide or all-record selection. That internal row-model context is used only to decide whether translated filters are attached.

---

## 11. Actions and refresh

Selection changes do not call the action endpoint by themselves.

A backend mutation occurs only when the user invokes a real feature action such as the current Transaction status actions.

After success, SSRM uses its own native refresh path:

```ts
api.refreshServerSide();
```

Do not force SSRM to copy Infinite cache behavior just because both use the same backend query contract.

---

## 12. Retry

Datasource failure uses SSRM-native failure bookkeeping.

Retry uses:

```ts
api.retryServerSideLoads();
```

Selection is not cleared merely because a server-side load fails or retries.

---

## 13. Flat-state assumption

The current selection adapter assumes flat SSRM selection with `groupSelects: 'self'`.

If grouping/tree selection is introduced later, do not flatten hierarchical selection into this contract without deliberate backend/product semantics.

---

## 14. Native vs custom ownership

| Behaviour | Owner |
| --- | --- |
| Individual rows | Native AG Grid SSRM |
| Explicit multi-row selection | Native AG Grid SSRM |
| Header All Records | Native AG Grid SSRM |
| Unloaded all-record selection | Native SSRM selection state |
| Current Page command | Small command over native RowNodes |
| All Filtered logical intent | Application state |
| Filtered exclusions | Application state |
| Loaded-row sync during All Filtered | Application -> AG Grid RowNodes |
| Action target construction | Shared grid helper + feature mapper |
| Retry/refresh | Native SSRM APIs |

---

## 15. Rules for future developers and coding assistants

1. Keep stable backend Row IDs.
2. Prefer native SSRM selection before adding custom state.
3. Keep the native header meaning as All Records unless product requirements deliberately change it.
4. Use native server-side selection state for explicit/all-record selection.
5. Treat Current Page as exact IDs, not a backend page scope.
6. Keep custom state only where native SSRM cannot represent the required product meaning.
7. Reset custom All Filtered when its defining filter changes.
8. Preserve native explicit and All Records selection across visible filter changes.
9. Preserve selection across sorting/pagination.
10. Reuse the same feature filter mapper for row loading and filtered actions.
11. Do not serialize redundant `scope` in action payloads.
12. Use SSRM-native retry/refresh APIs; do not copy Infinite lifecycle blindly.
13. Review grouped/hierarchical selection separately if grouping is introduced.
