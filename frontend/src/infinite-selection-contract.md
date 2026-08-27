# Infinite Row Model Selection Contract

This document is the source of truth for selection when a server-backed table uses AG Grid's **Infinite Row Model**.

The core rule is:

> Keep AG Grid responsible for loaded RowNodes and native checkbox rendering, while application state represents only the logical selection that must survive unloaded rows/cache eviction.

Transactions is the current example feature, but the selection mechanics here are intended to be reusable.

---

## 1. Separate UI strategy from logical selection

The Infinite header strategy can be:

```text
page
filtered
all
```

That answers:

> What should the header checkbox mean?

Logical selection is always only:

```ts
{
  mode: 'include' | 'exclude',
  ids: string[],
}
```

Do not copy `page | filtered | all` into the logical selection object or backend payload.

---

## 2. Include means exact IDs

```text
include [A, B]
```

means exactly A and B are selected.

Use include for:

- one manual row;
- many manual rows;
- Current Page selection;
- IDs accumulated across pages;
- IDs accumulated while different filters were visible.

The filter visible when an ID was selected does not become part of that explicit selection.

Example:

```text
Filter A -> select A, B
Filter B -> select C, D

final logical selection:
include [A, B, C, D]
```

---

## 3. Exclude means dataset Select All plus exceptions

```text
exclude []
```

means everything in the current Select-All dataset is selected.

```text
exclude [A]
```

means everything in that dataset except A.

Which dataset is meant is owned by the Infinite UI strategy:

```text
filtered strategy -> all rows matching the defining filter
all strategy      -> all records
```

That context is intentionally not duplicated into logical selection.

---

## 4. Page strategy

The page header is only a shortcut over concrete IDs on the current page.

Example:

```text
Page 1: select header -> include [A, B, C, D]
Page 2: manually select E
-> include [A, B, C, D, E]
```

Unchecking a page header removes only the current-page IDs and preserves explicit IDs selected elsewhere.

Page is never a backend action scope.

---

## 5. Filtered strategy before Select All

Manual selection under a filtered UI strategy remains exact IDs.

```text
filter = Pending
select A, B
-> include [A, B]
```

If the filter changes, preserve A and B.

Why: the user selected those IDs explicitly; the filter was only how they found them.

---

## 6. Select All Filtered

When Select All Filtered is activated:

```text
exclude []
```

means all rows matching the current defining filter.

If A is unchecked:

```text
exclude [A]
```

means all matching rows except A.

The AG Grid filter model remains AG Grid-owned. When a real action is invoked, the root reads `api.getFilterModel()` and the feature maps it to the backend filter contract.

---

## 7. Filter lifecycle

Do not use one blanket reset rule.

```text
page/include
-> preserve on filter change

filtered/include
-> preserve on filter change

filtered/exclude
-> reset to include [] when defining filter changes

all/include
-> preserve on filter change

all/exclude
-> preserve on filter change
```

Only filtered-wide exclude is tied to one specific filter query.

---

## 8. All Records strategy

Manual selection is still include.

```text
include [A, B]
```

Select All Records switches to:

```text
exclude []
```

Unchecking A becomes:

```text
exclude [A]
```

Visible filter changes do not clear all-record selection because the filter changes what the user sees, not what “all records” means.

---

## 9. Sorting and pagination

Sorting changes position, not identity, so it does not clear selection.

Pagination changes visibility, not logical selection, so it does not clear selection.

Stable backend identity is mandatory:

```ts
getRowId={({ data }) => data.id}
```

---

## 10. Cache eviction and row recreation

Infinite Row Model keeps only a bounded set of blocks/RowNodes in browser memory.

Selection lifetime must not depend on that cache lifetime.

Example:

```text
A selected
-> its block is evicted
-> logical selection still remembers A
-> block later reloads
-> new RowNode for A is synced back to selected
```

Newly loaded rows are always reconciled against logical selection.

