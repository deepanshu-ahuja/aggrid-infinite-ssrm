# Client-Side Row Model implementation guide

This document is the current source of truth for the repository's AG Grid **Client-Side Row Model** implementation.

Its scope is Client-Side only. Shared capabilities such as editing, conflicts, row interaction and export are linked where useful, but this guide does not compare or document other row-model implementations.

## When Client-Side Row Model is appropriate

Use this foundation when the complete working set is reasonably bounded and can be held in browser memory.

Current Transactions flow:

```text
GET /api/transactions/
        ↓
TanStack Query authoritative collection cache
        ↓
shallow editable row copies
        ↓
AG Grid rowData
        ↓
native local sorting/filtering/pagination/selection
```

The current demo dataset contains 750 rows. A real product should reconsider this row model when its working set is no longer reasonable to transfer and hold in browser memory.

## Complete collection API

Client-Side uses:

```http
GET /api/transactions/
```

The response is the complete serialized Transaction array for the current bounded working set.

Client-Side does not call the paged query endpoint with an artificial large limit. Its data contract is a complete collection because AG Grid owns local shaping after the data arrives.

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

AG Grid editing mutates row data in memory. If the grid edited the Query cache object directly, the application would lose the untouched authoritative value needed for BASE / LOCAL / REMOTE reconciliation.

After explicit Save succeeds, backend-authoritative returned rows are merged into the Query cache. The next `rowData` projection contains those authoritative values and any recomputed `interactionMode` / `interactionReason`.

The current selected Change Status mutation returns `updatedCount`, so the Client collection is refetched after that operation.

## Native sorting, filtering and pagination

Once `rowData` is loaded, AG Grid owns local sorting, filtering and pagination.

No backend row-query request is made when the user:

- changes column sort;
- applies a column filter;
- moves to another pagination page.

Client columns use native local filter behavior rather than transport-oriented filter restrictions that are unnecessary for an in-memory dataset.

## Native Client selection

Client selection is configured through AG Grid `rowSelection`.

Supported scopes map directly to native Client-Side behavior:

```text
page
→ rowSelection.selectAll = 'currentPage'

filtered
→ rowSelection.selectAll = 'filtered'

all
→ rowSelection.selectAll = 'all'
```

The Transactions `/client` demo currently defaults to `selectionScope: 'all'`. The same controller also supports `page` and `filtered`.

`isTransactionRowSelectable` adapts backend-provided row interaction policy to AG Grid's native row-selectability callback. The header checkbox therefore selects only rows whose `interactionMode` is `enabled`.

### Selection target

All Client rows are already in browser memory, so native AG Grid selection can enumerate the exact selected IDs.

The business target is therefore an explicit include target:

```ts
{
  mode: 'include',
  ids: ['txn-a', 'txn-b'],
}
```

Client does not need a separate dataset-wide unloaded-row selection representation.

## Filter-dependent selection reset

When Client scope is `filtered`, Select All Filtered is defined by the current filter universe.

```text
Filter = Pending
Select All Filtered
→ selected Pending rows

Filter changes to Failed
→ clear the previous filtered-wide selection
```

The controller calls native `api.deselectAll()` for that transition.

`page` and `all` scopes are not cleared merely because the visible filter changes.

## Selected count and eligibility

Client selected count is exact:

```text
selected count
= api.getSelectedRows().length
```

Because the complete working set is local and AG Grid honors `isRowSelectable`, `selectionDisabled` and `readOnly` rows do not enter native Client selection.

For the current deterministic 750-row Transactions demo, the backend interaction policy produces:

```text
750 total rows
- 63 selectionDisabled rows
- 63 readOnly rows
= 624 selectable rows
```

With the current default `all` scope, selecting the header checkbox should therefore show **624 selected**. If the demo interaction-policy rules change, this expected number must change with them; the invariant is exact native selectable selection.

The backend still re-checks eligibility for selected business actions as defence in depth.

## Selected Change Status action

Client selected rows are sent as exact IDs:

```json
{
  "selection": {
    "mode": "include",
    "ids": ["txn-a", "txn-b"]
  },
  "changes": {
    "status": "Failed"
  }
}
```

