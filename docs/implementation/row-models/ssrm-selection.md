# SSRM Selection Contract

> Use native SSRM selection wherever AG Grid can represent the required product meaning. Add application state only for the missing semantic gap.

## 1. Stable row IDs

Every row uses stable backend identity:

```ts
getRowId={({ data }) => data.id}
```

Sorting, filtering, pagination and store refresh can move/recreate RowNodes. Identity does not depend on row position.

## 2. Native SSRM selection remains native

The native SSRM header checkbox represents **All Records inside the selection-eligible universe**.

Native server-side selection state can represent unloaded rows compactly:

```ts
{
  selectAll: true,
  toggledNodes: ['A'],
}
```

Meaning for a backend action:

```text
all eligible records except user-deselected A
```

Backend-disabled/read-only rows are outside the selectable universe; they are not added to `toggledNodes` merely because Select All is active.

Native APIs include:

```ts
api.getServerSideSelectionState()
api.setServerSideSelectionState(...)
```

`getSelectedRows()` is not the source of truth for unloaded dataset selection.

## 3. Logical selection published to application code

The logical shape is:

```ts
{
  mode: 'include' | 'exclude',
  ids: string[],
}
```

Native explicit state maps to:

```text
selectAll false + toggledNodes [A, B]
→ include [A, B]
```

Native All Records maps to:

```text
selectAll true + toggledNodes [A]
→ exclude [A]
```

This logical shape contains no serialized `scope` and no disabled-row ID list.

`exclude` IDs are user exceptions, not rows that backend policy made ineligible.

## 4. Individual/manual selection

Ordinary row checkboxes use native SSRM selection.

The concrete grid supplies row policy through native `rowSelection.isRowSelectable`.

Example:

```text
A enabled → can select
B selectionDisabled → cannot select
C readOnly → cannot select
```

Selecting A produces:

```text
include [A]
```

B and C do not become exclusions. Sorting and visible filter changes do not automatically clear explicit eligible IDs.

## 5. Select Current Page

Current Page is an explicit command over the **selectable** RowNodes for the current pagination page.

It produces ordinary explicit selection:

```text
include [eligible ids on current page plus any preserved explicit ids]
```

Disabled RowNodes are not passed into `setNodesSelected()` and are not recorded as exclusions.

Page is how the user selected the IDs; it is not a backend selection scope.

If the expected page rows are not available, the operation does not partially select an incomplete page.

## 6. Select All Filtered

Select All Filtered is the application-owned SSRM selection semantic.

When activated:

```text
current applied filter
+
exclude []
```

means:

```text
all selection-eligible backend rows matching that filter
```

If the user unchecks eligible A:

```text
exclude [A]
```

means:

```text
all eligible matching rows except A
```

Loaded disabled rows are not programmatically selected during filtered reconciliation. Unloaded disabled rows are removed by backend eligibility when the action executes; their IDs are never enumerated into `exclude`.

The filter remains AG Grid-owned. When the selected business action is invoked, the root reads `api.getFilterModel()` and the feature translates it through the same mapper used by normal row loading.

There is no second action-only filter interpretation.

## 7. Filter lifecycle

```text
native explicit/include
→ preserve on visible filter change

native All Records/exclude
→ preserve on visible filter change

custom Select All Filtered/exclude
→ reset when the defining filter changes
```

The filtered exclusion list belongs to one specific query and does not move silently to a different query.

## 8. Sorting and pagination

Sorting changes order, not identity, so it does not clear selection.

Pagination changes visibility, not logical selection, so it does not clear native explicit or All Records selection.

Current Page acts only on the page visible when the command is invoked and only on selectable rows in that page.

## 9. Newly loaded/reloaded rows during filtered selection

Filtered selection exists beyond currently loaded RowNodes.

When SSRM materialises/replaces an eligible row:

```text
logical filtered selection
→ resolve loaded row ID
→ sync RowNode checkbox programmatically
```

When the loaded row is disabled (`node.selectable === false`), reconciliation leaves that RowNode untouched.

Programmatic checkbox restoration does not feed back into the logical exception state.

## 10. Backend action wire contract

The backend payload contains no `scope` and no disabled-row ID list.

### Explicit/manual/current-page

```json
{
  "selection": {
    "mode": "include",
    "ids": ["A", "B"]
  }
}
```

Meaning: selection-eligible rows among exact A and B. Native UI selection should already prevent disabled rows, while backend eligibility remains authoritative for stale/crafted requests.

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

Meaning: eligible matching backend rows except user-deselected A.

### All Records

```json
{
  "selection": {
    "mode": "exclude",
    "ids": ["A"]
  }
}
```

Meaning: all eligible records except user-deselected A.

Internal row-model context determines only whether translated filters are attached to an exclude request.

## 11. Business actions and refresh

Selection changes do not call the action endpoint by themselves.

A backend mutation occurs only when the user invokes a Transaction business action.

Before mutation, the backend applies authoritative row eligibility to the logical target, including rows SSRM never loaded into the browser.

After success, SSRM refreshes through:

```ts
api.refreshServerSide();
```

## 12. Retry

Datasource failure uses SSRM-native failure bookkeeping.

Retry uses:

```ts
api.retryServerSideLoads();
```

Selection is not cleared merely because a server-side load fails or retries.

## 13. Flat-state limitation

The selection adapter assumes flat SSRM selection with `groupSelects: 'self'`.

Grouped/tree selection semantics are not represented by this flat contract.

## 14. Native vs custom ownership

| Behaviour | Owner |
| --- | --- |
| Individual eligible rows | Native AG Grid SSRM |
| Loaded-row selectability | Native AG Grid callback + feature row policy |
| Explicit multi-row selection | Native AG Grid SSRM |
| Header All Records | Native AG Grid SSRM |
| Unloaded all-record selection | Native SSRM selection state + backend eligibility at action time |
| Current Page command | Command over selectable native RowNodes |
| All Filtered logical intent | Application state |
| Filtered user exclusions | Application state |
| Loaded-row sync during All Filtered | Application → eligible AG Grid RowNodes |
| Disabled unloaded rows | Backend eligibility |
| Action target construction | Shared grid helper + feature mapper |
| Retry/refresh | Native SSRM APIs |

## 15. Selection invariants

1. Keep stable backend Row IDs.
2. Prefer native SSRM selection before adding custom state.
3. Native header Select All represents All Records.
4. Use native server-side selection state for explicit and All Records selection.
5. Treat Current Page as exact selectable IDs, not a backend page scope.
6. Disabled rows are outside the selection universe; never manufacture their IDs as include/exclude bookkeeping.
7. Use native `isRowSelectable` for loaded rows and backend eligibility for unloaded rows.
8. Keep custom state only for the All Filtered semantic gap.
9. Reset All Filtered when its defining filter changes.
10. Preserve native explicit and All Records selection across visible filter changes.
11. Preserve selection across sorting and pagination.
12. Reuse the same feature filter mapper for row loading and filtered actions.
13. Do not serialize redundant `scope` in action payloads.
14. Use SSRM-native retry and refresh APIs.
