# Infinite Row Model implementation guide

This document is the current source of truth for the repository's AG Grid **Infinite Row Model** implementation.

Its scope is Infinite Row Model only. Shared capabilities are linked where useful, but this guide does not document other row-model implementations.

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

See [API and data flow](../api-data-flow.md), [AG Grid native usage](../ag-grid-native-usage.md), and [Reusable server-backed grid guide](../server-backed-grid-reuse.md).

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

Read the full [Infinite selection contract](infinite-selection.md).

## Selected count

```text
explicit/manual/current-page
→ exact included ID count

All Filtered
→ API filteredCount - user exceptions

All Records
→ API totalCount - user exceptions
```

See [Selected-row totals](../selection-counts.md).

## Editing and conflicts

Infinite uses the shared stable-ID tracked editing engine. Unsaved LOCAL work lives outside transient RowNodes so block eviction/reload cannot destroy drafts.

Fresh block data is reconciled against BASE / LOCAL / REMOTE state before remaining LOCAL values are restored to loaded RowNodes.

See [Transaction editing](../transaction-editing.md) and [Edit conflict reconciliation](../edit-conflict-reconciliation.md).

## Row interaction

Loaded-row selection/editability uses the shared `enabled | selectionDisabled | readOnly` semantics mapped to native AG Grid callbacks. Backend authority remains required for unloaded rows and server-wide operations.

See [Row interaction](../row-interaction.md).

## Export

Current Page uses native AG Grid CSV over the exact resolved pagination page.

Selected export is backend-owned because Infinite logical selection may include unloaded rows.

See [Grid export](../grid-export.md).

## Grid State and lifecycle

The concrete Infinite root owns its `GridApi`, Grid State persistence lifecycle, datasource replacement, refresh and teardown.

## Main implementation entry points

- `frontend/src/features/transactions/grid/TransactionsInfiniteGrid.tsx`
- `frontend/src/shared/grid/data/infinite/createInfiniteDatasource.ts`
- `frontend/src/shared/grid/data/infinite/useInfiniteRowLoading.ts`
- `frontend/src/shared/grid/selection/infinite/useInfiniteSelectionController.tsx`
- `frontend/src/features/transactions/grid/transactionRequest.mapper.ts`

For the searchable frontend footprint, use `GRIDCAP-ROWMODEL-INFINITE` in the [capability tag registry](../grid-capability-tags.md).

## Verification

Use [Server-backed manual regression](../testing/server-backed-manual-testing.md) for the current Infinite browser scenarios.

Manual verification must not be marked complete unless the Infinite scenarios were actually run.
