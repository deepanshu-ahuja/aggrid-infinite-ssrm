# Grid Export

This document describes the **current implemented** export behavior across Client-Side, Infinite and SSRM grids.

It is an implementation reference. Planned export variants belong in the backlog, not here.

## Current capability

The foundation currently supports two export actions:

```text
Export Current Page
Export Selected
```

Their ownership differs because Current Page is always a concrete visible page, while Selected can represent unloaded rows in the server-backed row models.

## Export Current Page

All three row models use the shared `exportCurrentPageCsv(...)` helper.

Flow:

```text
current AG Grid pagination page
        ↓
resolve exact current-page RowNodes
        ↓
api.exportDataAsCsv(...)
        ↓
CSV download
```

The helper does not serialize CSV itself. AG Grid owns CSV escaping, column export behavior and value processing.

The application helper owns only the page boundary.

If the expected pagination page is not fully materialised, the operation is refused instead of exporting a partial page.

### Restricted rows on Current Page

Current Page is a page snapshot, not a selected-row business operation.

Therefore displayed rows remain part of the export even when their interaction mode is:

```text
selectionDisabled
readOnly
```

Those modes restrict selection/editing/business operations; they do not remove a row from the visible page.

## Export Selected — Client-Side

Client has the complete bounded working set in browser memory and native AG Grid owns the exact selected set.

Flow:

```text
native Client selection
        ↓
api.exportDataAsCsv({
  onlySelected: true,
  onlySelectedAllPages: true
})
        ↓
CSV download
```

`onlySelectedAllPages` is required because selected Client rows can exist on several pagination pages.

Client does not call the backend selected-export endpoint.

Rows whose interaction mode prevents native selection never enter the selected set, so Client Selected export naturally contains only selected selectable rows.

## Export Selected — Infinite and SSRM

Infinite and SSRM selected universes may include backend rows that have never been loaded into the browser.

Therefore Selected export is backend-owned for those two row models.

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
backend applies selection eligibility
        ↓
backend writes CSV
        ↓
CSV download
```

The browser does not load every selected server row merely to build a file.

## Server-backed logical selection target

The server-backed export path uses the same logical target semantics as selected business operations.

### Explicit rows

```json
{
  "selection": {
    "mode": "include",
    "ids": ["txn-1", "txn-9"]
  }
}
```

### All Records except user exceptions

```json
{
  "selection": {
    "mode": "exclude",
    "ids": ["txn-5", "txn-10"]
  }
}
```

### All Filtered except user exceptions

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

The feature mapper translates the current AG Grid filter model for filtered-wide server selection.

## Backend resolver ownership

`resolve_transactions_by_selection(...)` resolves the authoritative backend rows represented by the server logical selection.

Current meaning:

```text
include + ids
→ requested backend-eligible rows

exclude + filters
→ all matching backend-eligible rows minus explicit user exceptions

exclude without filters
→ all backend-eligible records minus explicit user exceptions
```

The same resolver is used by selected mutation and selected export paths so those operations do not reinterpret the word "selected" differently.

## Row-model selection ownership remains separate

The common backend target does not create one common selection controller.

### Infinite

Infinite currently produces:

```text
Manual / Current Page
→ explicit include IDs

All Filtered / All Records
→ compact exclude-mode application selection with user exceptions
```

### SSRM

SSRM currently produces:

```text
Manual
→ native explicit SSRM state translated to IDs

All Records
→ native SSRM server-side selection state

Current Page
→ explicit page IDs

All Filtered
→ custom filtered-wide application state
```

Each controller owns its own native/custom mechanics; only the final business-level target is shared.

## Eligibility and displayed selected count

For Infinite/SSRM, backend-selected export always applies backend eligibility even when the current dataset-wide selected count is based on `totalCount` / `filteredCount` and can therefore include backend-ineligible unloaded rows.

So this can legitimately occur:

```text
UI dataset-wide selected count
> number of rows written to Selected CSV
```

The count limitation is documented in `docs/selection-counts.md`.

## Current Selected CSV fields

The backend Selected export currently writes:

```text
id
reference
account
amount
currency
status
transactionDate
```

Grid interaction metadata is not included in the Transaction business CSV.

## Implementation map

```text
frontend/src/shared/grid/export/exportCurrentPageCsv.ts
→ shared native Current Page export boundary

frontend/src/shared/grid/export/exportSelectedRowsCsv.ts
→ Client native/local Selected export

frontend/src/features/transactions/grid/useTransactionExport.ts
→ server-backed selected-export request lifecycle

frontend/src/features/transactions/grid/TransactionsClientGrid.tsx
→ Client Current Page + local Selected wiring

frontend/src/features/transactions/grid/TransactionsInfiniteGrid.tsx
frontend/src/features/transactions/grid/TransactionsSsrmGrid.tsx
→ server-backed Current Page + logical Selected wiring

frontend/src/features/transactions/grid/transactionSelectionAction.ts
→ server logical selection target mapping

backend/apps/transactions/services.py
→ authoritative selected-row resolver

backend/apps/transactions/api/views.py
→ selected-export endpoint and CSV response
```

## Verification expectations

Current automated/manual verification should cover:

- Client Current Page exports exactly the current page;
- Infinite/SSRM Current Page exports exactly the fully resolved current page;
- Current Page includes displayed restricted rows;
- Client Selected exports selected rows across pagination pages without a backend selected-export request;
- Infinite/SSRM explicit Selected exports only backend-eligible selected IDs;
- Infinite/SSRM All Filtered export uses current translated filters and user exceptions;
- Infinite/SSRM All Records export uses the complete logical target minus user exceptions;
- server-backed Selected export excludes backend-ineligible rows.

Manual browser verification remains separately tracked and is not claimed complete here.
