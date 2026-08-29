# AG Grid Architecture

This document describes the **current implemented** AG Grid ownership model across Client-Side, Infinite and SSRM.

It is an implementation reference. Planned capabilities and configurable-table target architecture live in their dedicated backlog/proposal documents.

## Core rule

Use native AG Grid behavior and APIs first.

For every grid concern, inspect in this order:

1. AG Grid native API/state/event;
2. the specific row model's native capability;
3. application-owned state only for a real semantic gap.

Do not build an application-specific wrapper API that hides `AgGridReact` or native lifecycle.

## Concrete root ownership

Each Transaction row-model root renders AG Grid directly and owns one authoritative `GridApi`:

```text
TransactionsClientGrid
TransactionsInfiniteGrid
TransactionsSsrmGrid
```

Native sorting/filtering/pagination/selection/Grid State and row-model-specific APIs are read or written through the concrete root's API when needed.

Shared hooks receive the root-owned API for operations they genuinely own; they do not create a second authoritative GridApi.

## Application bootstrap

Application-wide AG Grid setup lives in providers/shared bootstrap code and currently includes:

- Enterprise license initialization;
- module registration through `AgGridProvider`;
- application AG Grid theme;
- a small native global `defaultColDef` surface.

The global surface does not own:

- row-model choice;
- `rowData` / datasource / server-side datasource;
- row selection;
- `getRowId`;
- lifecycle callbacks;
- editing/business actions;
- feature-specific columns.

Those remain visible on concrete feature roots/configuration.

## Shared grid layer

Reusable mechanics live under `frontend/src/shared/grid`.

Current responsibilities include:

- Client and server-backed GridOptions defaults;
- Infinite and SSRM datasource adapters;
- row-model-specific selection controllers;
- current-page RowNode resolution;
- logical server-selection target helpers;
- selected-count math;
- row interaction predicates/class mapping;
- tracked editing and conflict mechanics;
- Current Page / Client Selected export helpers;
- native Grid State persistence boundary;
- common formatters;
- error overlay;
- AG Grid bootstrap helpers.

These utilities use AG Grid's native concepts rather than recreating a compatibility layer.

## Feature ownership

The Transactions feature owns:

- Transaction columns;
- feature renderers/editors;
- editable field list;
- Transaction request/filter mapping;
- Transaction selected Change Status behavior;
- Transaction Save API composition;
- row interaction presentation/reason text;
- conflict presentation.

The backend owns authoritative Transaction business policy and validation of writes/selected operations.

## Client-Side Row Model

`TransactionsClientGrid` receives the complete bounded Transaction collection through TanStack Query.

```text
GET complete collection
→ authoritative Query cache
→ editable row copies
→ AgGridReact rowData
```

AG Grid owns local:

- sorting;
- filtering;
- pagination;
- checkbox selection;
- Page/Filtered/All native Select All.

The Client selection controller reads exact selected IDs/count from native selection and clears through native `deselectAll()`.

Client Selected export is native/local because all selected rows are in browser memory.

Fresh authoritative Query data creates new row objects; the root reconciles them against stable-ID LOCAL drafts in `onRowDataUpdated`.

## Infinite Row Model

`TransactionsInfiniteGrid` owns:

- `rowModelType="infinite"`;
- Infinite datasource wiring;
- stable backend row identity;
- pagination/cache lifecycle;
- Infinite retry/refresh;
- native concrete-row selection;
- compact application selection for filtered/all unloaded-row semantics;
- Infinite Grid State key/lifecycle;
- Transaction editing/action integration.

Current selection meanings:

```text
manual/current-page
→ native concrete selected rows

All Filtered / All Records
→ compact include/exclude application state
```

Compact state exists because unloaded Infinite rows do not have RowNodes.

Successful writes refresh currently resident Infinite blocks through `refreshInfiniteCache()`. Cache residency never defines the business target.

## Server-Side Row Model

`TransactionsSsrmGrid` owns:

- `rowModelType="serverSide"`;
- Enterprise SSRM datasource/store lifecycle;
- stable backend row identity;
- native SSRM explicit/All Records selection state;
- explicit Current Page selection;
- application-owned All Filtered state for the current native semantic gap;
- SSRM retry/refresh;
- SSRM Grid State key/lifecycle;
- Transaction editing/action integration.

Use native SSRM selection state wherever it represents the required meaning.

Successful writes refresh through `refreshServerSide()`.

## Same semantic capability does not mean one implementation

The three selection controllers are separate:

```text
useClientSideSelectionController()
useInfiniteSelectionController()
useSsrmSelectionController()
```

They may expose the same semantic operation name such as `clearSelection()`, but each owns different native/application state.

There is no universal row-model switch that implements selection for all three.

## Server-backed query mapping

Infinite and SSRM share the same Transaction mapper because they use the same flat server query contract.

```text
AG Grid server request
→ feature mapper
→ allow-listed backend query
→ rows + totalCount + filteredCount
```

Raw AG Grid request objects do not cross the HTTP boundary.

All Filtered selected operations reuse the same filter translation as normal row loading.

## Logical selected-operation target

Server-backed selected operations use:

```ts
{
  mode: 'include' | 'exclude',
  ids: string[],
}
```

Current meaning:

```text
include + ids
→ requested eligible rows

exclude + filters
→ all matching eligible rows minus explicit user exceptions

exclude without filters
→ all eligible rows minus explicit user exceptions
```

Backend eligibility is authoritative. Restricted rows are not serialized as fake user exceptions.

Client selected operations use explicit include IDs because every selected Client row is known locally.

## Change Status lifecycle

Transactions currently implements one selected Change Status mutation family.

```text
selected target
→ Change Status API request
→ backend succeeds
→ concrete root calls its selection controller's clearSelection()
→ concrete root refreshes authoritative data
```

The request does not contain a selection lifecycle setting.

## Row interaction boundary

Current generic modes:

```text
enabled
selectionDisabled
readOnly
```

The feature/backend decides why a row has a mode.

Concrete roots map the mode into native `isRowSelectable` and `editable` behavior. Shared programmatic editing receives the same row-editability rule.

Backend services independently enforce authoritative eligibility/read-only behavior.

## Editing boundary

Shared tracked editing is keyed by stable backend row ID and is independent of transient RowNode identity.

All three row models reuse the same BASE/LOCAL/REMOTE state mechanics while keeping authoritative-data arrival and refresh native to each root.

Selected dirty Save operates on:

```text
dirty rows ∩ current logical selection
```

It sends explicit dirty-row patches; it does not manufacture edits from dataset-wide selection.

## Grid State

Native AG Grid `GridState` is the preference representation.

Current persisted slices:

- column order;
- pinning;
- sizing;
- visibility;
- filters;
- sort.

Client, Infinite and SSRM use separate persistence keys. Pagination position and row selection are not persisted as durable preferences.

## Lifecycle ownership

Concrete roots clear their authoritative GridApi refs in `gridPreDestroy`.

Custom code that can outlive native grid teardown checks destroyed API state before calling GridApi methods.

Infinite/SSRM datasources cancel outstanding work on destroy/replacement.

Render-count freshness is owned by the latest-started server request, not the latest-resolved request.

## Related current implementation references

- `docs/grid-capabilities.md`
- `docs/ag-grid-native-usage.md`
- `docs/api-data-flow.md`
- `docs/client-side-grid.md`
- `docs/selection-counts.md`
- `docs/selected-action-selection-lifecycle.md`
- `docs/row-interaction.md`
- `docs/transaction-editing.md`
- `docs/edit-conflict-reconciliation.md`
- `docs/grid-export.md`
