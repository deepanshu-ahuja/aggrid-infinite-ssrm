# AG Grid Architecture

This document describes how AG Grid is integrated into the application and where shared versus row-model/feature-specific behavior belongs.

For a practical guide to adding another server-backed table, start with `docs/server-backed-grid-reuse.md`. For a concise record of completed work and remaining foundation scope, see `docs/ag-grid-foundation-status.md`. Editing-specific decisions are in `docs/transaction-editing.md`.

## Core rule

Use native AG Grid behavior and APIs first.

Before custom behavior, inspect in this order:

1. AG Grid native API/state/events.
2. The specific row model: Infinite or SSRM.
3. Community versus Enterprise capability.
4. Application-owned behavior only when AG Grid cannot represent the required business meaning.

Share configuration, datasource adapters and small utilities only when they are genuinely common. Do not build an application-specific wrapper API that hides `AgGridReact` or AG Grid lifecycle events.

## Root GridApi ownership

Each concrete row-model root directly owns its rendered `<AgGridReact>` and one authoritative `GridApi` reference:

- `TransactionsInfiniteGrid` owns the Infinite grid and API;
- `TransactionsSsrmGrid` owns the SSRM grid and API.

Native state/operations such as filters, sorting, pagination, native selection, Grid State and row-model APIs should be read/written through that root API when needed.

Do **not** put the authoritative GridApi inside a lower presentation component and then mirror native information upward through React state, refs or callback bridges.

Shared hooks that need AG Grid operations receive/use the root-owned API instead of capturing another GridApi.

The previous multi-layer grid wrappers were removed because they made API ownership indirect and scattered one row model's lifecycle across multiple React layers.

The application shell imports/renders concrete row-model roots directly. Infinite and SSRM are separate implementations, not modes hidden behind one common table component.

## Application bootstrap

AG Grid application setup lives in `AppProviders` and shared grid bootstrap files.

The application owns centrally:

- AG Grid Enterprise license initialization;
- module registration through `AgGridProvider`;
- the application AG Grid theme;
- global `defaultColDef` values through AG Grid's native `provideGlobalGridOptions` API.

Feature grids render `AgGridReact` directly. There is no generic React grid wrapper.

### Global GridOptions boundary

The intentionally small global surface is currently:

- `theme`;
- `defaultColDef`.

Keep row-model or feature behavior visible on the concrete root unless there is a real application-wide rule:

- `rowModelType`;
- datasource/server-side datasource;
- row selection;
- `getRowId`;
- pagination/cache exceptions;
- AG Grid lifecycle callbacks;
- preference lifecycle;
- editing lifecycle.

## Shared grid layer

Reusable library-level code lives under `frontend/src/shared/grid`.

Current responsibilities include:

- server-backed GridOption defaults;
- Infinite and SSRM datasource adapters;
- current-page RowNode resolver;
- error overlay;
- shared query/filter contracts;
- selection primitives/adapters;
- row-model-specific reusable selection controllers;
- generic backend-facing selection-action target construction;
- native Grid State persistence boundary;
- generic tracked-edit mechanics;
- formatters;
- AG Grid module/license bootstrap.

These utilities use AG Grid's native concepts and property names. They are not a compatibility clone of AG Grid.

## Row-model boundary

Infinite Row Model and Server-Side Row Model (SSRM) intentionally remain separate implementations.

They both load server data from the backend, but their datasource, cache, refresh and native selection capabilities are materially different. Shared code should capture genuine common semantics without pretending the row models have identical lifecycles.

### Infinite Row Model

`TransactionsInfiniteGrid` owns:

- `<AgGridReact>` and its authoritative GridApi;
- Infinite datasource wiring;
- stable backend row identity;
- pagination/cache/model lifecycle;
- Infinite retry/refresh through native Infinite APIs;
- native page/manual selection;
- custom dataset-wide selection where Infinite cannot represent unloaded Select All;
- Infinite preference persistence lifecycle;
- transaction editing/action integration.

Infinite selection supports three UI strategies:

- `page` — ordinary selected IDs are AG Grid-owned; the custom header selects current-page RowNodes;
- `filtered` — Select All represents every backend row matching the active filter;
- `all` — Select All represents the entire dataset.

For `page`, native selected IDs are read from Grid State (`api.getState().rowSelection`) at action time.

For `filtered/all`, compact application selection is:

```ts
{
  mode: 'include' | 'exclude',
  ids: string[],
}
```

This custom state is justified because Infinite cannot represent unloaded dataset-wide selection plus exclusions by itself.

Applied filters are not mirrored into React state/refs. When a filtered action payload is required, the root reads `api.getFilterModel()` directly and passes it through the feature mapper.

Important lifecycle behavior:

- pagination preserves explicit selection;
- sorting preserves explicit selection because row identity is stable;
- dataset-wide selection restores checkbox state when rows materialise;
- filtered-wide exclude resets on filter change because its defining dataset changed;
- all-record exclude is independent of visible filters;
- backend writes refresh the currently resident Infinite cache blocks, not the entire backend dataset;
- evicted/unloaded blocks fetch authoritative values later when the user visits them.

See `frontend/src/infinite-selection-contract.md` for scenario details and `docs/server-backed-grid-reuse.md` for the cache explanation.

### SSRM

