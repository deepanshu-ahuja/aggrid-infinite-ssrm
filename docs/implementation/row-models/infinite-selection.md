# Infinite Row Model Selection Contract

> Keep AG Grid responsible for loaded RowNodes and native checkbox rendering, while application state represents only the logical selection that must survive unloaded rows/cache eviction.

## 1. Separate UI strategy from logical selection

The Infinite header strategy can be:

```text
page
filtered
all
```

That controls what the header checkbox means.

Logical selection is always:

```ts
{
  mode: 'include' | 'exclude',
  ids: string[],
}
```

Do not copy `page | filtered | all` into the logical selection object or backend payload.

## 2. Include means exact IDs

```text
include [A, B]
```

means exactly eligible A and B are selected.

Use include for:

- one manual row;
- many manual rows;
- Current Page selection;
- IDs accumulated across pages;
- IDs accumulated while different filters were visible.

The filter visible when an ID was selected does not become part of that explicit selection.

Example:

```text
Filter A → select A, B
Filter B → select C, D

final logical selection:
include [A, B, C, D]
```

## 3. Exclude means dataset Select All plus user exceptions

```text
exclude []
```

means every **selection-eligible** row in the current Select-All dataset is selected.

```text
exclude [A]
```

means every eligible row in that dataset except user-deselected A.

Which dataset is meant is owned by the Infinite UI strategy:

```text
filtered strategy → eligible rows matching the defining filter
all strategy      → all eligible records
```

That context is intentionally not duplicated into logical selection.

### Disabled rows are outside include/exclude bookkeeping

A backend-disabled/read-only row is not an implicit exception.

If loaded page rows are:

```text
A enabled
B disabled
C enabled
```

Select All Records still has the compact logical state:

```text
exclude []
```

Do **not** change it to:

```text
exclude [B]
```

`exclude` IDs represent user deselection exceptions. Disabled rows were never eligible for selection.

For loaded rows, native AG Grid `isRowSelectable` prevents checkbox/API selection and the Infinite page/dataset helpers avoid passing disabled RowNodes into selection calls. For unloaded rows, backend eligibility removes disabled rows when the business action is resolved.

## 4. Page strategy

The page header is a shortcut over eligible concrete IDs on the current page.

Example:

```text
Page 1: select header → include [A, B, C, D]
Page 2: manually select E
→ include [A, B, C, D, E]
```

Disabled page rows are ignored rather than added to an exception list.

Unchecking a page header removes only the selectable current-page IDs and preserves explicit IDs selected elsewhere.

Page is never a backend action scope.

## 5. Filtered strategy before Select All

Manual selection under a filtered UI strategy remains exact IDs.

```text
filter = Pending
select A, B
→ include [A, B]
```

If the filter changes, preserve A and B because those IDs were explicitly selected.

## 6. Select All Filtered

When Select All Filtered is activated:

```text
exclude []
```

means all **eligible** rows matching the current defining filter.

If eligible A is unchecked:

```text
exclude [A]
```

means all eligible matching rows except A.

Disabled rows matching that filter remain outside selection and are not added to `ids`.

The AG Grid filter model remains AG Grid-owned. When a business action is invoked, the root reads `api.getFilterModel()` and the feature maps it to the backend filter contract. The backend applies that filter and authoritative row eligibility for rows the browser never loaded.

## 7. Filter lifecycle

```text
page/include
→ preserve on filter change

filtered/include
→ preserve on filter change

filtered/exclude
→ reset to include [] when defining filter changes

all/include
→ preserve on filter change

all/exclude
→ preserve on filter change
```

Only filtered-wide exclude is tied to one specific filter query.

## 8. All Records strategy

Manual selection remains include.

```text
include [A, B]
```

Select All Records switches to:

```text
exclude []
```

Unchecking eligible A becomes:

```text
exclude [A]
```

Disabled records remain outside the selectable universe and do not appear in the exception list.

Visible filter changes do not clear all-record selection because the filter changes what the user sees, not what “all eligible records” means.

## 9. Sorting and pagination

Sorting changes position, not identity, so it does not clear selection.

Pagination changes visibility, not logical selection, so it does not clear selection.

Stable backend identity is mandatory:

```ts
getRowId={({ data }) => data.id}
```

## 10. Cache eviction and row recreation

Infinite Row Model keeps only a bounded set of blocks/RowNodes in browser memory.

Selection lifetime must not depend on that cache lifetime.

Example:

```text
A selected
→ its block is evicted
→ logical selection still remembers A
→ block later reloads and is still eligible
→ new RowNode for A is synced back to selected
```