Programmatic checkbox sync must be marked/handled as API-originated so it does not feed back into selection state.

---

## 11. Infinite cache configuration and refresh

Current shared defaults are:

```text
pagination page size = 25
cache block size     = 50
max cached blocks    = 5
```

One 50-row block can serve two 25-row pages.

`maxBlocksInCache: 5` means AG Grid retains only a bounded set of recently needed blocks. If old blocks are evicted, visiting them later causes a fresh backend query.

After a successful backend write, the Infinite root currently calls:

```ts
api.refreshInfiniteCache();
```

That re-queries the Infinite blocks currently resident in the browser cache. It does **not** load every backend block affected by a dataset-wide action.

Example:

```text
Only Block 0 is resident
-> action succeeds
-> Block 0 refreshes

Later user visits rows requiring Block 1
-> Block 1 loads then
-> backend already contains the action result
```

Cache residency is a browser performance concern, never the business-action scope.

---

## 12. Backend action wire contract

The backend action payload has no serialized `scope`.

### Explicit/manual/current-page/cross-page

```json
{
  "selection": {
    "mode": "include",
    "ids": ["A", "B", "E"]
  }
}
```

Meaning: exactly A, B and E. Do not attach visible filters.

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

Meaning: all backend rows matching the translated filters except A.

### Select All Records

```json
{
  "selection": {
    "mode": "exclude",
    "ids": ["A"]
  }
}
```

Meaning: all records except A.

The frontend still uses internal `filtered | all` context while building an exclude request; that context only decides whether translated filters are attached.

---

## 13. Filter translation must be reused

Normal row loading and Select All Filtered actions must use the same feature filter mapper.

For Transactions:

```text
AG Grid FilterModel
-> mapTransactionFilterModel(...)
-> TransactionFilter[]
```

Do not create a second action-only translator.

---

## 14. Actions happen only on explicit user commands

Selection changes themselves do not call the backend action endpoint.

```text
select row       -> no action call
change page      -> no action call
Select All       -> no action call
uncheck exception -> no action call
```

A mutation happens only when the user invokes a real feature action such as Mark Failed/Completed/Pending.

---

## 15. Lifecycle matrix

| Event | Page/include | Filtered/include | Filtered/exclude | All/include | All/exclude |
| --- | --- | --- | --- | --- | --- |
| Row checkbox | update exact ID | update exact ID | update exception | update exact ID | update exception |
| Page header | add/remove page IDs | n/a | n/a | n/a | n/a |
| Select All Filtered | n/a | switch to exclude [] | remain exclude | n/a | n/a |
| Select All Records | n/a | n/a | n/a | switch to exclude [] | remain exclude |
| Pagination | preserve | preserve | preserve | preserve | preserve |
| Sort | preserve | preserve | preserve | preserve | preserve |
| Filter change | preserve | preserve | **reset** | preserve | preserve |
| Cache eviction | preserve | preserve | preserve | preserve | preserve |
| Block reload | sync | sync | sync | sync | sync |
| Deliberate clear | clear | clear | clear | clear | clear |

---

## 16. Rules for future developers and coding assistants

1. Separate Infinite UI strategy (`page | filtered | all`) from logical selection (`include | exclude`).
2. Never serialize UI strategy as backend `scope`.
3. Manual/current-page selection is always exact include IDs.
4. Preserve explicit IDs across pagination, sorting and filter changes.
5. Dataset Select All uses exclude + exception IDs.
6. Reset only filtered-wide exclude when its defining filter changes.
7. Preserve all-record exclude across visible filter changes.
8. Keep selection independent from RowNode/cache lifetime.
9. Use stable backend row IDs.
10. Reuse the same feature filter mapper for row loading and filtered actions.
11. Use Infinite-native cache APIs; do not copy SSRM refresh/retry behavior.
12. Explain cache/selection lifecycle in comments when behavior is non-obvious.
