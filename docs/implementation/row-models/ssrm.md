# Server-Side Row Model (SSRM) implementation guide

This is the current row-model entry point for AG Grid Enterprise **Server-Side Row Model (SSRM)** in this repository.

Use this document when you want to understand or extract the SSRM implementation without first reading the Client or Infinite implementation.

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
- the shared flat SSRM datasource adapter;
- stable backend `getRowId`;
- backend sort/filter mapping;
- request cancellation on datasource destruction;
- latest-started-request ownership for renderable `totalCount` / `filteredCount` metadata;
- native `refreshServerSide()` after successful writes;
- native `retryServerSideLoads()` for failed loads.

The current backend contract is flat. Grouping, tree data, aggregation and pivot request semantics are not implemented.

See [API and data flow](../api-data-flow.md), [AG Grid native usage](../ag-grid-native-usage.md), and [Reusable server-backed grid guide](../server-backed-grid-reuse.md).

## Selection

SSRM deliberately uses native Enterprise selection where AG Grid represents the requirement:

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

The shared logical target remains only `include | exclude` plus IDs; backend eligibility stays authoritative.

Read the full [SSRM selection contract](ssrm-selection.md).

## Selected count

```text
explicit/manual/current-page
→ exact included/native ID count

All Filtered
→ API filteredCount - user exceptions

All Records
→ API totalCount - user exceptions
```

See [Selected-row totals](../selection-counts.md).

## Editing and conflicts

SSRM reuses the shared stable-ID tracked editing engine. Unsaved LOCAL work is not stored only in RowNodes because SSRM store refresh/recreation can replace them.

Fresh SSRM rows are reconciled against BASE / LOCAL / REMOTE state before remaining LOCAL values are restored.

See [Transaction editing](../transaction-editing.md) and [Edit conflict reconciliation](../edit-conflict-reconciliation.md).

## Row interaction

Loaded-row selectability/editability uses native AG Grid callbacks over the shared `enabled | selectionDisabled | readOnly` meaning. Backend authority protects unloaded rows and server-wide operations.

See [Row interaction](../row-interaction.md).

## Export

Current Page uses native AG Grid CSV over the exact resolved pagination page.

Selected export is backend-owned because native/custom SSRM logical selection can include unloaded rows.

See [Grid export](../grid-export.md).

## Grid State and lifecycle

The concrete SSRM root owns its `GridApi`, SSRM datasource/store lifecycle, Grid State persistence, native selection APIs, retry, refresh and teardown. Do not force SSRM through Infinite mechanics for code symmetry.

## Main implementation entry points

- `frontend/src/features/transactions/grid/TransactionsSsrmGrid.tsx`
- `frontend/src/shared/grid/data/server-side/createServerSideDatasource.ts`
- `frontend/src/shared/grid/data/server-side/useServerSideRowLoading.ts`
- `frontend/src/shared/grid/selection/server-side/useSsrmSelectionController.ts`
- `frontend/src/shared/grid/gridModules.ts`
- `frontend/src/features/transactions/grid/transactionRequest.mapper.ts`

For the searchable frontend footprint, use `GRIDCAP-ROWMODEL-SSRM` in the [capability tag registry](../grid-capability-tags.md).

## Verification

Use [Server-backed manual regression](../testing/server-backed-manual-testing.md) for the current SSRM browser scenarios. A successful Client or Infinite run does not substitute for SSRM verification.
