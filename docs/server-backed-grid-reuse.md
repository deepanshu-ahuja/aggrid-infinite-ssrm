# Reusing the server-backed grid foundation

This is the practical guide for adding another server-backed table such as Payables, Invoices or Orders.

The goal is simple:

- reuse grid behavior that is genuinely common;
- keep business/domain behavior inside the feature;
- keep native AG Grid concepts visible instead of hiding them behind a large wrapper.

If you are adding a new table, start here before copying code from Transactions.

## 1. The boundary to remember

Ask this question for every new piece of code:

```text
Would another server-backed table need this for the same reason?
```

If yes, it probably belongs under `frontend/src/shared/grid`.

If it depends on domain fields, business actions, endpoint shapes or business validation, it belongs in the feature.

### Shared grid responsibilities

Examples of reusable concerns:

- server-backed pagination/cache defaults;
- Infinite and SSRM datasource adapters;
- native GridApi lifecycle helpers;
- include/exclude selection semantics;
- current-page / filtered / all selection behavior;
- generic selection-action target construction;
- Grid State persistence;
- generic tracked-edit mechanics when the behavior is truly domain-neutral.

### Feature responsibilities

Examples that should remain feature-owned:

- row type (`Transaction`, `Payable`, etc.);
- columns and editable fields;
- AG Grid field -> backend field translation;
- backend query endpoint;
- domain action endpoint;
- action payload such as `{ status: 'Failed' }` or `{ action: 'approve' }`;
- business validation and backend update implementation.

## 2. Do not create a generic `AgGridReact` wrapper

A feature grid should render `AgGridReact` directly and own one authoritative `GridApi` ref.

That keeps native AG Grid behavior easy to understand and debug.

Shared hooks may receive that root-owned API, but they do not replace it with another application API.

## 3. Choose the row model explicitly

Infinite Row Model and SSRM share some primitives but remain separate implementations.

Use the row-model-specific loading hook:

```text
Infinite -> useInfiniteRowLoading(...)
SSRM     -> useServerSideRowLoading(...)
```

Keep the native datasource prop visible in the concrete root:

```text
Infinite -> datasource
SSRM     -> serverSideDatasource
```

Do not force both row models through one giant hook/component just because they both call the same backend.

## 4. Reuse the server-backed defaults

Start from `serverBackedGridDefaults` and override only measured feature-specific differences.

Current defaults are:

```text
page size            25
cache block size     50
max cached blocks     5
block debounce      120 ms
max concurrent load   1
```

Important: page size and block size are different concepts.

With page size 25 and block size 50:

```text
Block 0 -> rows 0-49   -> pages 1 and 2
Block 1 -> rows 50-99  -> pages 3 and 4
Block 2 -> rows 100-149 -> pages 5 and 6
```

## 5. Understand the Infinite cache before debugging network calls

`maxBlocksInCache: 5` means AG Grid retains only a bounded set of recently needed blocks.

If a user visits blocks sequentially up to block 7, the cache will normally contain roughly:

```text
Block 3
Block 4
Block 5
Block 6
Block 7
```

Blocks 1 and 2 have been evicted.

This is not a permanent "last five block numbers" rule; cache residency depends on what the user recently viewed and what AG Grid currently needs.

If an evicted block is visited again, AG Grid fetches it from the backend again.

### What happens after a successful Infinite mutation

The current Infinite roots use `refreshInfiniteCache()` after backend-authoritative writes.

That refreshes the blocks currently resident in AG Grid's Infinite cache. It does **not** fetch the entire backend dataset.

Example:

```text
Only Block 0 has been loaded
bulk action succeeds
-> Block 0 is queried again

Later user goes to a page that needs Block 1
-> Block 1 is fetched then
-> it already contains the backend mutation result
```

If five blocks are resident, a refresh can produce five row-query requests with different offsets. Those are cache refreshes, not five mutation requests.

This is intentional for correctness: the backend is authoritative, cached browser rows are refreshed, and unloaded/evicted blocks are fetched fresh only when needed.

Do not treat cache residency as the scope of a business action.

## 6. Selection is generic; business actions are not

The reusable logical selection is:

```ts
{
  mode: 'include' | 'exclude',
  ids: string[],
}
```

