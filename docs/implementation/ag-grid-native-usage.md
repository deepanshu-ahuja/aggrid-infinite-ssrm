# AG Grid Native Usage Reference

This document records the **current AG Grid runtime surface used by the repository**.

It answers:

> Which behavior is native AG Grid, and where does application code exist because AG Grid or a specific row model cannot represent the required meaning?

It is not a copy of AG Grid documentation and is not a roadmap.

For logical capabilities built on these primitives, see `docs/grid-capabilities.md`.

## Native-first rule

Current architecture deliberately relies on AG Grid directly:

```text
native AG Grid capability
        ↓ if insufficient
row-model-specific native capability
        ↓ if still insufficient
smallest application-owned semantic state/mechanic
```

The project does not recreate AG Grid behind a universal wrapper.

## Direct `AgGridReact` roots

Current concrete roots render `AgGridReact` directly:

```text
TransactionsClientGrid
TransactionsInfiniteGrid
TransactionsSsrmGrid
```

Each root owns its own native lifecycle and authoritative `GridApi` reference.

## Application-wide AG Grid setup

Current central setup includes:

### `AgGridProvider`

Registers the AG Grid modules available to the application.

### `provideGlobalGridOptions(...)`

Provides the intentionally small global native surface:

- shared theme;
- shared `defaultColDef`.

Row-model choice, data source, selection, IDs and lifecycle remain concrete-root concerns.

### `LicenseManager.setLicenseKey(...)`

Initializes the Enterprise license when configured.

### `enableDevValidations()`

Enables AG Grid development validations in development builds.

## Registered modules

Current registration includes:

- `AllCommunityModule`;
- `ServerSideRowModelModule`;
- `ServerSideRowModelApiModule`.

The SSRM modules are required for Enterprise server-side row loading and the SSRM-specific API surface used by this project.

## Global `defaultColDef`

Current native defaults include:

```text
sortable: true
resizable: true
filter: true
minWidth: ...
```

Feature columns override these options where needed.

## Row-model props

### Client-Side

```tsx
rowModelType="clientSide"
rowData={rows}
```

The complete bounded working set is provided to AG Grid directly.

### Infinite

```tsx
rowModelType="infinite"
datasource={datasource}
```

AG Grid requests server blocks through the Infinite datasource lifecycle.

### SSRM

```tsx
rowModelType="serverSide"
serverSideDatasource={datasource}
```

AG Grid uses the Enterprise SSRM datasource/store lifecycle.

## Client `rowData`

Client receives fresh editable row copies from the application/TanStack Query layer.

AG Grid owns local:

- sorting;
- filtering;
- pagination;
- native row selection.

`onRowDataUpdated` is used as the concrete Client point where new authoritative row objects can be reconciled against stable-ID LOCAL drafts.

## Infinite datasource APIs

Current Infinite datasource behavior uses native `IDatasource` callbacks and request values:

```text
params.startRow / params.endRow
params.sortModel
params.filterModel
params.successCallback(rows, rowCount)
params.failCallback()
datasource.destroy()
```

The datasource adapter translates native request state through the feature mapper and aborts outstanding work when destroyed/replaced.

The filtered query size is supplied as AG Grid's current row count because pagination represents the current query universe.

## SSRM datasource APIs

Current SSRM datasource behavior uses native `IServerSideDatasource` callbacks:

```text
params.request.startRow / endRow
params.request.sortModel
params.request.filterModel
params.success({ rowData, rowCount })
params.fail()
datasource.destroy()
```

The current SSRM implementation is flat; only the request fields needed by the implemented flat query contract are translated.

## Server-backed pagination/cache options

Current shared native defaults include:

```text
pagination
paginationPageSize
paginationPageSizeSelector
cacheBlockSize
maxBlocksInCache
blockLoadDebounceMillis
maxConcurrentDatasourceRequests
```

Pagination page size and cache block size are intentionally different concepts.

Cache residency never defines a business-operation target.

## Client pagination options

Client has its own native pagination defaults without server cache/block settings because all rows are already in memory.

## Stable identity: `getRowId`

All three concrete roots provide native `getRowId` from the stable backend row ID.

This keeps business identity independent of:

- sorting;
- filtering;
- pagination;
- Client rowData replacement;
- Infinite cache recreation;
- SSRM store recreation.

## Native selection configuration

All three roots use native AG Grid `rowSelection` configuration with row-model-specific settings.

Common current concepts include:

- `mode: 'multiRow'`;
- checkbox selection;
- `enableClickSelection: false` where the product uses explicit checkbox/actions;
- `isRowSelectable(...)` for loaded-row eligibility.

