# Grid Capability Catalog

## Supported row models

The foundation implements three AG Grid row models as separate concrete integrations.

### Client-Side Row Model

- complete bounded Transaction collection loaded through TanStack Query;
- editable row copies supplied through native `rowData`;
- native local sorting, filtering and pagination;
- native `currentPage`, `filtered` and `all` Select All scopes;
- exact native selected IDs/count;
- local/native Selected CSV export;
- tracked editing and conflict reconciliation;
- native Grid State preference persistence.

### Infinite Row Model

- backend block loading through AG Grid Infinite datasource lifecycle;
- server-side sorting and filtering through the Transaction request mapper;
- stable backend row IDs;
- pagination with bounded block cache;
- native concrete-row/manual selection;
- exact Current Page selection over resolved page RowNodes;
- compact application-owned All Filtered / All Records logical selection across unloaded rows;
- tracked editing that survives block eviction/reload;
- native Infinite cache refresh after writes.

### Server-Side Row Model (SSRM)

- flat Enterprise SSRM datasource/store loading;
- server-side sorting and filtering through the Transaction request mapper;
- stable backend row IDs;
- native SSRM explicit selection;
- native SSRM All Records selection state;
- exact Current Page selection over resolved page RowNodes;
- application-owned All Filtered state for the current semantic gap;
- tracked editing that survives store refresh/recreation;
- native SSRM retry and refresh.

The current SSRM contract is flat; grouping, tree-data, aggregation and pivot semantics are not implemented.

## Data loading and ownership

### Client-Side

```text
GET complete Transaction collection
→ TanStack Query authoritative cache
→ fresh editable row copies
→ AG Grid rowData
→ local sort/filter/pagination/selection
```

AG Grid does not edit the authoritative Query-cache object references directly. Editable copies preserve an untouched REMOTE value for conflict reconciliation.

### Infinite and SSRM

```text
AG Grid row-model request
→ row-model-specific datasource adapter
→ Transaction request mapper
→ typed API request
→ backend query
→ rows + totalCount + filteredCount
→ AG Grid cache/store
```

Raw AG Grid request objects do not cross the HTTP boundary. The feature mapper allow-lists supported fields/operators.

## Sorting and filtering

### Client-Side

AG Grid executes sorting/filtering locally over the complete in-memory working set. Sort/filter changes do not trigger server row-query requests.

### Infinite and SSRM

AG Grid sort/filter state is translated to the backend query contract and executed against the server dataset.

Server filter UI is limited to semantics the backend supports. The same Transaction filter translation is used for normal row loading and filtered-wide selected operations.

## Pagination and page boundaries

All three row models use native AG Grid pagination.

Current Page means the exact current pagination page, not an Infinite cache block, SSRM store block, or all loaded RowNodes.

Server-backed Current Page operations require the expected page RowNodes to be fully materialised; partial page actions/exports are refused.

## Stable row identity

Stable backend row IDs are used for durable identity across:

- selection;
- tracked editing;
- sorting/filtering/pagination;
- Client rowData replacement;
- Infinite cache recreation;
- SSRM store refresh;
- conflict reconciliation;
- backend operations.

Displayed row index is not durable business identity.

## Selection

Supported user selection meanings are:

```text
Manual / explicit rows
Current Page
All Filtered
All Records
```

### Client-Side

Native AG Grid represents all supported scopes:

```text
page
→ rowSelection.selectAll = 'currentPage'

filtered
→ rowSelection.selectAll = 'filtered'

all
→ rowSelection.selectAll = 'all'
```

Every selected Client row is concrete and locally enumerable.

### Infinite

```text
Manual / Current Page
→ native concrete selected IDs

All Filtered / All Records
→ compact include/exclude application state
```

Dataset-wide logical state is required because unloaded Infinite rows have no RowNodes.

### SSRM

```text
Manual
→ native SSRM selection state

All Records
→ native SSRM server-side Select All state

Current Page
→ explicit resolved page RowNodes

All Filtered
→ application-owned filtered-wide state
```

