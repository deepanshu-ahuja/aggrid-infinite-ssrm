# Server-Side Row Model (SSRM) implementation guide

## Current ownership

```text
TransactionsSsrmGrid
        ↓ owns
AgGridReact + GridApi
        ↓
SSRM datasource / server-side store lifecycle
        ↓
feature request mapper
        ↓
backend query endpoint
```

AG Grid owns SSRM store/block demand, loaded RowNodes, native server-side selection state, retry and server-side refresh. Application state is added only where the required product meaning is not represented natively.

## Loading and query behavior

SSRM uses:

- `rowModelType="serverSide"`;
- Enterprise SSRM and SSRM API modules;
- the flat SSRM datasource adapter;
- stable backend `getRowId`;
- backend sort/filter mapping;
- request cancellation on datasource destruction;
- latest-started-request ownership for renderable `totalCount` / `filteredCount` metadata;
- native `refreshServerSide()` after successful writes;
- native `retryServerSideLoads()` for failed loads.

The current backend contract is flat. Grouping, tree data, aggregation and pivot request semantics are not implemented.

## Selection

SSRM uses native Enterprise selection where AG Grid represents the required meaning:

```text
manual / explicit rows
→ native SSRM selection state

All Records
→ native SSRM server-side Select All state

Current Page
→ explicit operation over concrete selectable page RowNodes

All Filtered
→ application-owned semantic gap
```

The logical operation target remains `include | exclude` plus IDs, with backend eligibility authoritative for the final business operation.

Custom All Filtered state resets when its defining filter changes. Native explicit and All Records selection remain stable across ordinary visible filter changes.

## Selected count

```text
explicit/manual/current-page
→ exact included/native ID count

All Filtered
→ API filteredCount - user exceptions

All Records
→ API totalCount - user exceptions
```

`totalCount` / `filteredCount` describe query membership, not exact backend operation eligibility for unloaded rows, so the backend can ultimately act on fewer rows than a dataset-wide displayed count.

## Editing and conflicts

SSRM uses stable-ID tracked editing state outside transient RowNodes because store refresh/recreation can replace them.

Fresh SSRM rows are reconciled against BASE / LOCAL / REMOTE state before remaining LOCAL values are restored.

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

Native callbacks enforce loaded-row browser interaction. Backend authority protects unloaded rows and server-wide operations.

Restricted rows are not converted into user deselection exception IDs.

## Selected Change Status action

The current Transaction action builds the SSRM logical selection target and sends it to the selected status endpoint.

On success:

```text
backend succeeds
→ SSRM clearSelection()
→ refreshServerSide()
```

On failure, the success callback does not run and selection remains available.

## Import

Transaction Import is separate from tracked cell editing.

The feature-owned Import dialog sends CSV text to backend Preview/Apply endpoints. A successful Apply does not create LOCAL drafts and does not deliberately clear native/custom SSRM selection.

The concrete SSRM root owns the post-Import authoritative refresh:

```text
backend Import Apply succeeds
→ TransactionImportAction onImported callback
→ refreshServerSide()
→ fresh store rows arrive
→ reconcile existing BASE / LOCAL / REMOTE state
→ restore remaining LOCAL overlays
```

If an imported value differs from both an existing dirty field's BASE and LOCAL values, normal conflict reconciliation keeps LOCAL visible and records the imported value as REMOTE.

See `../grid-import.md` for the complete file/template, validation, atomicity and error-reporting contract. Search `GRIDCAP-IMPORT` for the frontend footprint.

## Export

### Current Page

Current Page resolves the exact AG Grid pagination page and delegates CSV serialization to native AG Grid.

If the expected page is not fully materialised, the operation is refused rather than exporting a partial page.

### Selected

Selected export is backend-owned because SSRM selection can represent unloaded rows.

```text
logical SSRM selection
→ backend selection target
→ authoritative eligible rows
→ backend CSV
```

## Grid State and lifecycle

The concrete SSRM root owns its `GridApi`, datasource/store lifecycle, Grid State persistence, native selection APIs, retry, refresh and teardown.

Current persisted view preferences include column order/pinning/sizing/visibility, filters and sort. Pagination position and row selection remain transient.

Datasource destroy/replacement cancels obsolete in-flight requests. The root clears its authoritative GridApi ref during pre-destroy lifecycle.

## Current limitations

The current SSRM selection adapter assumes flat server-side selection with `groupSelects: 'self'`.

Grouping/tree selection requires separate semantics before hierarchical selection state can be treated as equivalent to this flat contract.

## Main implementation entry points

- `frontend/src/features/transactions/grid/TransactionsSsrmGrid.tsx`
- `frontend/src/shared/grid/data/server-side/createServerSideDatasource.ts`
- `frontend/src/shared/grid/data/server-side/useServerSideRowLoading.ts`
- `frontend/src/shared/grid/selection/server-side/useSsrmSelectionController.ts`
- `frontend/src/shared/grid/gridModules.ts`
- `frontend/src/features/transactions/grid/transactionRequest.mapper.ts`
- `frontend/src/features/transactions/grid/TransactionImportAction.tsx`

Search `GRIDCAP-ROWMODEL-SSRM` across frontend source/tests to locate the SSRM row-model footprint. Search `GRIDCAP-IMPORT` for the Import integration.

## Verification

Verify at least:

1. datasource requests use the current sort/filter mapping;
2. stale older requests cannot overwrite count metadata owned by a later-started request;
3. explicit selection uses native SSRM selection state;
4. All Records uses native SSRM server-side selection state;
5. Current Page operates only on the fully resolved selectable page RowNodes;
6. All Filtered uses the custom logical state and resets when its defining filter changes;
7. dataset-wide selected count follows `filteredCount` / `totalCount` minus user exceptions;
8. dirty drafts survive store refresh/recreation;
9. BASE / LOCAL / REMOTE reconciliation preserves or conflicts drafts correctly;
10. successful Change Status clears selection and refreshes SSRM;
11. failed Change Status keeps selection;
12. successful Import refreshes through `refreshServerSide()` without manufacturing LOCAL drafts;
13. failed datasource loads retry through `retryServerSideLoads()`;
14. Current Page export refuses a partially materialised page;
15. Selected export uses the backend target rather than loaded RowNodes;
16. datasource teardown cancels obsolete work and does not use a destroyed GridApi.

Do not mark manual verification complete unless the SSRM browser scenarios were actually run.