`TransactionsSsrmGrid` owns:

- `<AgGridReact>` and its authoritative GridApi;
- SSRM datasource wiring;
- stable backend row identity;
- native SSRM manual/All Records selection;
- native server-side selection-state APIs;
- explicit Current Page behavior through loaded RowNodes;
- custom Select All Filtered because the required unloaded filtered-selection behavior is not provided by the current native SSRM configuration;
- SSRM retry/refresh through native SSRM APIs;
- SSRM preference persistence lifecycle;
- transaction editing/action integration.

Use native SSRM selection wherever AG Grid supports the requirement.

The native header checkbox means All Records. Current Page and All Filtered remain explicit commands because their product meanings differ from that native All Records behavior.

No filter-model snapshot/ref is maintained. If custom filtered selection needs query context, the root reads the currently applied model directly with `api.getFilterModel()`. Custom Select All Filtered is cleared when the filter changes, so that current native model remains the defining query while the custom selection is active.

See `frontend/src/ssrm-selection-contract.md` for scenario details.

## Shared server-backed configuration

`serverBackedGridDefaults` contains conservative defaults expected to repeat across server-backed grids.

Current defaults:

| Native AG Grid option             | Current default | Purpose                                   |
| --------------------------------- | --------------: | ----------------------------------------- |
| `pagination`                      |          `true` | Enable AG Grid pagination.                |
| `paginationPageSize`              |            `25` | Rows shown per default page.              |
| `paginationPageSizeSelector`      |  `[10, 25, 50]` | User page-size choices.                   |
| `cacheBlockSize`                  |            `50` | Rows requested per backend block.         |
| `maxBlocksInCache`                |             `5` | Bound retained server blocks.             |
| `blockLoadDebounceMillis`         |           `120` | Avoid unnecessary rapid block requests.   |
| `maxConcurrentDatasourceRequests` |             `1` | Conservative backend request concurrency. |

These are defaults, not immutable rules. A row-model/feature root may override a value when its UX/backend characteristics justify it.

Pagination page size and datasource block size remain separate concepts. Cache residency must never be used as a business-action scope.

## Feature configuration

`frontend/src/features/transactions/transactionsGrid.config.ts` contains only static Transactions-specific choices/defaults:

- Infinite header-selection strategy;
- row-model-specific native GridOption overrides.

It does not compose row-model lifecycle callbacks. Each concrete root is independently usable and owns its own native lifecycle.

## Native Grid State persistence

User table preferences use AG Grid's serializable `GridState`.

Each concrete row-model root owns this lifecycle:

```text
saved GridState
→ root initialState
→ AgGridReact
→ root onStateUpdated
→ GridStateStore
```

Infinite and SSRM use separate preference keys so their state cannot overwrite each other.

The shared `GridStateStore` is the persistence boundary. The current implementation (`browserGridStateStore`) uses `localStorage`, but browser storage is temporary infrastructure, not the intended permanent product persistence.

A future user/profile preferences API should replace the store implementation/boundary without changing AG Grid state ownership or creating a second preference model.

### Persisted state

Only intentional user-preference slices are retained:

- column order;
- column pinning;
- column sizing;
- column visibility;
- column filters;
- sorting.

Pagination and row selection remain excluded because they are not current durable preferences and their restoration semantics differ by row model.

## Data flow

Normal server-backed row loading remains:

```text
AG Grid request
→ row-model datasource adapter
→ Transactions request mapper
→ Django endpoint
→ rows + totalCount + filteredCount
→ AG Grid row model/cache
```

The Transactions mapper is the domain boundary between AG Grid filter/sort models and backend query contracts.

## Backend filter and selection-action consistency

Do not create a second filter translator for selection actions.

Normal row loading and Select All Filtered actions both reuse `mapTransactionFilterModel(...)`.

Backend-facing selection intentionally serializes only `mode + ids`:

```text
include + ids
-> exact ids

exclude + mapped filters
-> filtered dataset minus exception ids

exclude without filters
-> all records minus exception ids
```

There is no serialized `scope` field. The frontend still knows whether an exclude selection is filtered-wide or all-record while constructing the request, but the backend can infer the final dataset from the presence of translated filters.

The generic builder is `buildGridSelectionActionTarget(...)`; Transactions-specific composition is handled by `buildTransactionSelectionActionRequest(...)`.

## Editing boundary

Editing state is application-owned because unsaved edits must survive server-backed RowNode/cache eviction. It is keyed by stable backend row ID.

Both row-model roots reuse the generic tracked-edit engine while keeping row-model-specific refresh behavior at the concrete root.

Bulk Save/Discard operates on `dirty ∩ logical selection`. A clean selected row is not persisted, and an unselected dirty row is not included in aggregate Save/Discard.

See `docs/transaction-editing.md` for editing-specific decisions.

## Working principle

For every new piece of grid code ask:

```text
Does AG Grid already own/provide this?
        ↓ no
Does this specific row model provide it?
        ↓ no
Is the requirement generic server-backed table behavior or feature business behavior?
        ↓
Put reusable mechanics in shared/grid.
Keep domain semantics in the feature.
```

And for reuse:

```text
Inspect Infinite natively
Inspect SSRM natively
Do not force identical implementations
Identify the common semantic contract
        ↓
share only that proven/common capability
```
