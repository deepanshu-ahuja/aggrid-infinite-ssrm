# Selected-row totals

This document is the source of truth for the **user-visible selected-row total** in the server-backed Infinite Row Model and Server-Side Row Model (SSRM).

It deliberately separates two questions:

1. **How does this row model represent the user's selection?**
2. **What number should the UI display as selected?**

The selection representation is row-model-specific. The dataset-wide count source is intentionally the same for both row models.

## API count contract

Every normal Transactions row request returns:

```json
{
  "rows": [],
  "totalCount": 750,
  "filteredCount": 120
}
```

Meaning:

```text
totalCount
-> complete dataset size before the current grid filters

filteredCount
-> number of rows matching the current grid filters
```

No extra count-only request is made when the user clicks Select All.

## Current selected-count rules

| User selection | Displayed count |
| --- | --- |
| Manual / explicit rows | exact number of included row IDs |
| Current Page | exact number of included row IDs |
| Select All Filtered | `filteredCount - user deselection exceptions` |
| Select All Records | `totalCount - user deselection exceptions` |

Example:

```text
API totalCount = 750
API filteredCount = 120

Select All Records
-> 750 selected

Deselect 2 rows
-> 748 selected

Select All Filtered
-> 120 selected

Deselect 2 rows
-> 118 selected
```

The common pure helper `shared/grid/selection/selectionCount.ts` performs the include/exclude count math. It does not know about Infinite, SSRM, Transactions, filters, or HTTP.

## Infinite Row Model

Infinite keeps its existing row-model-specific selection behavior:

```text
Manual / Current Page
-> native AG Grid explicit selected IDs

All Filtered / All Records
-> compact application-owned include/exclude state
-> required because unloaded Infinite rows do not have RowNodes that AG Grid can select natively
```

For **counting**, Infinite now uses the normal API response consistently:

```text
All Filtered -> API filteredCount
All Records  -> API totalCount
```

The selected count therefore does not depend on how many Infinite rows happen to be loaded in the browser.

`api.isLastRowIndexKnown()` is useful row-model information, but it is **not** the source of the selected total in the current design. The backend already supplies the required total/query counts directly.

## Server-Side Row Model (SSRM)

SSRM keeps its own selection behavior:

```text
Manual selection
-> native SSRM selection state

All Records
-> native SSRM server-side Select All state

Current Page
-> explicit loaded-row selection helper

All Filtered
-> custom filtered-wide product semantic because SSRM's native Select All modes do not provide this exact flat behavior for our current contract
```

For **counting**, SSRM uses the same normal API values as Infinite:

```text
All Filtered -> API filteredCount
All Records  -> API totalCount
```

So the two server-backed row models share the business count contract without being forced through the same selection implementation.

## Out-of-order API responses

Page direction must not affect which API response owns the displayed count.

Both datasource adapters use the same rule:

> **The most recently started row request is the only completed request allowed to publish `totalCount` / `filteredCount` into renderable count state.**

Example when paging forward:

```text
request page 1 starts
request page 2 starts
request page 2 returns first -> publish its count metadata
request page 1 returns late  -> do not overwrite the metadata
```

The same rule works when paging backward:

```text
request page 3 starts
request page 2 starts
request page 2 returns first -> publish its count metadata
request page 3 returns late  -> do not overwrite the metadata
```

The rule is about **request start order**, not higher/lower page number.

A filter change also follows the same rule. When a new filter request starts, the old `filteredCount` is cleared until the newest request publishes the count for the new filtered universe.

AG Grid may still complete an older request for its own row-model lifecycle; the stale guard described here is specifically for React/UI count metadata.

## `selectionDisabled` / `readOnly` limitation

The current API counts describe dataset/query membership, not selection eligibility.

Therefore this can happen:

```text
totalCount = 750
25 rows are selectionDisabled/readOnly
Select All Records UI = 750 selected
backend business action/export resolves 725 eligible rows
```

That limitation is intentional for the current foundation.

We do **not** subtract only disabled rows currently loaded in the browser. For a server-backed dataset, unloaded pages may contain additional disabled rows, so that would create a number that looks exact but is not.

The backend remains authoritative for business operations and selected export and excludes ineligible rows.

## Future production option

If a real product requires an exact **actionable** selected total, extend the normal row API with eligibility-aware counts such as:

```text
selectionEligibleTotalCount
selectionEligibleFilteredCount
```

Then the count formulas become:

```text
All Records
= selectionEligibleTotalCount - user exceptions

All Filtered
= selectionEligibleFilteredCount - user exceptions
```

The Infinite/SSRM selection representations and include/exclude count helper do not need to be redesigned.

## Implementation map

```text
backend/apps/transactions/services.py
-> produces totalCount / filteredCount

shared/grid/data/infinite/*
shared/grid/data/server-side/*
-> accept newest API count metadata and reject stale metadata

shared/grid/selection/selectionCount.ts
-> include/exclude count math

shared/grid/selection/infinite/useInfiniteSelectionController.tsx
-> Infinite selection representation + count input

features/transactions/grid/TransactionsSsrmGrid.tsx
-> SSRM selection representation + count input

features/transactions/grid/TransactionSelectionActions.tsx
-> presentation only: renders "N selected"
```

See [Pre-Client manual testing](pre-client-manual-testing.md) for verification scenarios.
