# Grid Capability Catalog

This document answers one question:

> What can the current grid foundation do today across Client-Side, Infinite and SSRM?

It describes **logical capabilities**, not one particular screen layout or button arrangement. A feature can reuse these capabilities with a different UI as long as it respects the same contracts and the actual row model's native ownership.

Detailed feature/edge-case documents remain the source of truth for implementation details. This file is the high-level catalog that a developer should read first when deciding whether the foundation already supports a requirement.

## Maintenance rule

When a grid capability is added, removed, or materially changes, update this document in the same change.

Do not let this become a roadmap or wish list. A capability belongs here only when the repository currently implements it.

For the searchable implementation/dependency map, see `docs/grid-capability-tags.md`. For the separate list of AG Grid-native APIs, props, events and RowNode features we rely on, see `docs/ag-grid-native-usage.md`.

---

## 1. Supported row models

The foundation currently supports three real AG Grid row models as separate implementations.

### Client-Side Row Model

Use when the complete bounded working set can reasonably live in browser memory and the application wants AG Grid to own data shaping locally.

Current support includes:

- one complete Transaction collection request through TanStack Query;
- editable row copies passed through native `rowData`;
- native Client sorting, filtering and pagination;
- native header Select All scopes `currentPage`, `filtered` and `all`;
- exact selected IDs/count because the complete working set is local;
- shared row eligibility, tracked editing, Save/Discard and BASE/LOCAL/REMOTE conflict mechanics;
- explicit-ID backend selected business actions;
- native Current Page CSV;
- native local Selected CSV across pagination pages;
- native Grid State preference persistence.

The current Transactions Client route defaults its Select All meaning to `all`; this is configuration, not a separate implementation. Page and Filtered remain supported by the same Client controller.

### Infinite Row Model

Use when the application wants a lightweight server-backed flat table with block loading, pagination and a bounded browser cache.

Current support includes:

- backend block loading;
- server-side sorting and filtering;
- stable backend row IDs;
- pagination;
- bounded block caching;
- retry/error handling;
- native loaded/manual row selection;
- application-owned dataset-wide selection semantics where Infinite cannot represent unloaded rows by itself;
- tracked editing that survives RowNode/cache recreation;
- backend-authoritative refresh after writes.

### Server-Side Row Model (SSRM)

Use when Enterprise SSRM capabilities are required.

The current implementation is intentionally flat. It supports:

- backend block loading;
- server-side sorting and filtering;
- stable backend row IDs;
- pagination/cache behavior;
- native SSRM explicit and All Records selection;
- explicit Current Page selection;
- custom All Filtered semantics where the current native SSRM configuration does not express the required product meaning;
- tracked editing that survives RowNode/store refresh;
- SSRM-native retry and refresh.

Grouping, aggregation, tree data and pivot behavior are not part of the current foundation.

---

## 2. Data loading and ownership

### Client-Side

Client fetches the complete bounded collection once through an application/TanStack Query boundary:

```text
GET complete Transaction collection
-> TanStack Query authoritative cache
-> fresh editable row copies
-> AG Grid rowData
-> local sort/filter/pagination/selection
```

The editable row copies deliberately prevent AG Grid in-cell edits from mutating the authoritative Query-cache objects that represent REMOTE values for conflict reconciliation.

Client does not reuse the Infinite/SSRM paged query API with an artificial large limit.

### Infinite + SSRM

Both server-backed row models request blocks from the backend instead of loading the complete dataset into the browser:

```text
AG Grid row-model request
-> row-model-specific datasource adapter
-> feature request mapper
-> typed API request
-> backend query
-> rows + counts
-> AG Grid row model/cache/store
```

The current flat response includes:

- rows for the requested block;
- total dataset count;
- filtered count.

The browser does not send raw AG Grid request objects directly to Django. The feature request mapper translates AG Grid sort/filter models into an allow-listed backend contract.

Detailed flow: `docs/api-data-flow.md`.

---

## 3. Sorting

Sorting uses native AG Grid column sorting in all three row models, but data ownership differs.

### Client-Side

AG Grid sorts the complete local `rowData` working set directly. No server-grid query request is issued merely because the user changes sort order.

### Infinite + SSRM

