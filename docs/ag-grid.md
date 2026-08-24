# AG Grid Architecture

This document describes how AG Grid is integrated into the application and where shared versus feature-specific behavior belongs.

For a concise record of completed work and remaining foundation scope, see `docs/ag-grid-foundation-status.md`.

## Core rule

Use native AG Grid behavior and APIs first.

Share configuration, datasource adapters and small utilities when they are genuinely common, but do not build an application-specific wrapper API that hides `AgGridReact` or AG Grid lifecycle events.

## Application bootstrap

AG Grid application setup lives in `AppProviders` and the shared grid bootstrap files.

The application owns centrally:

- AG Grid Enterprise license initialization;
- module registration through `AgGridProvider`;
- the application AG Grid theme;
- global `defaultColDef` values through AG Grid's native `provideGlobalGridOptions` API.

Feature tables render `AgGridReact` directly. The former `AppGrid` wrapper has been removed because it only injected shared defaults and did not add useful behavior.

### Global GridOptions boundary

Today the intentionally small global surface is:

- `theme`;
- `defaultColDef`.

If another native GridOption later becomes truly application-wide, it may also belong in `provideGlobalGridOptions`. Examples could include shared locale text or a company-wide menu/tooltip policy.

Do not move row-model or feature behavior there merely because two grids currently share it. Keep these visible on the owning grid unless there is a real application-wide rule:

- `rowModelType`;
- datasource / server-side datasource;
- row selection;
- `getRowId`;
- pagination/cache exceptions;
- AG Grid lifecycle callbacks.

## Shared grid layer

Reusable library-level code lives under `frontend/src/shared/grid`.

Current responsibilities include:

- server-backed GridOption defaults;
- Infinite and SSRM datasource adapters;
- error overlay;
- filter/query helpers;
- selection primitives and adapters;
- generic backend-facing bulk-selection builder;
- formatters;
- AG Grid module/license bootstrap.

These utilities use AG Grid's native concepts and property names. They are not a compatibility clone of AG Grid.

## Row-model scope

Infinite Row Model and Server-Side Row Model (SSRM) intentionally remain separate feature implementations.

They both load server data in blocks, but their lifecycle and capabilities differ enough that merging them into one large configurable table would hide important AG Grid behavior.

### Infinite Row Model

The Transactions Infinite implementation owns:

- Infinite datasource wiring;
- stable backend row identity;
- row/cache lifecycle synchronization;
- custom header selection semantics where Infinite cannot represent unloaded dataset selection natively;
- Infinite retry through `refreshInfiniteCache()`.

Infinite selection supports three UI strategies:

- `page` — the custom header adds/removes IDs from the current visible pagination page;
- `filtered` — Select All represents every backend row matching the applied filter;
- `all` — Select All represents the entire dataset.

Logical application selection remains only:

```ts
{
  mode: 'include' | 'exclude',
  ids: string[],
}
```

The UI strategy is not duplicated into that logical object.

Important lifecycle behavior:

- pagination preserves selection;
- sorting preserves selection because row identity is stable;
- cache eviction/reload preserves logical selection and restores loaded checkboxes;
- `filtered + include` preserves explicit IDs on filter change;
- `filtered + exclude` resets to `include + []` on filter change;
- all-record selection is independent of visible filter changes.

See `frontend/src/infinite-selection-contract.md` for the full scenario contract.

### SSRM

The Transactions SSRM implementation owns:

- SSRM datasource wiring;
- stable backend row identity;
- native SSRM All Records selection;
- native server-side selection-state APIs;
- SSRM retry through `retryServerSideLoads()`.

Use native SSRM selection wherever AG Grid supports the requirement.

AG Grid SSRM does not support native Select-All modes for `currentPage` or `filtered`, so the feature has explicit commands for those two capabilities:

- Select current page — selects the resolved RowNodes on the current pagination page;
- Select all filtered — keeps a small application-owned include/exclude state tied to the captured applied filter model.

The native header checkbox continues to mean All Records.

See `frontend/src/ssrm-selection-contract.md` for the full scenario contract.

## Shared server-backed configuration

`serverBackedGridDefaults` contains conservative application defaults that are expected to repeat across server-backed tables.

Current values:

| Native AG Grid option | Current default | Purpose |
|---|---:|---|
| `pagination` | `true` | Enable AG Grid pagination. |
| `paginationPageSize` | `25` | Rows shown per default page. |
| `paginationPageSizeSelector` | `[10, 25, 50]` | User page-size choices. |
| `cacheBlockSize` | `50` | Rows requested per backend block. |
| `maxBlocksInCache` | `5` | Bound retained server blocks in browser memory. |
| `blockLoadDebounceMillis` | `120` | Avoid unnecessary rapid block requests. |
| `maxConcurrentDatasourceRequests` | `1` | Conservative backend request concurrency. |

