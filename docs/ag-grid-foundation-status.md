# AG Grid Foundation Status

This document records what the project has already established around AG Grid, what those decisions cover, and what is intentionally still future work.

It is a status/guardrail document, not a replacement for the detailed Infinite and SSRM selection-contract documents.

## Goal

Build a reusable React 19 + Vite + TypeScript AG Grid foundation for server-backed application tables without creating an application-specific grid framework that hides AG Grid.

The operating rule is:

> Use native AG Grid behavior and APIs first. Share configuration and utilities only when they are genuinely common.

Infinite Row Model and Server-Side Row Model (SSRM) stay as separate implementations because their datasource, cache and selection lifecycles are materially different.

## Completed foundation

### Application bootstrap

- AG Grid Enterprise license initialization is centralized.
- Required AG Grid modules are registered centrally through `AgGridProvider`.
- SSRM API support is explicitly registered for native server-side selection APIs.
- Development validations are enabled in development builds.

### Native grid surface

Feature grids render `AgGridReact` directly.

The former `AppGrid` React wrapper has been removed. It added no useful application behavior and made the native AG Grid boundary less visible.

Application-wide defaults now use AG Grid's native `provideGlobalGridOptions` mechanism.

Today the intentionally small global surface is:

- application AG Grid theme;
- `defaultColDef` shared by all grids.

Row-model behavior, datasource wiring, selection, IDs and lifecycle callbacks remain visible on the owning feature grid.

### Shared server-backed defaults

The project has shared defaults for pagination and block/cache behavior while retaining AG Grid's native option names.

Current defaults include:

- pagination enabled;
- 25-row default page size;
- page-size choices 10 / 25 / 50;
- 50-row datasource blocks;
- maximum five cached blocks;
- 120 ms block-load debounce;
- one concurrent datasource request.

A feature can override an individual option when there is a measured UX/backend reason to differ.

### Native Grid State persistence

User table preferences now use AG Grid's native `GridState` instead of parallel React state.

The shared persistence boundary stores only state that is genuinely common to both current row models:

- column order;
- column pinning;
- column widths;
- column visibility;
- filter state;
- sort state.

Each row model has its own persistence key:

- `transactions:infinite`;
- `transactions:ssrm`.

This separation is deliberate. Infinite and SSRM may support different native state capabilities over time, so one row model must never overwrite the other's saved preferences.

State is restored through native `initialState` and saved from native `onStateUpdated` events. The grids themselves do not contain `localStorage` calls.

The current storage implementation uses browser storage behind `GridStateStore`. A future user/profile API can replace that implementation without changing AG Grid lifecycle wiring.

Two state areas are deliberately not persisted:

- pagination position, because restore requirements differ by row model and page position is not currently a required preference;
- row selection, because SSRM can restore native selection state while Infinite cannot, and selection in this application is transient business state rather than a durable layout preference.

### Infinite Row Model

The Transactions Infinite implementation covers:

- server block loading through a reusable Infinite datasource adapter;
- backend sorting and filtering through the Transactions request mapper;
- stable backend row identity through `getRowId`;
- pagination and bounded cache behavior;
- datasource error overlay and native Infinite cache retry;
- selection restoration when blocks are evicted/reloaded;
- current-page header selection;
- filtered-dataset Select All;
- all-records Select All;
- include/exclude logical selection representation;
- filtered totals derived from AG Grid's accepted Infinite model rather than arbitrary async response order;
- programmatic checkbox synchronization using source `api` to avoid feedback loops.

Important lifecycle rules are documented in `frontend/src/infinite-selection-contract.md`.

### SSRM

The Transactions SSRM implementation covers:

- reusable flat SSRM datasource wiring;
- server-side sorting/filtering through the same Transactions request mapper;
- stable backend row identity;
- native SSRM All Records selection through AG Grid server-side selection state;
- explicit Current Page selection because SSRM does not support native `currentPage` Select-All mode;
- explicit All Filtered selection because SSRM does not support native `filtered` Select-All mode;
- selection restoration for newly loaded/reloaded RowNodes while custom filtered selection is active;
- filter-change invalidation of custom filtered Select All;
- native SSRM failed-load retry;
- flat server-side selection-state adapter with validation.

Important lifecycle rules are documented in `frontend/src/ssrm-selection-contract.md`.

### Backend-facing selection contract

Logical selection contains only:

```ts
{
  mode: 'include' | 'exclude',
  ids: string[],
}
```

The UI scope (`page`, `filtered`, `all`) is not duplicated into that logical object.

For backend actions:

- `include` means exact IDs;
- filtered `exclude` combines exceptions with mapped backend filters;
- all-records `exclude` combines exceptions with an explicit empty filter list;
- page + exclude is invalid and fails loudly.

The generic builder is `buildGridBulkSelection(...)`.

Transactions-specific context is handled by `buildTransactionBulkSelection(...)`.

Normal row loading and filtered bulk membership reuse the same `mapTransactionFilterModel(...)` mapping so the grid query and a future bulk action cannot silently disagree about filter meaning.

### Development payload validation

Until real bulk actions exist, development builds retain payload-preview controls so developers can manually inspect the exact backend-facing selection payload.

These controls are development-only via `import.meta.env.DEV` and must not appear in production builds.

They do not call a bulk backend endpoint.

Once real Export/Delete/Approve/etc. actions exist, their actual request payload becomes the preferred inspection point and the development preview can be removed.

### Tests

Regression coverage exists around:

- Infinite selection strategies;
- Infinite AG Grid lifecycle wiring;
- SSRM native/custom selection transitions;
- datasource adapters;
- server-side selection-state mapping;
- generic and Transactions bulk-selection builders;
- Transactions sort/filter request mapping;
- Grid State preference filtering and browser persistence behavior.

Tests should focus on our contracts and lifecycle wiring, not reimplement AG Grid's internal test suite.

## Architecture rules established

1. Use native AG Grid functionality before adding application code.
2. Do not wrap `AgGridReact` merely to forward props or inject defaults.
3. Put truly application-wide GridOptions in `provideGlobalGridOptions`; keep feature/row-model behavior local.
4. Keep Infinite and SSRM as separate implementations.
5. Shared datasource utilities may adapt AG Grid callbacks, but must not pretend different row models have identical capabilities.
6. Use stable backend IDs for row identity.
7. Selection state must survive row-node/cache lifetime when product semantics require it.
8. Sorting does not clear selection merely because row positions changed.
9. Filter-change selection behavior depends on selection semantics; do not add one blanket reset rule.
10. Reuse the same backend filter mapper for normal queries and filtered bulk actions.
11. Use native `GridState` for grid preferences; do not create a second application-owned representation of column/filter/sort state.
12. Treat Infinite and SSRM state capabilities independently when AG Grid support differs.
13. Explain AG Grid lifecycle and design rationale in comments/JSDoc, especially around API-driven selection and async row loading.

## Remaining foundation work

### Final foundation review

After this Grid State work is merged:

- run the complete frontend test suite;
- run TypeScript/build validation;
- manually verify state survives reload for the active Infinite configuration;
- switch the configured table to SSRM and verify its separate saved state;
- review shared grid code for unnecessary abstractions;
- keep architecture/convention docs synchronized;
- then consider the current grid foundation complete.

## Intentionally outside current foundation scope

Do not implement these speculatively:

- actual Delete/Approve/Export bulk endpoints;
- advanced SSRM capabilities that the planned tables do not require;
- database-backed user grid preferences before a real user/persistence requirement exists;
- generalized business-grid wrappers;
- Docker infrastructure for this Databricks same-repository application.

Those should be introduced only when a real product requirement justifies them.