AG Grid evaluates `isRowSelectable` and exposes the result as `RowNode.selectable`.

## Client native Select All scopes

Client maps product scopes directly to AG Grid:

```text
page
→ rowSelection.selectAll = 'currentPage'

filtered
→ rowSelection.selectAll = 'filtered'

all
→ rowSelection.selectAll = 'all'
```

Client selection is fully concrete/native because the entire working set is local.

`GridApi.deselectAll()` is the current clear mechanism used by the Client selection controller.

## Infinite selection APIs

Concrete loaded-row behavior uses native RowNode/GridApi selection APIs such as:

- `api.setNodesSelected(...)`;
- `node.isSelected()`;
- `node.setSelected(...)`;
- `node.selectable`;
- `api.forEachNode(...)`.

Current page/manual selection stays native where possible.

Filtered/all dataset-wide selection requires application-owned include/exclude state because unloaded Infinite rows do not have RowNodes.

Programmatic selection reconciliation uses AG Grid API event source information so application sync events do not become user deselection exceptions.

## SSRM native selection state

Current SSRM code uses native Enterprise APIs:

```text
api.getServerSideSelectionState()
api.setServerSideSelectionState(...)
```

The native flat selection state represents:

```text
explicit selected IDs
or
All Records + toggled user exceptions
```

This lets SSRM represent unloaded selected rows without enumerating row objects.

The project does not use `getSelectedRows()` as the source of dataset-wide SSRM selection because that API can only return loaded row objects.

Current custom SSRM All Filtered state exists only because the required filtered-wide product meaning is not represented by the configured native SSRM selection behavior.

## Current Page pagination APIs

The shared exact-page resolver uses native pagination/display APIs:

```text
api.paginationGetPageSize()
api.paginationGetCurrentPage()
api.paginationGetRowCount()
api.getDisplayedRowAtIndex(index)
```

If the expected current page is not fully materialised, Current Page operations refuse partial execution.

## Native filtering

Current server-backed roots read the applied native filter model with:

```ts
api.getFilterModel()
```

The application does not maintain a second React copy simply to construct backend actions.

The same feature translation is used by row loading and All Filtered selected operations.

Client uses AG Grid's local native filters directly and does not send a server query on filter changes.

## Native sorting

All three grids use native AG Grid column sorting UI/state.

Execution differs:

```text
Client
→ AG Grid sorts local rowData

Infinite / SSRM
→ native sort model is translated to backend query
```

## Native editing events/APIs

### `onCellValueChanged`

The shared tracked-edit hook records a direct user edit after AG Grid commits the new value.

It uses:

- row data;
- stable field identity;
- old/new values;
- event source;
- RowNode when available.

### `RowNode.setDataValue(...)`

Used for current implemented programmatic value application/restoration:

- current-page edit application;
- restoring tracked LOCAL values;
- Discard;
- `Use server` conflict resolution.

Application guards ensure those programmatic writes do not become duplicate user drafts.

### `ColDef.editable`

Native callback used to enforce loaded-row read-only behavior and block normal editing of unresolved conflicted fields.

### Cell editors

Current examples include:

- native `agNumberCellEditor`;
- custom Transaction status editor.

The shared tracker consumes the committed value regardless of editor UI.

## Native column capabilities currently used

Feature columns currently use native AG Grid options including:

- `field`;
- `colId`;
- `headerName`;
- sizing constraints;
- `sortable`;
- `filter` / `filterParams`;
- `editable`;
- `cellEditor`;
- `cellRenderer`;
- `valueFormatter`;
- `cellClassRules`;
- `tooltipValueGetter`.

There is no separate application column-definition language in the implemented Transaction grids.

## Native refresh APIs

Current write-refresh ownership remains row-model-specific:

```text
Infinite
→ api.refreshInfiniteCache()

SSRM
→ api.refreshServerSide()
```

SSRM load retry uses:

```text
api.retryServerSideLoads()
```

Client authoritative data is refreshed through TanStack Query/rowData rather than a server-row-model cache API.

## Native rendering refresh/context

Current integration uses:

```text
api.refreshHeader()
api.refreshCells(...)
api.setGridOption('context', value)
```

`context` supplies grid cell renderers/callbacks with current feature-owned editing/conflict actions and queries.

React UI outside AG Grid renders directly from React-owned tracked state rather than reading ref-backed Grid context during render.

## Native lifecycle events currently used

### `onGridReady`

Stores the concrete root's authoritative GridApi and performs required initial synchronization.

### `onGridPreDestroyed`

Clears the root-owned GridApi ref before AG Grid destroys the instance.