### Filter lifecycle

```text
All Filtered
→ defining filter changes
→ clear/reset filtered-wide selection

All Records
→ visible filter changes
→ preserve

explicit IDs
→ visible filter changes
→ preserve
```

## Backend logical selection target

Server-backed selected operations use:

```ts
{
  mode: 'include' | 'exclude',
  ids: string[],
}
```

Meaning:

```text
include + ids
→ requested backend-eligible rows

exclude + filters
→ matching backend-eligible rows minus explicit user exceptions

exclude without filters
→ all backend-eligible rows minus explicit user exceptions
```

Restricted rows are not manufactured as exclude IDs. Exclude IDs represent user exceptions.

Client selected operations use exact `include + ids` targets.

## Selected-row totals

### Client-Side

```text
selected count
= api.getSelectedRows().length
```

The count is exact because the complete working set is local and native selectability is evaluated for all rows.

### Infinite and SSRM

```text
explicit/manual/current-page
→ exact included ID count

All Filtered
→ filteredCount - user exceptions

All Records
→ totalCount - user exceptions
```

`totalCount` / `filteredCount` describe query membership rather than exact backend operation eligibility. Server-wide displayed counts can therefore be higher than the number of rows an authoritative selected operation ultimately affects.

The latest-started server request owns renderable `totalCount` / `filteredCount` metadata so late older responses cannot overwrite newer count state.

## Row interaction

Rows expose generic interaction modes:

```text
enabled
selectionDisabled
readOnly
```

Meaning:

```text
enabled
→ selectable + editable

selectionDisabled
→ not selectable
→ excluded from selection-based actions
→ individually editable

readOnly
→ not selectable
→ excluded from selection-based actions
→ not editable
```

The feature/backend decides why a row has a mode. Shared grid code applies the generic behavior.

Loaded-row behavior uses native `isRowSelectable` and `editable` callbacks where possible. Backend services independently enforce authoritative policy.

## Tracked editing

Unsaved editing state is stored outside transient RowNodes by stable backend row ID.

Current editing supports:

- direct committed cell edits;
- current-page programmatic edit application;
- dirty-row count;
- Row Save;
- Save Selected Dirty;
- Discard;
- Discard Selected;
- safe acknowledgement of exactly submitted values;
- restoration of LOCAL drafts after authoritative row replacement/recreation.

Save Selected Dirty operates on:

```text
dirty rows ∩ current logical selection
```

Selected clean rows do not become edits, and unloaded clean rows are never manufactured into update payloads.

## BASE / LOCAL / REMOTE conflict reconciliation

For each dirty field:

```text
BASE
→ authoritative value when field became dirty

LOCAL
→ current unsaved value

REMOTE
→ latest genuinely fresh authoritative value
```

Reconciliation:

```text
REMOTE == BASE
→ keep LOCAL dirty

REMOTE == LOCAL
→ clean automatically

REMOTE differs from BASE and LOCAL
→ keep LOCAL visible
→ remember REMOTE
→ mark conflict
```

Resolution:

```text
Use server
→ REMOTE wins
→ field draft clears

Keep my edit
→ LOCAL remains dirty
→ REMOTE becomes new BASE
→ conflict clears
```

Relevant Save/business mutations are guarded while an unresolved conflict affects their target.

## Selected Change Status action

Transactions implements one selected **Change Status** mutation family:

```text
Mark Completed
Mark Pending
Mark Failed
```

Flow:

```text
current selection target
→ PATCH /api/transactions/selection/
→ backend succeeds
→ concrete row-model root calls its existing clearSelection()
→ concrete root refreshes authoritative data
```

If the request fails, the success callback does not run and selection remains available.

The request does not carry a selection-lifecycle configuration value.

## Import

Transaction Import is a feature workflow separate from tracked cell editing.

Current contract:

```text
CSV file
→ update existing Transactions only
→ stable Transaction `id` target
→ one or more editable field columns
→ Preview validates without mutation
→ Apply revalidates the file
→ complete valid file applies atomically
→ concrete grid root refreshes authoritative data
```

Supported imported editable fields are:

- `account`;
- `amount`;
- `currency`;
- `status`;
- `transactionDate`.

The backend owns CSV parsing, target checks, persisted-field validation and mutation. It reuses `TransactionChangesSerializer`, so imported persisted values and ordinary persisted edits share authoritative field rules.

Row interaction follows explicit-edit semantics:

```text
enabled
→ import editable

selectionDisabled
→ import editable

readOnly
→ import rejected
```

Import does not create LOCAL tracked drafts and does not deliberately clear selection.

Post-Apply refresh stays row-model-specific:

```text
Client
→ refetch complete TanStack Query collection

Infinite
→ refreshInfiniteCache()

SSRM
→ refreshServerSide()
```

Any existing LOCAL drafts then reconcile against imported REMOTE values through the normal BASE/LOCAL/REMOTE state machine. A divergent imported value can therefore become an ordinary edit conflict rather than silently overwriting LOCAL work.

Current deliberate non-goals include create/upsert, XLSX, configurable field mapping, partial success, downloadable error files, asynchronous job progress/cancellation and backend optimistic-concurrency/versioning.

See `grid-import.md` for the complete current contract and `GRIDCAP-IMPORT` for the searchable frontend footprint.

## Export

### Current Page

All three row models use native AG Grid CSV serialization over the exact resolved current pagination page.

Displayed restricted rows are included because Current Page export is a page snapshot.

### Selected — Client-Side

Client uses native/local selected CSV across pagination pages:

```ts
api.exportDataAsCsv({
  onlySelected: true,
  onlySelectedAllPages: true,
});
```

### Selected — Infinite and SSRM

Selected export is backend-owned because the logical selected universe can include unloaded rows.

The backend uses the same logical selection resolver semantics as selected business actions and applies authoritative eligibility before writing CSV.

## Grid State

Native AG Grid Grid State persists current view preferences:

- column order;
- pinning;
- sizing;
- visibility;
- filters;
- sort.

Client, Infinite and SSRM use separate persistence keys.

Pagination position and business row selection remain transient.

## Refresh, retry and teardown

Refresh remains row-model-specific:

```text
Client
→ TanStack Query cache update/refetch + rowData replacement

Infinite
→ refreshInfiniteCache()

SSRM
→ refreshServerSide()
```

SSRM datasource failure retry uses `retryServerSideLoads()`.

Infinite/SSRM datasource destruction cancels obsolete in-flight requests.

Concrete roots clear their authoritative GridApi refs during pre-destroy lifecycle, and custom asynchronous/listener code guards against using a destroyed API.

## Columns and presentation

Feature-owned native `ColDef` composition supports:

- sorting;
- filtering;
- editors;
- renderers;
- formatting;
- tooltips;
- cell class rules;
- feature utility/action columns.

Server-backed columns can use narrower filter parameters when required by the backend contract. Client columns use native local filtering without inheriting transport restrictions.

## Theming and AG Grid setup

The application provides:

- shared design tokens;
- AG Grid theme integration;
- centralized AG Grid module registration;
- centralized Enterprise license setup;
- small global default column behavior.

Feature roots still render `AgGridReact` directly; the foundation does not hide native lifecycle behind a universal grid wrapper.

## Current limitations

- SSRM selection is flat; grouped/tree selection semantics are not implemented.
- server-wide selected totals are query-membership counts rather than exact eligibility-aware counts;
- BASE/LOCAL/REMOTE reconciliation detects divergence only after fresh authoritative data reaches the browser; it is not backend stale-write/version enforcement;
- Import is currently update-only CSV with atomic apply; create/upsert, XLSX, configurable mapping, partial success and asynchronous job orchestration are not implemented.