No filter payload is required because the exact selected IDs fully define the target.

On successful Change Status:

```text
backend succeeds
→ Client selection controller clearSelection()
→ refetch authoritative collection
```

On failure, the success callback does not run and selection remains available.

See [Selected business-action lifecycle](../selected-action-selection-lifecycle.md).

## Editing and conflicts

Client uses the shared stable-ID tracked editing state while its authoritative-data lifecycle remains Client-specific.

```text
TanStack Query cache changes
→ new rowData objects
→ onRowDataUpdated
→ reconcile REMOTE with tracked drafts
→ restore remaining LOCAL overlays
```

Unsaved drafts remain outside transient AG Grid row objects.

See [Transaction editing](../transaction-editing.md) and [Edit conflict reconciliation](../edit-conflict-reconciliation.md).

## Row interaction

Client maps the shared row interaction meanings to native Client behavior:

```text
enabled
→ selectable + editable

selectionDisabled
→ not selectable + individually editable

readOnly
→ not selectable + not editable
```

See [Row interaction](../row-interaction.md).

## Export

### Current Page

Client uses the shared exact-page helper and native AG Grid CSV export:

```text
native pagination model
→ exact current-page RowNodes
→ api.exportDataAsCsv(...)
```

Current Page is a page snapshot, so displayed restricted rows remain included.

### Selected

Selected export stays local:

```text
native Client selection
→ api.exportDataAsCsv({
     onlySelected: true,
     onlySelectedAllPages: true
   })
```

`onlySelectedAllPages` preserves selected rows across pagination pages.

Client does not call the backend selected-export endpoint because every selected row is already available locally.

See [Grid export](../grid-export.md).

## Grid State

Client uses native Grid State persistence for durable view preferences such as:

- column order, pinning, sizing and visibility;
- filters;
- sort.

Pagination and row selection remain transient under the current application contract.

## Current Client limitations

The current Client foundation assumes:

- a bounded working set that can be loaded into browser memory;
- local AG Grid shaping after the collection is loaded;
- exact local selection;
- local Selected export.

It does not implement server block loading or unloaded-row dataset selection because those mechanics are unnecessary for this row model.

## Main implementation entry points

- `backend/apps/transactions/api/client_views.py`
- `frontend/src/features/transactions/api/transactions.queries.ts`
- `frontend/src/shared/grid/config/clientSideGridDefaults.ts`
- `frontend/src/shared/grid/selection/client-side/useClientSideSelectionController.ts`
- `frontend/src/shared/grid/export/exportSelectedRowsCsv.ts`
- `frontend/src/features/transactions/grid/TransactionsClientGrid.tsx`
- `frontend/src/features/transactions/grid/transactionColumns.tsx`

For the searchable frontend footprint, use `GRIDCAP-ROWMODEL-CLIENT` in the [capability tag registry](../grid-capability-tags.md).

## Manual verification

When testing `/client`, verify at least:

1. Initial load performs one `GET /api/transactions/` and renders the complete collection.
2. Sorting, filtering and pagination changes do not trigger row-query API requests.
3. Default scope is `all`; header selection currently yields 624 selectable rows in the deterministic demo.
4. `page` and `filtered` scopes map to their native AG Grid meanings.
5. `selectionDisabled` and `readOnly` rows cannot be selected; `selectionDisabled` remains individually editable and `readOnly` does not.
6. In filtered scope, changing the filter after Select All Filtered clears the previous filtered-wide selection.
7. Selected count equals the exact native selected rows.
8. Row Save and Save Selected Dirty persist only intended drafts.
9. BASE / LOCAL / REMOTE reconciliation behaves correctly after collection refetch.
10. Export Current Page contains exactly the current displayed page.
11. Export Selected includes selected rows across pagination pages and makes no selected-export backend request.
12. Selected Change Status sends exact selected IDs, clears selection only after success and refetches authoritative data.
13. Grid State restores the documented view preferences without persisting business selection.
14. Navigation/remount/teardown produces no destroyed-GridApi warning.

Manual verification must not be marked complete unless these browser scenarios were actually run.
