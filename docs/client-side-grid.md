# Client-Side Row Model foundation

This document is the source of truth for the reusable Client-Side Row Model baseline and its relationship to the existing Infinite and SSRM implementations.

The core rule is:

> Same user-facing capability does not imply the same row-model implementation.

Client-Side Row Model receives the complete bounded working set in browser memory. AG Grid can therefore own sorting, filtering, pagination, selection and local export directly. Infinite and SSRM solve different data-loading problems and keep their server-specific mechanics.

## When to use Client-Side Row Model

Use this foundation when the application can reasonably fetch the complete working set into browser memory and wants AG Grid to perform local shaping.

Current Transactions demo flow:

```text
GET /api/transactions/
        ↓
TanStack Query authoritative collection cache
        ↓
shallow editable row copies
        ↓
AG Grid rowData
        ↓
native client sorting/filtering/pagination/selection
```

Do **not** choose Client-Side merely to avoid designing a server query API for an unbounded or very large dataset. Infinite/SSRM remain the correct foundation when the browser should not hold the complete query universe.

## Capability matrix

| Capability | Client-Side | Infinite | SSRM | Ownership / important difference |
| --- | --- | --- | --- | --- |
| Data loading | Full bounded collection once | Backend blocks | Backend blocks/stores | Client uses TanStack Query; server row models use AG Grid datasource lifecycle |
| Sorting | Native local | Backend query | Backend query | Same column UI, different data owner |
| Filtering | Native local | Backend query | Backend query | Client does not inherit server filter-contract restrictions |
| Pagination | Native local | Native page over server blocks | Native page over SSRM store | Page meaning is shared; loading mechanics are not |
| Manual selection | Native | Native loaded-row selection | Native SSRM selection | Stable backend IDs everywhere |
| Select Current Page | Native `selectAll: 'currentPage'` | Custom header over concrete page RowNodes | Explicit concrete page RowNodes | Client has a native exact implementation |
| Select All Filtered | Native `selectAll: 'filtered'` | Logical unloaded-row selection | Custom filtered-wide semantic | Filter-dependent selection resets when its defining filter changes |
| Select All Records | Native `selectAll: 'all'` | Logical unloaded-row selection | Native SSRM All Records | Client needs no include/exclude dataset representation |
| Selected count | Exact native selected rows | Exact IDs or API universe minus exceptions | Exact/native or API universe minus exceptions | Client count is eligibility-exact because every selected row is concrete/selectable |
| `selectionDisabled` / `readOnly` | Native `isRowSelectable` excludes both | Native loaded guard + backend authority | Native loaded guard + backend authority | Backend still defends selected business operations |
| Tracked editing | Shared stable-ID tracked edits | Shared | Shared | Client rowData refresh replaces objects; server models recreate cache/store rows |
| Save one / Save selected dirty | Shared backend mutation lifecycle | Shared | Shared | Concrete root reconciles authoritative persisted rows differently |
| BASE / LOCAL / REMOTE conflicts | Shared | Shared | Shared | Client protects authoritative TanStack cache from in-cell mutation |
| Selected status action | Explicit selected IDs | Logical include/exclude target | Native/custom logical target | Backend operation contract remains authoritative |
| Export Current Page | Native CSV over exact page | Same shared page helper | Same shared page helper | Page snapshot includes restricted rows if displayed |
| Export Selected | Native local CSV | Backend selected export | Backend selected export | Client already has all selected rows locally |
| Grid State preferences | Native Grid State slices | Same | Same | Selection remains transient business state |
| Server cache/block logic | N/A | Required | Required | Never import this machinery into Client-Side |

## Complete collection API

Client-Side uses:

```http
GET /api/transactions/
```

The response is the complete serialized Transaction array for the current bounded working set.

This endpoint is intentionally separate from:

```http
POST /api/transactions/query/
```

The query endpoint exists for server-backed offset/limit/sort/filter loading. Calling it with an artificial giant `limit` would leak server-grid paging concepts into Client-Side and is specifically avoided.

The demo dataset currently contains 750 rows. A real product should revisit the row-model choice when its working set is no longer reasonable to transfer and hold in browser memory.