AG Grid sort state is translated into the backend query contract and the server executes sorting across the dataset.

Common capabilities:

- sortable columns inherit native sorting by default;
- a feature can disable sorting for utility/action columns;
- stable backend IDs keep row identity independent of sort position;
- user sort preference is persisted through native Grid State.

Do not treat a server sort as a reorder of only the currently loaded cache.

---

## 4. Filtering

Filtering uses native AG Grid column-filter UI, with row-model-specific execution.

### Client-Side

The complete working set is local, so AG Grid executes filtering locally. Client columns intentionally do not inherit the narrower server filter parameters merely for consistency.

### Infinite + SSRM

Filtering is executed against the backend dataset. Current Transactions examples use text, number and date filters.

Server-backed capabilities include:

- feature-owned allow-list mapping from AG Grid FilterModel to backend filters;
- unsupported filter combinations fail explicitly rather than silently changing meaning;
- the same Transaction filter mapper is reused for normal row loading and Select All Filtered backend actions;
- server filter UI is deliberately limited to semantics the backend contract supports.

Across all three row models:

- active filter preference is persisted through native Grid State;
- filtered-wide Select All is invalidated if the defining filter changes;
- explicit row selection and All Records selection are not automatically cleared merely because the visible filter changes.

The active filter model remains AG Grid-owned. We do not maintain a second React copy simply to mirror it.

---

## 5. Pagination and cache behavior

### Client-Side

Current shared Client defaults provide:

```text
pagination enabled
page size = 25
page-size choices = 10 / 25 / 50
```

There is no server cache-block configuration because all Client rows are already in browser memory.

### Infinite + SSRM

Current shared server-backed defaults provide:

```text
pagination enabled
page size = 25
page-size choices = 10 / 25 / 50
cache block size = 50
max cached blocks = 5
block-load debounce = 120 ms
max concurrent datasource requests = 1
```

These are reusable defaults, not immutable business rules.

Important capability rule:

> Cache residency is never used to define which records a business action targets.

For example, server-backed Select All Records can update rows that the browser has never loaded. The backend resolves that logical target. Loaded cache blocks are only a presentation/performance concern.

---

## 6. Stable row identity

All three row models use stable backend row IDs.

This allows selection/editing/reconciliation to remain attached to business rows through applicable lifecycle changes such as:

- sorting;
- filtering;
- pagination;
- cache eviction/block reload;
- RowNode recreation;
- Client `rowData` replacement;
- server refresh.

The foundation must not use displayed row index/position as durable business identity.

---

## 7. Selection

The product can represent these user selection meanings where applicable:

```text
Manual / explicit rows
Current Page
All Filtered
All Records
```

These are selection **meanings**, not one mandatory implementation or UI.

### Client-Side selection

Client uses native AG Grid selection for all three Select All scopes:

```text
page      -> rowSelection.selectAll = 'currentPage'
filtered  -> rowSelection.selectAll = 'filtered'
all       -> rowSelection.selectAll = 'all'
```

Every selected Client row is concrete/local, so business actions can read exact native selected IDs. The current demo defaults to `all` but the same controller supports all three scopes.

### Server logical selection contract

Infinite/SSRM backend-facing selected operations use the compact logical shape:

```ts
{
  mode: 'include' | 'exclude',
  ids: string[],
}
```

Meaning:

```text
include [A, B]
-> exactly eligible A and B

exclude [] + filters
-> all eligible rows matching those filters

exclude [A] + filters
-> all eligible filtered rows except user-deselected A

exclude [] without filters
-> all eligible records

exclude [A] without filters
-> all eligible records except user-deselected A
```

The serialized backend contract does not need a redundant `scope` value.

### Infinite selection

Infinite uses native AG Grid selection for loaded/manual rows.

Because Infinite cannot natively remember an unloaded dataset-wide Select All plus exceptions, compact application selection state fills only that gap.

The Infinite header strategy can be configured as:

```text
page
filtered
all
```

That configuration answers what Select All means; it is not copied into the backend selection object.

### SSRM selection

SSRM prefers native Enterprise selection wherever available.

Current behavior:

- individual/manual rows -> native SSRM selection;
- All Records -> native SSRM server-side selection state;
- Current Page -> command over selectable current-page RowNodes;
- All Filtered -> small custom state because the current required behavior is not represented by the native configuration.

### Selection lifecycle

Selection currently supports:

- selection across pages where the row model can represent it;
- selection surviving sorting by stable ID;
- explicit selection surviving visible filter changes;
- All Records surviving visible filter changes;
- filtered-wide Select All resetting when the defining filter changes;
- server logical selection restoration as rows/blocks materialise again;
- user deselection exceptions during dataset-wide server selection;
- backend actions without enumerating every selected server row in the browser.

### Selection eligibility

Rows can be outside the selectable universe. Disabled rows are not manufactured as user `exclude` IDs.

Detailed contracts:

- `docs/client-side-grid.md`
- `frontend/src/infinite-selection-contract.md`
- `frontend/src/ssrm-selection-contract.md`
- `docs/row-interaction.md`

---

## 8. Selected-row counts

### Client-Side

Client selected count is exact because every row is local and native `isRowSelectable` is evaluated for the full working set:

```text
selected count = api.getSelectedRows().length
```

The deterministic current demo has 750 rows, of which 63 are `selectionDisabled` and 63 are `readOnly`; native Select All therefore selects 624 eligible rows.

### Infinite + SSRM

Server-backed selected totals use the same normal API metadata:

```text
explicit/manual/current-page -> exact include ID count
All Filtered                 -> filteredCount - user exceptions
All Records                  -> totalCount - user exceptions
```

Current `totalCount` / `filteredCount` are dataset/query counts rather than eligibility-aware counts. Therefore a server-wide displayed selected total can be larger than the number of rows an authoritative backend operation ultimately acts on.

Do not subtract only restricted rows currently loaded in the browser. That would create false precision for unloaded rows.

Detailed contract: `docs/selection-counts.md`.

---

## 9. Row interaction capability

A backend row can currently describe one of three generic interaction modes:

```text
enabled
selectionDisabled
readOnly
```

Logical meaning:

```text
enabled
-> selectable
-> editable

selectionDisabled
-> not selectable
-> excluded from selection-based business actions
-> still directly editable

readOnly
-> not selectable
-> excluded from selection-based business actions
-> not editable
-> no modifying row-level action
```

The feature/backend decides **why** a row receives a mode. Shared grid code only understands the generic capability.

Frontend behavior and backend mutation checks both enforce the rule. This matters especially for server-wide operations that may include rows the browser never loaded.

Detailed contract: `docs/row-interaction.md`.

---

## 10. Editing

The editing foundation is shared across Client-Side, Infinite and SSRM and is not tied to one visual editor layout.

### Direct cell editing

The grid tracks committed AG Grid cell edits after `cellValueChanged`.

Current Transactions editable fields are:

```text
account
amount
currency
status
```

The editable-field list and value access are feature configuration; the tracking mechanism is shared.

### Unsaved draft tracking

Dirty values are stored by stable backend row ID rather than relying on RowNode lifetime.

This lets unsaved work survive applicable lifecycle changes such as pagination, cache/store recreation and Client authoritative `rowData` replacement.

Returning a normal dirty field to its original BASE value automatically removes the draft.

### Programmatic edit application

The current foundation can apply tracked edits programmatically to eligible concrete/current-page RowNodes.

Existing reusable flows include:

- reapply the most recent direct edit;
- apply an explicit set of editable field changes;
- preserve the same row-editability rule used by direct editing.

A `readOnly` row cannot be changed by these helpers merely because code called a RowNode API.

### Row Save and Discard

One dirty row can be saved independently of checkbox selection.

Discard restores the latest authoritative value represented by tracked state and clears the row draft.

### Save/Discard selected edits

Aggregate editing operates on:

```text
dirty rows ∩ current logical selection
```

Therefore:

- selected but clean rows are not persisted;
- dirty but unselected rows remain untouched;
- the backend bulk endpoint receives explicit row IDs and explicit field changes;
- Select All does not manufacture edits for untouched/unloaded rows.

### Safe acknowledgement of in-flight saves

A save acknowledges only the exact value that was submitted successfully.

If the user edits the same field again while a request is in flight, that newer edit remains dirty instead of being erased by the older response.