Newly loaded eligible rows are reconciled against logical selection. Newly loaded disabled rows are not passed into programmatic selection calls.

Programmatic checkbox sync is handled as API-originated so it does not feed back into logical selection state.

## 11. Infinite cache configuration and refresh

Current shared defaults are:

```text
pagination page size = 25
cache block size     = 50
max cached blocks    = 5
```

One 50-row block can serve two 25-row pages.

`maxBlocksInCache: 5` means AG Grid retains only a bounded set of recently needed blocks. If old blocks are evicted, visiting them later causes a fresh backend query.

After a successful backend write, the Infinite root calls:

```ts
api.refreshInfiniteCache();
```

That re-queries Infinite blocks currently resident in the browser cache. It does **not** load every backend block affected by a dataset-wide action.

Example:

```text
Only Block 0 is resident
→ action succeeds
→ Block 0 refreshes

Later user visits rows requiring Block 1
→ Block 1 loads then
→ backend already contains the action result and current row interaction mode
```

Cache residency is a browser performance concern, never the business-action scope.

## 12. Backend action wire contract

The backend action payload has no serialized `scope` and no disabled-row ID list.

### Explicit/manual/current-page/cross-page

```json
{
  "selection": {
    "mode": "include",
    "ids": ["A", "B", "E"]
  }
}
```

Meaning: eligible rows among exact A, B and E. Visible filters are not attached. Loaded UI selection should already prevent disabled IDs, while backend eligibility still protects stale/crafted requests.

### Select All Filtered

```json
{
  "selection": {
    "mode": "exclude",
    "ids": ["A"]
  },
  "filters": [
    {
      "field": "status",
      "operator": "equals",
      "value": "Completed"
    }
  ]
}
```

Meaning: eligible backend rows matching the translated filters except user-deselected A.

### Select All Records

```json
{
  "selection": {
    "mode": "exclude",
    "ids": ["A"]
  }
}
```

Meaning: all eligible records except user-deselected A.

The frontend uses internal `filtered | all` context while building an exclude request only to decide whether translated filters are attached.

## 13. Filter translation

Normal row loading and Select All Filtered actions use the same feature filter mapper.

For Transactions:

```text
AG Grid FilterModel
→ mapTransactionFilterModel(...)
→ TransactionFilter[]
```

There is no second action-only filter interpretation.

## 14. Business action boundary

Selection changes do not call the backend action endpoint.

```text
select row        → no action call
change page       → no action call
Select All        → no action call
uncheck exception → no action call
```

A mutation occurs only when the user invokes a Transaction business action such as Mark Failed, Mark Completed, or Mark Pending.

## 15. Lifecycle matrix

| Event | Page/include | Filtered/include | Filtered/exclude | All/include | All/exclude |
| --- | --- | --- | --- | --- | --- |
| Eligible row checkbox | update exact ID | update exact ID | update exception | update exact ID | update exception |
| Disabled row checkbox | no selection | no selection | no exception | no selection | no exception |
| Page header | add/remove selectable page IDs | n/a | n/a | n/a | n/a |
| Select All Filtered | n/a | switch to exclude [] | remain exclude | n/a | n/a |
| Select All Records | n/a | n/a | n/a | switch to exclude [] | remain exclude |
| Pagination | preserve | preserve | preserve | preserve | preserve |
| Sort | preserve | preserve | preserve | preserve | preserve |
| Filter change | preserve | preserve | **reset** | preserve | preserve |
| Cache eviction | preserve | preserve | preserve | preserve | preserve |
| Eligible block reload | sync | sync | sync | sync | sync |
| Disabled block reload | untouched | untouched | untouched | untouched | untouched |
| Deliberate clear | clear | clear | clear | clear | clear |

## 16. Selection invariants

1. Keep Infinite UI strategy (`page | filtered | all`) separate from logical selection (`include | exclude`).
2. Never serialize UI strategy as backend `scope`.
3. Manual/current-page selection is exact include IDs.
4. Preserve explicit IDs across pagination, sorting and filter changes.
5. Dataset Select All uses exclude plus **user** exception IDs.
6. Disabled rows are outside selection; never manufacture them as include/exclude bookkeeping.
7. Use native AG Grid row selectability for loaded rows and backend eligibility for unloaded rows.
8. Reset only filtered-wide exclude when its defining filter changes.
9. Preserve all-record exclude across visible filter changes.
10. Keep selection independent from RowNode/cache lifetime.
11. Use stable backend row IDs.
12. Reuse the same feature filter mapper for row loading and filtered actions.
13. Use Infinite-native cache lifecycle APIs for refresh/reload behavior.