## TanStack Query ownership and editable row copies

TanStack Query owns the authoritative Client collection cache.

AG Grid does **not** receive those exact cached object references. `useClientTransactions()` shallow-copies each row before supplying `rowData`.

Why:

```text
Query cache row
= REMOTE / authoritative value

AG Grid editable row copy
= browser presentation + LOCAL cell mutations
```

AG Grid Client-Side editing mutates row data in memory. If the grid edited the Query cache object directly, the application would lose the untouched authoritative value needed for BASE / LOCAL / REMOTE reconciliation.

After explicit Save succeeds, the backend-authoritative returned rows are merged into the Query cache. The next rowData projection contains those authoritative values and any recomputed `interactionMode` / `interactionReason`.

Selection-based status mutation currently returns only `updatedCount`, so the Client collection is refetched after that operation.

## Native sorting and filtering

Once `rowData` is loaded, AG Grid owns local sorting/filtering.

No backend request is made because a user:

- changes column sort;
- applies a column filter;
- moves to another pagination page.

The Transaction domain columns are shared, but Client-Side intentionally does **not** reuse `serverTextFilterParams`, `serverNumberFilterParams` or `serverDateFilterParams`.

Those presets restrict the server grids to operators/condition shapes supported by the Django query contract. Client-Side is not constrained by that transport contract and uses native local filter behavior.

## Native Client selection

Client selection is configured through AG Grid `rowSelection`.

Product scopes map directly to native Client-Side behavior:

```text
page
→ rowSelection.selectAll = 'currentPage'

filtered
→ rowSelection.selectAll = 'filtered'

all
→ rowSelection.selectAll = 'all'
```

`isTransactionRowSelectable` remains the feature adapter for backend-provided interaction policy. AG Grid's header checkbox therefore selects only rows whose `interactionMode` is `enabled`.

### Why Client does not use include/exclude dataset state

All Client rows are already in browser memory. Native AG Grid selection can enumerate the selected row objects exactly.

Business target:

```ts
{
  mode: 'include',
  ids: ['txn-a', 'txn-b']
}
```

There is no need for:

```text
exclude []
→ "everything, including rows the browser has never loaded"
```

That compact representation solves a server-row-model problem and is intentionally not copied into Client-Side.

## Filter-dependent selection reset

The project-wide product rule still applies:

```text
Filter = Pending
Select All Filtered
→ means the Pending filtered universe

Filter changes to Failed
→ clear that old filtered-wide selection
```

Native Client selection is used to create the selection, but the small application semantic above calls native `api.deselectAll()` when the defining filter changes while Client scope is `filtered`.

`page` and `all` scopes are not cleared merely because a filter changes.

## Selected count and eligibility

Client selected count is exact:

```text
selected count
= api.getSelectedRows().length
```

Because the complete working set is local and AG Grid honors `isRowSelectable`, `selectionDisabled` and `readOnly` rows do not enter native Client selection.

This differs from the documented server-wide count limitation. Infinite/SSRM All Records / All Filtered counts can include backend-ineligible unloaded rows because their normal `totalCount` / `filteredCount` metadata describes query membership rather than exact selection eligibility.

The backend still re-checks eligibility for Client selected business actions as defence in depth in case policy changes between selection and mutation.

## Selected status action

Client selected rows are sent to the same backend selected-action endpoint as explicit IDs:

```json
{
  "selection": {
    "mode": "include",
    "ids": ["txn-a", "txn-b"]
  },
  "filters": [],
  "changes": {
    "status": "Failed"
  }
}
```

No Client FilterModel is translated into the backend request because the Client can enumerate the exact selected IDs. This keeps local grid filtering independent from server-query translation.

The backend remains authoritative for eligibility and mutation policy.

## Editing and conflicts

Client reuses the same stable-ID tracked editing and BASE / LOCAL / REMOTE state machine as Infinite and SSRM.

The lifecycle difference is authoritative data arrival:

```text
Client
TanStack Query cache changes
→ new rowData objects
→ onRowDataUpdated
→ reconcile REMOTE with tracked drafts
→ restore remaining LOCAL overlays

Infinite / SSRM
server cache/store rows refresh/recreate
→ row-model lifecycle event
→ reconcile REMOTE with tracked drafts
→ restore remaining LOCAL overlays
```

The state machine is shared because its semantics are shared. The row-model event/source of fresh authoritative data remains concrete-root-specific.

See:

- `docs/transaction-editing.md`
- `docs/edit-conflict-reconciliation.md`

## Export behavior

### Export Current Page

Client reuses the shared native page-export helper:

```text
native pagination model
→ exact current-page RowNodes
→ api.exportDataAsCsv(...)
```

This is a page snapshot. `selectionDisabled` / `readOnly` rows are included if they are displayed on that page.

### Export Selected

Client Selected export stays completely local:

```text
native Client selection
→ api.exportDataAsCsv({
     onlySelected: true,
     onlySelectedAllPages: true
   })
```

`onlySelectedAllPages` matters because selected rows can exist on several pagination pages.

Client does **not** call `POST /api/transactions/selection/export/` for this operation. That endpoint exists because Infinite/SSRM selected universes can contain unloaded rows.

Since restricted Client rows cannot enter native selection, local Selected export naturally contains selected eligible rows only.

## Grid State

Client reuses the existing native Grid State persistence boundary for durable view preferences such as:

- column order/pinning/sizing/visibility;
- filters;
- sort.

Pagination and row selection remain intentionally transient under the current application contract.

## Current limitations / non-goals

The first Client foundation intentionally does not add:

- server-side block loading;
- include/exclude unloaded selection state;
- SSRM selection-state APIs;
- backend selected export;
- import/upload;
- grouping/pivot/aggregation product semantics;
- a universal wrapper around the three grid roots.

Import remains a separate later workflow.

## Implementation map

```text
backend/apps/transactions/api/client_views.py
backend/apps/transactions/services.py
→ complete Client collection API

frontend/src/features/transactions/api/transactions.queries.ts
→ TanStack Query collection ownership + authoritative cache reconciliation

frontend/src/shared/grid/config/clientSideGridDefaults.ts
→ Client-only pagination defaults

frontend/src/shared/grid/selection/client-side/useClientSideSelectionController.ts
→ native Page / Filtered / All selection + renderable count

frontend/src/shared/grid/export/exportSelectedRowsCsv.ts
→ native local selected CSV across pages

frontend/src/features/transactions/grid/TransactionsClientGrid.tsx
→ concrete Client root

frontend/src/features/transactions/grid/transactionColumns.tsx
→ shared Transaction domain columns with row-model-specific filter parameters
```

## Manual verification

Manual testing can be performed later as part of the consolidated grid regression pass. Do not mark it complete unless the browser scenarios were actually run.

When testing `/client`, verify at least:

1. Initial load performs one `GET /api/transactions/` and renders the full collection through Client-Side Row Model.
2. Sorting, filtering and pagination changes do not trigger row-query API requests.
3. Test `selectionScope: 'page'`, `'filtered'` and `'all'`; header selection matches the native scope.
4. `selectionDisabled` and `readOnly` rows cannot be selected; `selectionDisabled` remains individually editable and `readOnly` does not.
5. In filtered scope, change the filter after Select All Filtered and confirm the old selection clears.
6. Selected count equals the exact native selected rows.
7. Row Save and Save Selected Dirty persist only the intended explicit drafts and update authoritative row policy when backend values change it.
8. BASE / LOCAL / REMOTE conflict scenarios still behave like the server-backed grids after a collection refetch.
9. Export Current Page contains exactly the current displayed page and includes restricted rows when displayed.
10. Export Selected includes selected rows across pagination pages, excludes unselected/restricted rows, and makes no selected-export backend request.
11. Selected status action sends explicit selected IDs with no backend filter payload and refreshes authoritative Client rowData.
12. Grid State restores the documented view preferences without persisting business selection.
13. Navigation/remount/teardown produces no destroyed-GridApi warning.

A successful Client run does not replace the still-pending Infinite/SSRM manual regression; all three can be consolidated later when manual verification is scheduled.
