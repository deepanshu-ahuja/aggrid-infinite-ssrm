# Infinite Row Model implementation guide

## Current ownership

```text
TransactionsInfiniteGrid
        ↓ owns
AgGridReact + GridApi
        ↓
Infinite datasource / bounded block cache
        ↓
feature request mapper
        ↓
backend query endpoint
```

AG Grid owns block demand, pagination/model lifecycle and loaded RowNodes. The application owns backend request translation, durable editing state and the logical dataset-wide selection state required for unloaded rows.

## Loading and query behavior

Infinite uses:

- `rowModelType="infinite"`;
- the Infinite datasource adapter;
- stable backend `getRowId`;
- backend sort/filter mapping;
- bounded cache defaults;
- request cancellation on datasource destruction;
- latest-started-request ownership for renderable `totalCount` / `filteredCount` metadata;
- native `refreshInfiniteCache()` after successful server writes.

Cache residency is a performance concern only. It never defines the business target of a selected action or export.

## Selection

Infinite keeps native AG Grid selection for concrete loaded/manual/current-page rows where possible.

For dataset-wide Select All, unloaded rows do not have RowNodes, so Infinite uses compact application-owned logical state:

```text
include IDs
→ exact selected IDs

exclude IDs
→ selected dataset minus explicit user exceptions
```

`page`, `filtered`, and `all` describe UI/header meaning; they are not serialized as backend selection scope.

Filtered-wide selection resets when its defining filter changes. Explicit IDs and All Records selection remain tied to their original meaning rather than being reinterpreted by a visible filter change.

## Selected count

```text
explicit/manual/current-page
→ exact included ID count

All Filtered
→ API filteredCount - user exceptions

All Records
→ API totalCount - user exceptions
```

`totalCount` / `filteredCount` describe query membership, not exact backend operation eligibility for unloaded rows, so the backend can ultimately act on fewer rows than a dataset-wide displayed count.

## Editing and conflicts

Infinite uses stable-ID tracked editing state outside transient RowNodes so block eviction/reload cannot destroy drafts.

Fresh block data is reconciled against BASE / LOCAL / REMOTE state before remaining LOCAL values are restored to loaded RowNodes.

For a dirty field:

```text
REMOTE == BASE
→ keep LOCAL dirty

REMOTE == LOCAL
→ clean automatically

REMOTE differs from BASE and LOCAL
→ keep LOCAL visible
→ retain REMOTE
→ mark conflict
```

Row Save persists one explicit dirty row. Save Selected Dirty persists only existing dirty rows that are also in the current logical selection.

## Row interaction

Loaded-row selection/editability uses:

```text
enabled
→ selectable + editable

selectionDisabled
→ not selectable + individually editable

readOnly
→ not selectable + not editable
```

Native loaded-row callbacks enforce the browser interaction. Backend authority remains required for unloaded rows and server-wide operations.

Restricted rows are not converted into user deselection exception IDs.

## Selected Change Status action

The current Transaction action builds the Infinite logical selection target and sends it to the selected status endpoint.

On success:

```text
backend succeeds
→ Infinite clearSelection()
→ refreshInfiniteCache()
```

On failure, the success callback does not run and selection remains available.

## Export

### Current Page

Current Page resolves the exact AG Grid pagination page and delegates CSV serialization to native AG Grid.

If the expected page is not fully materialised, the operation is refused rather than exporting a partial page.

### Selected

Selected export is backend-owned because Infinite logical selection may include unloaded rows.

```text
logical Infinite selection
→ backend selection target
→ authoritative eligible rows
→ backend CSV
```

## Grid State and lifecycle

The concrete Infinite root owns its `GridApi`, Grid State persistence lifecycle, datasource replacement, refresh and teardown.

Current persisted view preferences include column order/pinning/sizing/visibility, filters and sort. Pagination position and row selection remain transient.

Datasource destroy/replacement cancels obsolete in-flight requests. The root clears its authoritative GridApi ref during pre-destroy lifecycle.

## Main implementation entry points

- `frontend/src/features/transactions/grid/TransactionsInfiniteGrid.tsx`
- `frontend/src/shared/grid/data/infinite/createInfiniteDatasource.ts`
- `frontend/src/shared/grid/data/infinite/useInfiniteRowLoading.ts`
- `frontend/src/shared/grid/selection/infinite/useInfiniteSelectionController.tsx`
- `frontend/src/features/transactions/grid/transactionRequest.mapper.ts`

Search `GRIDCAP-ROWMODEL-INFINITE` across frontend source/tests to locate the Infinite row-model footprint.

## Verification

Verify at least:

1. datasource requests use the current offset/limit/sort/filter mapping;
2. stale older requests cannot overwrite count metadata owned by a later-started request;
3. manual/current-page selection remains exact and skips non-selectable loaded rows;
4. All Filtered uses compact logical selection and resets when its defining filter changes;
5. All Records remains stable across visible filter changes;
6. dataset-wide selected count follows `filteredCount` / `totalCount` minus user exceptions;
7. dirty drafts survive block eviction/reload;
8. BASE / LOCAL / REMOTE reconciliation preserves or conflicts drafts correctly;
9. successful Change Status clears selection and refreshes the Infinite cache;
10. failed Change Status keeps selection;
11. Current Page export refuses a partially materialised page;
12. Selected export uses the backend target rather than loaded RowNodes;
13. datasource teardown cancels obsolete work and does not use a destroyed GridApi.

Do not mark manual verification complete unless the Infinite browser scenarios were actually run.