Detailed editing contract: `docs/transaction-editing.md`.

---

## 11. Refresh/edit conflict reconciliation

The foundation detects when a refreshed authoritative value competes with an unsaved local edit for the same field.

For a dirty field it tracks:

```text
BASE   = value when the field first became dirty
LOCAL  = user's current unsaved value
REMOTE = latest authoritative refreshed server value
```

Reconciliation capability:

```text
REMOTE == BASE
-> keep LOCAL as an ordinary dirty edit

REMOTE == LOCAL
-> server already contains the desired value
-> automatically clean the field

REMOTE differs from BASE and LOCAL
-> preserve LOCAL
-> remember REMOTE
-> mark only that field conflicted
```

Resolution operations are generic:

```text
Use server
-> REMOTE wins
-> local field draft clears

Keep my edit
-> user intentionally keeps LOCAL
-> REMOTE becomes the new BASE
-> field remains dirty and can later be saved
```

Unresolved conflicts guard only relevant persistence/business mutations rather than globally locking an unrelated field action.

Detailed behavior and manual test matrix: `docs/edit-conflict-reconciliation.md`.

---

## 12. Backend operations currently demonstrated

Transactions currently demonstrates these relevant backend boundaries:

```text
GET   /api/transactions/
POST  /api/transactions/query/
PATCH /api/transactions/{id}/
PATCH /api/transactions/bulk/
PATCH /api/transactions/selection/
POST  /api/transactions/selection/export/
```

They represent reusable categories:

```text
Client collection
-> complete bounded working set

server query
-> load Infinite/SSRM blocks

single-row update
-> save one explicit dirty row

explicit bulk update
-> save explicit dirty row patches

logical selection action
-> apply one business change across a selected target

logical selected export
-> resolve server-backed selected rows and return CSV
```

Feature endpoints and payload fields are not shared-grid concerns; the capability boundaries are.

---

## 13. Selection-based business actions

The foundation can turn selection into a backend business-action target without making the grid know the business meaning.

Transactions currently demonstrates status changes.

### Client-Side

Client reads exact native selected IDs and sends an explicit `include` target. It does not need backend filter translation to describe already-known selected IDs.

### Infinite + SSRM

Server-backed dataset-wide selection can remain compact:

```text
logical include/exclude selection
-> shared target construction
-> feature filter translation when filtered exclude is active
-> backend selection endpoint
-> backend eligibility enforcement
-> row-model-specific refresh
```

The backend operation-neutral resolver is shared with server Selected export so mutation and export do not reinterpret selection differently.

---

## 14. Export

### Export Current Page

All three roots can use the shared native Current Page helper once the exact pagination-page RowNodes are concrete.

The helper:

- resolves the exact current AG Grid pagination page;
- refuses a partially unresolved page;
- delegates CSV serialization/escaping/value processing to native AG Grid;
- treats Current Page as a page snapshot, so displayed `selectionDisabled` / `readOnly` rows are included.

### Export Selected — Client-Side

All selected rows are local, so Client uses native AG Grid selected CSV with `onlySelectedAllPages` to include selection from other pagination pages.

### Export Selected — Infinite / SSRM

Logical selection may include unloaded rows, so Selected export is backend-owned. The frontend sends the common selection target; the backend resolves all authoritative eligible selected rows and generates CSV.

Detailed contract: `docs/grid-export.md` and `docs/client-side-grid.md`.

---

## 15. Grid State / user preference persistence

The foundation persists intentional native AG Grid preference state:

- column order;
- column pinning;
- column widths;
- column visibility;
- filters;
- sorting.

It deliberately does not currently persist:

- pagination position;
- row selection.

Client, Infinite and SSRM use separate preference keys so independent grids do not overwrite one another.

The current store uses browser storage behind a replaceable `GridStateStore` boundary, so future user/profile persistence can replace storage without replacing the Grid State contract.

---

## 16. Error handling, retry and refresh

The row models intentionally keep their appropriate lifecycle ownership.

```text
Client
-> TanStack Query refetch/cache update + rowData replacement

Infinite
-> refreshInfiniteCache()

SSRM
-> refreshServerSide() / retryServerSideLoads()
```

