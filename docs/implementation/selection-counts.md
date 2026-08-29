# Selected-row totals

The user-visible selected-row total follows the selection representation owned by each row model.

## Client-Side Row Model

The complete working set is local and AG Grid evaluates native row selectability for every row.

The selected count is therefore exact:

```text
selected count
= api.getSelectedRows().length
```

This remains exact for native Client Select All scopes:

```text
currentPage
filtered
all
```

Rows whose interaction mode makes them non-selectable never enter the native selected set.

For the current deterministic Transactions demo:

```text
750 total rows
- 63 selectionDisabled rows
- 63 readOnly rows
= 624 selectable rows
```

With the current Client default `all` scope, header Select All therefore displays 624 selected.

## Server-backed API count contract

Normal Infinite/SSRM row requests return:

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
→ complete dataset size before the current grid filters

filteredCount
→ number of rows matching the current grid filters
```

No extra count-only request is made when the user clicks Select All.

## Infinite and SSRM selected-count rules

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
→ 750 selected

Deselect 2 rows
→ 748 selected

Select All Filtered
→ 120 selected

Deselect 2 rows
→ 118 selected
```

The pure helper `frontend/src/shared/grid/selection/selectionCount.ts` performs include/exclude count math. It does not own row-model selection state, filters, HTTP, or Transaction business rules.

## Infinite Row Model

Infinite selection representation is:

```text
Manual / Current Page
→ native AG Grid explicit selected IDs

All Filtered / All Records
→ compact application-owned include/exclude state
```

For dataset-wide counting:

```text
All Filtered
→ API filteredCount - user exceptions

All Records
→ API totalCount - user exceptions
```

The selected count does not depend on how many Infinite rows happen to be loaded in the browser.

`api.isLastRowIndexKnown()` is not the selected-total source because the backend response already provides the required query counts.

## Server-Side Row Model (SSRM)

SSRM selection representation is:

```text
Manual selection
→ native SSRM selection state

All Records
→ native SSRM server-side Select All state

Current Page
→ explicit current-page RowNodes

All Filtered
→ application-owned filtered-wide state
```

For dataset-wide counting:

```text
All Filtered
→ API filteredCount - user exceptions

All Records
→ API totalCount - user exceptions
```

SSRM keeps its own selection mechanics while consuming the same server query-count contract for dataset-wide totals.

## Out-of-order server responses

Page direction must not affect which API response owns the displayed server-backed count metadata.

The rule is:

> The most recently started row request is the only completed request allowed to publish `totalCount` / `filteredCount` into renderable count state.

Forward example:

```text
request page 1 starts
request page 2 starts
request page 2 returns first
→ publish page 2 count metadata

request page 1 returns later
→ do not overwrite the metadata
```

Backward example:

```text
request page 3 starts
request page 2 starts
request page 2 returns first
→ publish page 2 count metadata

request page 3 returns later
→ do not overwrite the metadata
```

The rule is based on request start order, not page number.

A filter change follows the same rule. When a new filter request starts, the previous `filteredCount` is cleared until the newest request publishes the count for the new filtered universe.

An older request may still complete its AG Grid datasource callback; the stale guard applies to renderable count metadata.

## Server-wide eligibility limitation

`totalCount` and `filteredCount` describe dataset/query membership, not exact selection eligibility.

Therefore this can occur:

```text
totalCount = 750
25 rows are selectionDisabled/readOnly
Select All Records UI = 750 selected
backend business action/export resolves 725 eligible rows
```

The frontend does not subtract only disabled rows currently loaded in the browser. Unloaded pages may contain additional restricted rows, so doing that would create false precision.

The backend remains authoritative for selected business operations and selected export and excludes ineligible rows when resolving the logical target.

## Implementation map

```text
backend/apps/transactions/services.py
→ produces totalCount / filteredCount

frontend/src/shared/grid/data/infinite/*
frontend/src/shared/grid/data/server-side/*
→ publish newest server count metadata and reject stale metadata

frontend/src/shared/grid/selection/selectionCount.ts
→ include/exclude count math

frontend/src/shared/grid/selection/client-side/useClientSideSelectionController.ts
→ exact native Client selected count

frontend/src/shared/grid/selection/infinite/useInfiniteSelectionController.tsx
→ Infinite selection representation + server count inputs

frontend/src/shared/grid/selection/server-side/useSsrmSelectionController.ts
→ SSRM selection representation

frontend/src/features/transactions/grid/TransactionsSsrmGrid.tsx
→ SSRM server count inputs

frontend/src/features/transactions/grid/TransactionSelectionActions.tsx
→ renders the selected total
```

## Verification expectations

Verification should cover:

- Client exact native selected count for page, filtered and all scopes;
- restricted Client rows excluded from native selected count;
- Infinite/SSRM explicit and Current Page counts from exact IDs;
- Infinite/SSRM All Filtered count from `filteredCount - exceptions`;
- Infinite/SSRM All Records count from `totalCount - exceptions`;
- forward and backward out-of-order requests preserving latest-started count ownership;
- filter changes clearing stale `filteredCount` until the newest request publishes;
- server-wide displayed counts not pretending to be exact backend eligibility counts.
