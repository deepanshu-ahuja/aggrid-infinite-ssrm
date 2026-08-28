# Grid export

This document records the current export capability for the server-backed Infinite and SSRM grids, why the capability exists, and which side owns each export scope.

## Why grid applications need export

Export lets users take grid data outside the application for workflows the grid itself is not meant to replace, for example:

- spreadsheet analysis, pivots and reconciliation;
- reporting and sharing with another team;
- offline review;
- audit/evidence snapshots;
- downstream processing in another system.

A production product may eventually need many scopes such as Current Page, Selected, All Filtered or All Records. This foundation intentionally starts with only the two scopes already justified by the current server-backed grids.

## Current capability

```text
Export Current Page
Export Selected
```

The two operations have different ownership because their data availability is different.

## Export Current Page

Current Page is already represented by concrete loaded RowNodes in the browser.

Flow:

```text
current AG Grid pagination page
        ↓
resolve exact current-page RowNodes
        ↓
native api.exportDataAsCsv(...)
        ↓
browser download
```

The shared helper `shared/grid/export/exportCurrentPageCsv.ts` does **not** serialize CSV itself. AG Grid remains responsible for CSV escaping, grid column behavior and value export semantics.

Our helper only supplies the product scope: exactly which concrete RowNodes belong to the current page.

If the current page is not fully resolved yet, export is refused rather than silently producing a partial page.

This same current-page helper is used by both Infinite and SSRM because the meaning and mechanics are genuinely identical once concrete page RowNodes exist.

## Export Selected

Selected export is backend-owned for both server-backed row models.

Reason: dataset-wide selection may include rows that have never been loaded in the browser. Loading every selected server row into AG Grid merely to build a file would defeat the purpose of Infinite/SSRM.

Flow:

```text
row-model-specific selection state
        ↓
common logical selection target
        ↓
POST /api/transactions/selection/export/
        ↓
backend resolves authoritative selected rows
        ↓
backend writes CSV
        ↓
browser downloads transactions-selected.csv
```

## Infinite and SSRM still select differently

The export endpoint is shared, but the grids do **not** share one selection controller.

### Infinite

Infinite may produce:

```text
Manual / Current Page
-> include explicit IDs

All Filtered / All Records
-> exclude-mode logical selection with user exceptions
```

Dataset-wide Infinite selection is application-owned because unloaded Infinite rows do not have selectable RowNodes.

### SSRM

SSRM may produce:

```text
Manual
-> native explicit SSRM state translated to IDs

All Records
-> native SSRM server-side selection state

Current Page
-> explicit page rows

All Filtered
-> custom filtered-wide state
```

The internal mechanics differ, but before the backend operation both roots build the same business-level target.

## Common logical selection target

Conceptually:

### Explicit rows

```json
{
  "selection": {
    "mode": "include",
    "ids": ["txn-1", "txn-9"]
  },
  "filters": []
}
```

### All Records except explicit user exclusions

```json
{
  "selection": {
    "mode": "exclude",
    "ids": ["txn-5", "txn-10"]
  },
  "filters": []
}
```

### All Filtered except explicit user exclusions

```json
{
  "selection": {
    "mode": "exclude",
    "ids": ["txn-5", "txn-10"]
  },
  "filters": [
    {
      "field": "status",
      "operator": "equals",
      "value": "Pending"
    }
  ]
}
```

The same target builder is used by selection-based business mutations and Export Selected so the two operations cannot silently interpret "selected" differently.

## Backend selection resolver

The backend function `resolve_transactions_by_selection(...)` answers one operation-neutral question:

> Which authoritative backend rows does this logical selection represent?

It handles:

```text
include + ids
-> those exact rows, subject to backend selection eligibility

exclude + filters
-> all matching eligible rows minus user exception IDs

exclude + no filters
-> all eligible records minus user exception IDs
```

Then different operations can reuse that resolved set:

```text
Update Selected Status ─┐
                        ├─> resolve_transactions_by_selection(...)
Export Selected ────────┘
```

This prevents separate export/update implementations from drifting apart.

## Backend eligibility remains authoritative

`selectionDisabled` and `readOnly` rows are removed by the backend resolver even if a dataset-wide UI count currently includes them under the documented count limitation.

That means:

```text
visible selected total
may be approximate for eligibility

actual selected export
is backend-authoritative
```

See [Selected-row totals](selection-counts.md) for that limitation and the future eligibility-aware count option.

## Current CSV fields

Selected export currently writes:

```text
id
reference
account
amount
currency
status
transactionDate
```

Grid interaction metadata such as `interactionMode` / `interactionReason` is not included because it controls application behavior rather than representing normal transaction business data.

## What is deliberately not built yet

Decide these only when a real product needs them:

- Excel export versus CSV;
- Export All Filtered independent of selection;
- Export All Records independent of selection;
- visible columns versus fixed business export schema;
- raw versus formatted values;
- permissions/audit controls;
- very large asynchronous export jobs with progress/history/download links.

Client-Side Row Model should later expose the same user-facing export concepts using native/local ownership where all rows are already available in browser memory. It should not inherit server-only selected-export resolution unnecessarily.

## Implementation map

```text
shared/grid/export/exportCurrentPageCsv.ts
-> native current-page CSV boundary

features/transactions/grid/useTransactionExport.ts
-> shared export operation lifecycle

features/transactions/grid/TransactionsInfiniteGrid.tsx
features/transactions/grid/TransactionsSsrmGrid.tsx
-> row-model-specific selection target creation

features/transactions/grid/transactionSelectionAction.ts
-> common logical selection target/request mapping

backend/apps/transactions/services.py
-> resolve_transactions_by_selection(...)

backend/apps/transactions/api/views.py
-> POST selected-export endpoint and CSV response
```

See [Pre-Client manual testing](pre-client-manual-testing.md) for exact verification steps.