These are defaults, not immutable rules. A feature may override one property when its UX or backend characteristics justify it.

Pagination page size and datasource block size are separate concepts. A 50-row block can, for example, satisfy two 25-row pages while the block remains cached.

## Feature configuration

`frontend/src/features/transactions/transactionsGrid.config.ts` owns Transactions-specific choices.

It selects which separate implementation is rendered:

```ts
activeGrid: 'infinite';
```

Use `'ssrm'` for the SSRM implementation when that deployment/product choice is desired.

The configuration also owns the Infinite header-selection strategy and any future Transactions-specific GridOption overrides.

Shared defaults should not be copied into the feature merely for convenience. Override only the property that intentionally differs.

## Data flow

Normal server-backed row loading is:

```text
AG Grid request
→ row-model datasource adapter
→ Transactions request mapper
→ Django endpoint
→ rows + totalCount
→ AG Grid row model/cache
```

The Transactions mapper is the domain boundary between AG Grid's filter/sort model and backend query contracts.

## Backend filter and bulk-action consistency

Do not create a second filter translator for bulk actions.

Normal row loading and filtered bulk selection both reuse `mapTransactionFilterModel(...)`.

This matters because a future bulk action must target the same backend membership the grid displayed.

Backend-facing selection uses:

- `include` for exact IDs;
- `exclude` plus mapped filters for Select All Filtered;
- `exclude` plus `filters: []` for All Records.

The generic builder is `buildGridBulkSelection(...)`; Transactions-specific context is handled by `buildTransactionBulkSelection(...)`.

## Development payload preview

Until real bulk-action endpoints exist, local development keeps payload-preview controls for Infinite and SSRM.

They are rendered only when:

```ts
import.meta.env.DEV
```

Their purpose is to inspect the exact backend-facing selection payload during development. They do not execute Delete/Approve/Export or any other backend bulk action.

Production builds must not expose these debug controls.

Once real bulk actions exist, their actual network request becomes the preferred validation point and the development preview can be removed.

## AG Grid terms used in this project

| Term | Plain meaning in this project |
|---|---|
| row model | The AG Grid strategy used to obtain/manage rows. Infinite and SSRM are separate implementations. |
| datasource | Object AG Grid calls when it needs server rows. |
| block | One downloaded server batch, such as rows 0–49. It is not a pagination page. |
| cache | Server blocks AG Grid retains in browser memory. |
| `GridApi` | AG Grid's imperative API after the grid initializes. |
| RowNode | AG Grid's browser-side representation of one loaded row. |
| `selectionColumnDef` | Configuration for the dedicated selection checkbox column. |
| Grid State / Column State | Native AG Grid representation/APIs for user grid state such as columns, sorting and filters. |

## Error and retry behavior

Datasource failures are presented inside the grid through the shared error overlay.

Retry remains row-model-native:

- Infinite: `api.refreshInfiniteCache()`;
- SSRM: `api.retryServerSideLoads()`.

Selection-supporting errors that do not mean row loading failed should remain separate from the grid-level datasource error.

## Stable row identity

Server-backed grids use the backend record ID:

```ts
getRowId={({ data }) => data.id}
```

Do not use row index as identity. Sorting/filtering/pagination/cache reloads can change row positions while the logical record remains the same.

## Upgrade procedure

Keep `ag-grid-community`, `ag-grid-react` and `ag-grid-enterprise` on exactly the same version and upgrade them together.

After an AG Grid upgrade, verify:

1. module and Enterprise license initialization;
2. global GridOptions/theme integration;
3. Infinite datasource behavior;
4. SSRM datasource behavior;
5. Infinite selection lifecycle tests;
6. SSRM selection lifecycle tests;
7. server-side selection-state adapter/API registration;
8. Transactions sorting/filtering against the backend contract;
9. development payload preview still remains development-only;
10. TypeScript and production build.

If Grid/Column State persistence has been introduced, include state restore/migration behavior in the upgrade verification.

## Remaining architecture work

The main planned foundation item still outstanding is native AG Grid Grid/Column State for user-configurable table state such as column order, width, visibility, sorting and filters.

Implement this with AG Grid's native state APIs rather than inventing parallel React state.

Do not speculatively implement SSRM grouping, pivot, aggregation, tree data, generalized business-grid wrappers, or database-backed preference storage until a real product requirement exists.
