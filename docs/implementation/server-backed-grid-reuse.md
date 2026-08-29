# Reusing the server-backed grid foundation

Use this guide when adding another server-backed table such as Payables, Invoices or Orders.

The goal is:

- reuse grid behavior that is genuinely common;
- keep business/domain behavior inside the feature;
- keep native AG Grid concepts visible instead of hiding them behind a large wrapper.

## 1. Shared versus feature-owned code

For every new piece of code ask:

```text
Would another server-backed table need this for the same reason?
```

If yes, it may belong under `frontend/src/shared/grid`.

If it depends on domain fields, business actions, endpoint shapes or business validation, it belongs in the feature/backend.

### Shared grid responsibilities

Examples:

- server-backed pagination/cache defaults;
- Infinite and SSRM datasource adapters;
- GridApi lifecycle safety;
- current-page resolution;
- include/exclude selection semantics;
- generic selected-target construction;
- generic `enabled | selectionDisabled | readOnly` interaction meanings;
- Grid State persistence;
- stable-ID tracked editing and conflict mechanics.

### Feature/backend responsibilities

Examples:

- feature row type;
- columns and editable fields;
- business conditions that determine row interaction mode;
- AG Grid field → backend field translation;
- backend query endpoint;
- business-action endpoint and payload;
- validation/business rules;
- authoritative row eligibility and write policy.

## 2. Keep the concrete AG Grid root visible

A feature grid renders `AgGridReact` directly and owns one authoritative `GridApi` ref.

Shared hooks may receive that root-owned API for operations they genuinely own, but they do not replace it with a second application-specific grid API.

## 3. Choose the row model explicitly

Infinite and SSRM remain separate integrations.

```text
Infinite
→ useInfiniteRowLoading(...)
→ datasource

SSRM
→ useServerSideRowLoading(...)
→ serverSideDatasource
```

Choose the row model from application requirements and use its native lifecycle. Do not introduce a generic row-model switch merely to make the files look symmetrical.

## 4. Start from server-backed defaults

Current defaults are:

```text
page size             25
cache block size      50
max cached blocks      5
block debounce       120 ms
max concurrent load    1
```

Page size and block size are different concepts.

With page size 25 and block size 50:

```text
Block 0 → rows 0-49    → pages 1 and 2
Block 1 → rows 50-99   → pages 3 and 4
Block 2 → rows 100-149 → pages 5 and 6
```

Override defaults only for a measured feature requirement.

## 5. Infinite cache ownership

`maxBlocksInCache: 5` keeps only a bounded set of recently needed blocks.

If an evicted block is visited again, AG Grid requests it again.

After a successful Infinite write:

```text
api.refreshInfiniteCache()
→ refresh currently resident blocks
```

It does not fetch every backend block affected by a dataset-wide business action.

Example:

```text
Only Block 0 is resident
→ business action succeeds
→ Block 0 refreshes

Later user visits rows requiring Block 1
→ Block 1 loads then
→ backend already contains the authoritative result
```

Cache residency is a presentation/performance concern, never the scope of a business action.

## 6. Stable row IDs

Every server-backed feature provides stable backend identity through `getRowId`.

Do not use displayed row position as durable identity.

Stable IDs allow selection, tracked edits and authoritative reload/reconciliation to survive:

- pagination;
- sorting;
- filtering;
- cache/store recreation;
- RowNode replacement.

## 7. Selection contract

The operation-neutral logical selection shape is:

```ts
{
  mode: 'include' | 'exclude',
  ids: string[],
}
```

### Explicit/manual/current-page selection

```text
include + ids
→ exact requested eligible IDs
```

The filter/page history used to discover those IDs is not part of the backend target.

### Select All Filtered

```text
exclude + user exception IDs
+ translated filters
```

Backend meaning:

```text
all eligible rows matching the filters
minus explicit user exceptions
```

### Select All Records

```text
exclude + user exception IDs
without filters
```

Backend meaning:

```text
all eligible rows
minus explicit user exceptions
```

### Row eligibility

Rows outside the selectable universe are not user exceptions.