### `onRowDataUpdated`

Client authoritative-row reconciliation point.

### `onModelUpdated`

Server-backed selection/edit restoration/reconciliation point as rows materialise/change.

### `onPaginationChanged`

Used where page/model-dependent Infinite behavior must resync.

### `onRowSelected`

Used by custom server-backed logical selection handling.

### `onSelectionChanged`

Used by row-model selection controllers/roots to publish or inspect native selection state.

### `onFilterChanged`

Clears only filter-dependent selected universes and resets load-error state for a new query.

### `onCellClicked`

Transactions uses it to open the implemented field-conflict resolution UI.

### `onCellValueChanged`

Feeds tracked editing.

### `onStateUpdated`

Persists selected native Grid State slices.

## `api.isDestroyed()`

Custom Infinite header code checks:

```ts
api.isDestroyed()
```

before cleanup/click-time API calls that can race with grid teardown.

This prevents calls such as listener removal against an already destroyed GridApi.

Concrete roots also clear their API refs in `gridPreDestroy`.

## Native Grid State

Current preferences use AG Grid's `GridState` rather than a parallel application preference schema.

Current integration uses:

```text
initialState
onStateUpdated
```

Persisted slices:

- column order;
- pinning;
- sizing;
- visibility;
- filters;
- sort.

Not persisted as durable preferences:

- pagination position;
- business row selection.

Client, Infinite and SSRM use separate persistence keys.

## Native overlays

Current roots use AG Grid overlay hosting with:

```text
activeOverlay
activeOverlayParams
```

The application provides the error/retry component and wording; AG Grid owns overlay placement/lifecycle.

## Native row class callback

`getRowClass` is used for row interaction presentation.

CSS classes are presentation only. Selection/editing/business enforcement remains in native callbacks and backend authority.

## Application-owned behavior AG Grid does not currently own

### Infinite dataset-wide selection

Application-owned because unloaded Infinite rows do not have RowNodes/native selected state.

### SSRM All Filtered semantic

Application-owned because the configured native SSRM selection behavior does not express the current required filtered-wide meaning.

### Backend request contracts

Feature/application-owned. Raw AG Grid models are translated before HTTP.

### Backend row policy

Feature/backend-owned. Native callbacks consume the resolved policy for loaded rows; the backend remains authoritative for server-wide operations.

### Unsaved draft and BASE/LOCAL/REMOTE conflict state

Application-owned because it must survive row-object/RowNode replacement and compare LOCAL work with newly arriving authoritative values.

### Business endpoints/actions

Feature/backend-owned. AG Grid supplies table state/events; it does not know the Transaction Change Status or Save contracts.

## Current dependency map

| Concern | Native AG Grid ownership | Application addition |
| --- | --- | --- |
| Render table | `AgGridReact` | Feature root composition |
| Client data | `rowData` / Client row model | TanStack Query + editable copies |
| Infinite loading | `datasource` / `IDatasource` | typed loader + mapper |
| SSRM loading | `serverSideDatasource` / SSRM modules | typed loader + mapper |
| Sort | native sort UI/model | server translation for Infinite/SSRM |
| Filter | native filter UI/model | server translation for Infinite/SSRM |
| Pagination | native pagination APIs/options | exact Current Page helper |
| Identity | `getRowId` | backend ID choice |
| Client selection | native Select All/selected rows | scope configuration + observer |
| Infinite dataset selection | loaded RowNode APIs | compact unloaded-row state |
| SSRM All Records | native server-side selection state | mapping to backend target |
| SSRM All Filtered | loaded RowNode APIs | compact filtered application state |
| Row eligibility | `isRowSelectable`, `editable`, `node.selectable` | feature/backend policy |
| Edit commit | `cellValueChanged` | stable-ID tracked edit state |
| Programmatic value write | `setDataValue` | write guard + tracked state |
| Refresh | row-model-native APIs / Client rowData | authoritative reconciliation |
| Preferences | native `GridState` | browser persistence boundary |
| Teardown | `gridPreDestroy`, `isDestroyed` | root ref / safe cleanup |
| Error display | native overlay host | application error/retry UI |

## Related implementation references

- `docs/grid-capabilities.md`
- `docs/ag-grid.md`
- `docs/ag-grid-foundation-status.md`
- `docs/api-data-flow.md`
- `docs/client-side-grid.md`
- `docs/row-interaction.md`
- `docs/transaction-editing.md`
- `docs/edit-conflict-reconciliation.md`
- `docs/grid-export.md`
- `frontend/src/infinite-selection-contract.md`
- `frontend/src/ssrm-selection-contract.md`