Meaning:

```text
include + ids
-> exactly these ids are selected

exclude + ids
-> Select All is active and these ids are exceptions
```

### Manual/current-page/cross-page selection

These all end as exact IDs:

```text
include + ids
```

The history of which page or filter was visible when an ID was selected does not matter.

Example:

```text
Filter A -> select A and B
Filter B -> select C and D

final logical selection:
include [A, B, C, D]
```

A backend action should target those exact IDs and must not constrain them by the currently visible filter.

### Select All Filtered

The selection is represented as:

```text
exclude + exception ids
```

and the feature also supplies its translated backend filters when building an action request.

### Select All Records

The selection is also:

```text
exclude + exception ids
```

but there is no backend filter context.

The shared helper `buildGridSelectionActionTarget(...)` owns the reusable selection meaning. A feature adds its own translated filters and business payload around it.

## 7. Reuse one filter translation path

A feature should have one translation boundary from AG Grid filter models to its backend filter contract.

Transactions uses:

```text
mapTransactionFilterModel(...)
```

The same translator is used for:

```text
normal row loading
and
Select All Filtered actions
```

Do not write a second action-only filter translator. Otherwise the rows shown by the table and the rows targeted by the action can silently disagree.

A Payables feature should have its own field mapping, for example:

```text
mapPayableFilterModel(...)
```

because field names and domain rules are feature-specific.

## 8. Building a feature action

The shared layer should answer:

```text
Which logical rows are targeted?
```

The feature should answer:

```text
What business operation should happen to them?
```

Conceptually:

```ts
const target = buildGridSelectionActionTarget(
  selection,
  excludeScope,
  translatedFilters,
);

return {
  ...target,
  action: { type: 'approve' },
};
```

Transactions may instead add:

```ts
changes: { status: 'Failed' }
```

The shared helper must not know what `approve`, `Failed`, `assignedTo`, etc. mean.

## 9. Filter-change selection rules

Do not apply one blanket "filter changed -> clear selection" rule.

Use the selection meaning:

```text
explicit/include ids
-> survive filter changes

Select All Filtered / filtered exclude
-> reset when its defining filter changes

Select All Records / all exclude
-> survive visible filter changes
```

This lets a user intentionally accumulate exact selected IDs across different filters.

## 10. Stable row IDs are mandatory

Every server-backed feature should provide a stable backend identity through `getRowId`.

Do not use row position as identity.

Stable IDs are what allow selection, tracked edits and backend-authoritative reloads to survive pagination, sorting, cache eviction and RowNode recreation.

## 11. Grid State persistence

Use the shared `useGridStatePersistence(...)` boundary for common user table preferences.

Keep separate keys for distinct table/row-model instances.

Do not mirror native column/filter/sort state into a second React state model.

## 12. Quick checklist for a new table

For a new feature such as Payables:

1. Define the feature row/API contracts.
2. Define columns and a stable `getRowId`.
3. Reuse `serverBackedGridDefaults`.
4. Create one feature query/filter mapper.
5. Reuse the Infinite or SSRM datasource/loading helper.
6. Reuse the appropriate selection controller.
7. Reuse `buildGridSelectionActionTarget(...)` for selection-based actions.
8. Add only the Payables-specific action payload/API call in the feature.
9. Reuse Grid State persistence if the table needs saved preferences.
10. Add tests for feature translation/business behavior; do not re-test AG Grid internals.

## 13. Things not to generalize prematurely

Do not create shared code only because two files look similar.

Keep something feature-owned when its meaning is domain-specific.

Prefer small duplication over a generic abstraction that requires flags such as:

```text
isPayable
isTransaction
useSpecialStatus
rowModelMode
```

A reusable helper should have one clear capability and a domain-neutral reason to exist.

## Related documentation

- `docs/ag-grid.md` - detailed architecture and ownership rules.
- `docs/ag-grid-foundation-status.md` - foundation status/guardrails.
- `frontend/src/infinite-selection-contract.md` - detailed Infinite selection scenarios.
- `frontend/src/ssrm-selection-contract.md` - detailed SSRM selection scenarios.
- `docs/transaction-editing.md` - current Transactions editing behavior.