Infinite and SSRM loading adapters also cancel obsolete in-flight datasource requests when their datasource is destroyed.

Do not create one artificial refresh abstraction merely to make these mechanics look identical.

---

## 17. Column, presentation, theming and setup capabilities

The foundation supports native feature column definitions including:

- sortable columns;
- resizable columns;
- filterable columns;
- editable callbacks;
- built-in and custom cell editors;
- custom cell renderers;
- value formatters;
- cell class rules;
- tooltips;
- utility/action columns that opt out of sort/filter/edit.

Transactions demonstrates currency/date formatting, status rendering/editing, interaction state rendering and conflict cell treatment.

The same Transaction domain columns are composed with different filter mechanics where appropriate: server grids use backend-compatible filter parameters; Client uses native local filtering without inheriting server restrictions.

The application also provides:

- one shared AG Grid theme built from application design tokens;
- global default column behavior;
- centralized AG Grid module registration;
- centralized Enterprise license setup.

There is no generic React wrapper that hides `AgGridReact`.

---

## 18. Lifecycle hardening

The foundation explicitly treats AG Grid lifecycle ownership as part of correctness.

Current protections include:

- each concrete Client/Infinite/SSRM root owns one authoritative `GridApi` ref;
- the ref is cleared during `gridPreDestroy`;
- custom listener cleanup checks destroyed APIs where required;
- Infinite/SSRM datasource destruction aborts outstanding requests;
- latest-request metadata is guarded by request start order;
- programmatic editing writes are marked so they do not become false user edits;
- locally overlaid RowNode data is distinguished from genuinely refreshed authoritative data so drafts are not accidentally auto-cleared.

This category should keep evolving whenever a real AG Grid warning/race is found.

---

## 19. Capability discoverability / extraction support

This repository is intentionally also a source of reusable proven patterns.

`docs/grid-capability-tags.md` registers stable `GRIDCAP-*` markers across important:

- concrete row-model roots;
- shared controllers/algorithms;
- datasource/query boundaries;
- editing/export/selection integration;
- backend authority;
- focused executable tests.

A developer who wants to extract one capability should find its registered tag, search exact occurrences, read the row-model ownership notes, inspect every meaningful touchpoint, and then adapt only the implementation relevant to the target project's row model.

A marker means "this code participates in the capability"; it does not mean every marked file should be copied unchanged.

---

## 20. What is deliberately not a current capability

Do not assume the foundation currently provides these:

- grouped/tree SSRM selection semantics;
- aggregation/pivot result contracts;
- backend optimistic concurrency/version enforcement for a stale client that never refreshed;
- bulk `Use all server` / `Keep all my edits` conflict resolution;
- one universal grid wrapper/controller hiding Client, Infinite and SSRM;
- database-backed user grid preferences;
- import/template/sample upload workflow;
- business actions inferred from currently loaded server-cache rows only.

These can be added when a real product requirement justifies them.

---

## 21. Where to read next

Use this document to discover a capability, then use the detailed contract or searchable registry for implementation/edge cases:

- `docs/grid-capability-tags.md` — searchable capability marker registry and extraction workflow;
- `docs/client-side-grid.md` — Client data/selection/export ownership and capability matrix;
- `docs/ag-grid-native-usage.md` — AG Grid-native props/APIs/events we rely on;
- `docs/ag-grid.md` — architecture and ownership rules;
- `docs/server-backed-grid-reuse.md` — how to add another server-backed table;
- `frontend/src/infinite-selection-contract.md` — Infinite selection source of truth;
- `frontend/src/ssrm-selection-contract.md` — SSRM selection source of truth;
- `docs/selection-counts.md` — selected-total semantics and eligibility limitation;
- `docs/grid-export.md` — export ownership/eligibility semantics;
- `docs/row-interaction.md` — selectable/editable/read-only contract;
- `docs/transaction-editing.md` — editing behavior;
- `docs/edit-conflict-reconciliation.md` — refresh conflict behavior and manual testing;
- `docs/api-data-flow.md` — Client and server API/query/action flow;
- `docs/grid-backlog.md` — unfinished verification/design/product work;
- `docs/ag-grid-foundation-status.md` — current foundation status and remaining work.
