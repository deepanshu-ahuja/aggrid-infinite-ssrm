# AG Grid Architecture

## Shared layer

`shared/grid/AppGrid.tsx` is intentionally thin. It merges the default column definition and supplies the application AG Grid theme while forwarding native props and refs. `gridModules.ts` centralizes module registration so version upgrades and Enterprise module decisions have one integration point.

Reusable, library-level utilities live under `shared/grid`, including formatters and the two datasource factories. They accept a `GridRowsLoader` that loads a flat row block and returns rows plus the known total.

## Row-model scope

Infinite Row Model is the default application path. Its datasource adapts `getRows` callbacks into the shared flat loader shape.

The SSRM datasource is a small Enterprise trial equivalent for flat paging, sorting and filtering. It exists so a feature can choose SSRM without putting SSRM callbacks in React components. It does not interpret group keys, value columns, pivots or aggregation requests.

If a real feature later needs richer SSRM behavior, extend that feature's backend contract and datasource intentionally. Do not make the current flat loader pretend that Infinite and all SSRM modes are interchangeable.

## Feature configuration

`features/transactions/transactionsGrid.config.ts` records the client/product decision. `TransactionsPage` renders either `TransactionsInfiniteGrid` or `TransactionsSsrmGrid`; there is no row-model tab/toggle and the two implementations are not merged into one table.

Both components use the thin shared `AppGrid`, their own datasource factory, and the same feature API mapper. Infinite composes separate current-page and filtered/all selection hooks. SSRM remains an independent flat Enterprise table that can evolve separately if a real SSRM requirement appears.

Set the rendered table here:

```ts
activeGrid: 'infinite'; // Change to 'ssrm' for that client build.
```

### Infinite table configuration

| Configuration                                          | Current/supported values            | What it controls                                                      |
| ------------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------- |
| `infinite.selectionScope`                              | `page` (current), `filtered`, `all` | Meaning of the Infinite custom header checkbox.                       |
| `infinite.gridOptions.pagination`                      | `true`                              | Enables pagination over Infinite server blocks.                       |
| `infinite.gridOptions.paginationPageSize`              | `25`                                | Rows shown on the initial page.                                       |
| `infinite.gridOptions.paginationPageSizeSelector`      | `[10, 25, 50]`                      | Page-size choices shown in AG pagination.                             |
| `infinite.gridOptions.cacheBlockSize`                  | `50`                                | Rows requested per backend block; currently covers two default pages. |
| `infinite.gridOptions.maxBlocksInCache`                | `5`                                 | Bounds cached Infinite blocks in browser memory.                      |
| `infinite.gridOptions.blockLoadDebounceMillis`         | `120`                               | Delays rapid block requests while the viewport changes.               |
| `infinite.gridOptions.maxConcurrentDatasourceRequests` | `2`                                 | Bounds simultaneous Infinite requests.                                |

### SSRM table configuration

| Configuration                                      | Current value  | What it controls                                     |
| -------------------------------------------------- | -------------- | ---------------------------------------------------- |
| `ssrm.gridOptions.pagination`                      | `true`         | Enables pagination for the separate flat SSRM table. |
| `ssrm.gridOptions.paginationPageSize`              | `25`           | Rows shown on the initial SSRM page.                 |
| `ssrm.gridOptions.paginationPageSizeSelector`      | `[10, 25, 50]` | SSRM page-size choices.                              |
| `ssrm.gridOptions.cacheBlockSize`                  | `50`           | Rows requested for one SSRM cache block.             |
| `ssrm.gridOptions.maxBlocksInCache`                | `5`            | Bounds cached SSRM blocks.                           |
| `ssrm.gridOptions.blockLoadDebounceMillis`         | `120`          | Delays rapid SSRM block requests.                    |
| `ssrm.gridOptions.maxConcurrentDatasourceRequests` | `1`            | Bounds simultaneous SSRM requests.                   |

The `gridOptions` keys remain native `AgGridReactProps` names so developers can use AG Grid documentation directly. They are separate objects because the two tables may require different values later.

## AG Grid terms used in this project

You do not need to know all of AG Grid to maintain these tables. These are the few terms used by
the implementation:

| Term                 | Plain meaning in this project                                                       |
| -------------------- | ----------------------------------------------------------------------------------- |
| row model            | The strategy AG uses to obtain rows. We have separate Infinite and SSRM components. |
| datasource           | An object AG calls when it needs more rows.                                         |
| block                | One downloaded batch of rows, such as rows 0-49. It is not a pagination page.       |
| cache                | The downloaded blocks AG keeps in the browser to avoid requesting them again.       |
| `GridApi`            | AG's object for inspecting or changing the running table after it starts.           |
| row node             | AG's browser-side object for one loaded row. Unloaded server rows have no row node. |
| `selectionColumnDef` | Configuration for the checkbox column only.                                         |

## Server selection

Infinite uses two deliberately separate selection hooks:

- `useCurrentPageSelection` stores explicit loaded IDs using include mode and contains no exclude or backend-total logic;
- `useDatasetSelection` handles both filtered and all scope because both use the same include/exclude rules;
- `filtered` supplies the total matching the current backend filters;
- `all` supplies an unfiltered total from a separate lightweight request;
- manually unchecking a loaded row in filtered/all mode adds its ID as an exclusion.

Infinite feature configuration chooses one scope; the application does not show a scope/demo chooser. Sort or filter changes clear selection so an old include/exclude intent cannot silently target a different result set. The optional `onSelectionChange` callback exposes a serializable intent for a future bulk action without implementing that action prematurely.

The runtime flow is:

1. AG asks the Infinite datasource for a block of rows.
2. The feature mapper converts AG's sort/filter request into the Django API payload.
3. Django returns rows and the matching total; AG stores the rows in its cache.
4. `TransactionsInfiniteTable` owns native AG events and translates them into row IDs/booleans.
5. The configured selection hook decides which IDs are selected.
6. The table applies that result to checkboxes on rows AG has loaded.

## Upgrade procedure

Keep `ag-grid-community`, `ag-grid-react` and `ag-grid-enterprise` on the exact same version. Upgrade them together, then verify:

1. module and license initialization;
2. `AppGrid` prop/ref typing;
3. theme parameters;
4. Infinite and SSRM datasource tests;
5. transaction sorting/filtering against Django;
6. the production build.

Feature code should continue to use native AG Grid types and APIs where appropriate; the shared layer is not a compatibility clone.