```text
enabled
→ selectable + editable

selectionDisabled
→ not selectable + individually editable

readOnly
→ not selectable + not editable
```

Loaded-row behavior uses native `isRowSelectable` / `editable` callbacks. Backend services independently enforce the equivalent authoritative policy for unloaded/stale requests.

Do not enumerate backend-restricted rows into logical `exclude` IDs.

## 8. Reuse one filter translation path

A feature owns one translation boundary from AG Grid filter models to its backend filter contract.

Example:

```text
AG Grid FilterModel
→ mapPayableFilterModel(...)
→ PayableFilter[]
```

Use the same translation for:

```text
normal server row loading
and
Select All Filtered selected operations
```

Do not create an action-only filter interpreter that can diverge from the rows shown by the grid.

## 9. Keep selection separate from business action

Selection answers:

```text
Which rows?
```

The feature action answers:

```text
What should happen to them?
```

Conceptually:

```ts
const target = buildGridSelectionActionTarget(
  selection,
  excludeScope,
  translatedFilters,
);

const request = {
  ...target,
  changes: featureSpecificChanges,
};
```

`excludeScope` is frontend construction context used to decide whether filters belong in the request. It is not serialized inside the logical selection object.

A different business action owns its own endpoint/mutation/payload. Shared selection code does not choose unrelated business endpoints.

## 10. Selection lifecycle

Use selection meaning rather than one blanket reset rule:

```text
explicit/include IDs
→ preserve across filter changes

All Filtered/exclude
→ reset when its defining filter changes

All Records/exclude
→ preserve across visible filter changes
```

Sorting and pagination change presentation, not stable identity, so they do not clear logical selection.

## 11. Tracked editing

Unsaved drafts live outside transient RowNodes by stable row ID.

The shared state tracks:

```text
BASE
LOCAL
REMOTE
```

For a dirty field:

```text
REMOTE == BASE
→ keep LOCAL dirty

REMOTE == LOCAL
→ clean automatically

REMOTE differs from BASE and LOCAL
→ keep LOCAL visible
→ record conflict
```

Selected Save persists only:

```text
dirty rows ∩ current logical selection
```

It never turns Select All into changes for clean/unloaded rows.

## 12. Grid State

Use native AG Grid Grid State for supported durable view preferences.

Current persisted slices are:

- column order;
- pinning;
- sizing;
- visibility;
- filters;
- sort.

Use distinct persistence keys for independent grids. Pagination position and business selection remain transient.

## 13. Refresh and teardown

Use the actual row model's lifecycle:

```text
Infinite
→ refreshInfiniteCache()

SSRM
→ refreshServerSide()
→ retryServerSideLoads() for failed loads
```

Datasource destroy/replacement cancels obsolete in-flight requests.

Concrete roots clear their authoritative GridApi refs during pre-destroy lifecycle.

## 14. New server-backed table checklist

For a new feature:

1. Define row/API contracts.
2. Define columns and stable `getRowId`.
3. Choose Infinite or SSRM explicitly.
4. Start from server-backed defaults.
5. Create one feature sort/filter/query mapper.
6. Reuse the chosen row-model datasource/loading boundary.
7. Reuse the chosen row-model selection controller where its semantics match.
8. Map feature row policy into `enabled | selectionDisabled | readOnly` and native callbacks.
9. Enforce equivalent eligibility/write policy in the backend.
10. Reuse the logical selection-target helper for selected operations.
11. Keep feature business-action endpoints/payloads feature-owned.
12. Reuse stable-ID tracked editing/conflict mechanics when needed.
13. Reuse Grid State persistence when the table needs durable view preferences.
14. Add focused tests for feature mapping, row policy, API behavior and row-model integration.

## 15. Do not generalize prematurely

Do not create shared code only because two files look similar.

Keep behavior feature-owned when its meaning is domain-specific.

Prefer small duplication over abstractions that need flags such as:

```text
isPayable
isTransaction
useSpecialStatus
rowModelMode
```

A shared abstraction should own one stable, domain-neutral responsibility.
