# Grid Capability Catalog

This document answers one question:

> What can the current server-backed grid foundation do today?

It describes **logical capabilities**, not one particular screen layout or button arrangement. A feature can reuse these capabilities with a different UI as long as it respects the same contracts.

Detailed feature/edge-case documents remain the source of truth for implementation details. This file is the high-level catalog that a developer should read first when deciding whether the foundation already supports a requirement.

## Maintenance rule

When a grid capability is added, removed, or materially changes, update this document in the same change.

Do not let this become a roadmap or wish list. A capability belongs here only when the repository currently implements it.

For the separate list of AG Grid-native APIs, props, events and RowNode features we rely on, see `docs/ag-grid-native-usage.md`.

---

## 1. Supported row models

The foundation currently supports two server-backed AG Grid row models:

### Infinite Row Model

Use when the application wants a lightweight server-backed flat table with block loading, pagination and a bounded browser cache.

Current support includes:

- backend block loading;
- server-side sorting and filtering;
- stable backend row IDs;
- pagination;
- bounded block caching;
- retry/error handling;
- native loaded-row selection;
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

## 2. Server-backed data loading

Both row models can request data from the backend instead of loading the complete dataset into the browser.

The shared capability is:

```text
AG Grid row-model request
-> row-model-specific datasource adapter
-> feature request mapper
-> typed API request
-> backend query
-> rows + counts
-> AG Grid row model/cache
```

The current flat response includes:

- rows for the requested block;
- total dataset count;
- filtered count.

The browser does not send raw AG Grid request objects directly to Django. The feature request mapper translates AG Grid sort/filter models into an allow-listed backend contract.

Detailed flow: `docs/api-data-flow.md`.

---

## 3. Sorting

Sorting is available through AG Grid column sorting and is executed against the backend dataset.

Capabilities:

- sortable columns inherit native sorting by default;
- a feature can disable sorting for specific utility/action columns;
- AG Grid sort state is translated into the backend query contract;
- multiple server sort items can be represented by the request contract;
- sorting does not clear logical selection because row identity is based on stable backend IDs, not row position;
- user sort preference is persisted through native Grid State.

Sorting is therefore a data-query capability, not a client-only reorder of currently loaded rows.

---

## 4. Filtering

Filtering is available through native AG Grid column filters and is executed against the backend dataset.

Current Transactions examples use:

- text filters;
- number filters;
- date filters.

Capabilities:

- globally filterable columns by default;
- per-column filter type/params;
- feature-owned allow-list mapping from AG Grid FilterModel to backend filters;
- unsupported filter combinations fail explicitly rather than silently changing meaning;
- the same filter mapper is reused for normal row loading and Select All Filtered business actions;
- active filter preference is persisted through native Grid State;
- filtered-wide selection is invalidated if the defining filter changes;
- explicit row selection and All Records selection are not automatically cleared merely because the visible filter changes.

The filter itself remains AG Grid-owned. We do not maintain a second React copy of the active filter model.

---

## 5. Pagination and cache behavior

The shared server-backed defaults currently provide:

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

For example, Select All Records can update rows that the browser has never loaded. The backend resolves that logical target. Loaded cache blocks are only a presentation/performance concern.

---

## 6. Stable row identity

Both row models use stable backend row IDs.

This allows selection and editing to survive:

- sorting;
- pagination;
- cache eviction;
- block reload;
- RowNode recreation;
- server refresh.

The foundation must not use row index/position as durable business identity.

---

## 7. Selection

Selection supports both concrete loaded-row selection and logical server-backed selection.

### Selection meanings available today

The product can represent these selection meanings:

```text
Current Page
All Filtered
All Records
```

Manual/individual multi-row selection is also supported.

These are selection **meanings**, not one required UI. A feature may expose them as header behavior, buttons, menu actions or another appropriate presentation.

### Logical selection contract

Shared/application code uses the compact logical shape:

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

Because Infinite cannot natively remember an unloaded dataset-wide Select All plus exceptions, application selection state fills only that gap.

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

- selection across pages;
- selection surviving sorting;
- explicit selection surviving visible filter changes;
- All Records surviving visible filter changes;
- filtered-wide Select All resetting when the defining filter changes;
- restoration as rows/blocks materialise again;
- user deselection exceptions during dataset-wide selection;
- selection-aware backend actions without enumerating every selected row in the browser.

### Selection eligibility

Rows can be outside the selectable universe. Disabled rows are not manufactured as `exclude` IDs.

Detailed contracts:

- `frontend/src/infinite-selection-contract.md`
- `frontend/src/ssrm-selection-contract.md`
- `docs/row-interaction.md`

---

## 8. Row interaction capability

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

Frontend behavior and backend mutation checks both enforce the rule so unloaded rows are protected as well.

Detailed contract: `docs/row-interaction.md`.

---

## 9. Editing

The editing foundation is not tied to one visual editor layout. It provides reusable edit mechanics that a feature can present however it wants.

### Direct cell editing

The grid can track a committed AG Grid cell edit after `cellValueChanged`.

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

This lets unsaved edits survive:

- pagination;
- cache/store reload;
- RowNode recreation;
- server-backed refresh where the server did not independently change that field.

Returning a normal dirty field to its original value automatically removes the draft.

### Programmatic edit application

The current foundation can apply tracked edits programmatically to eligible loaded/current-page RowNodes.

Existing reusable flows include:

- reapply the most recent edit;
- apply an explicit set of editable field changes;
- preserve the same row-editability rule used by direct editing.

A `readOnly` row cannot be changed by these helpers merely because code called a RowNode API.

### Row Save and Discard

One dirty row can be saved independently of checkbox selection.

Discard restores authoritative values and clears the row's tracked draft.

### Save/Discard selected edits

Aggregate editing operates on:

```text
dirty rows ∩ current logical selection
```

Therefore:

- selected but clean rows are not persisted;
- dirty but unselected rows remain untouched;
- the backend bulk endpoint receives explicit row IDs and explicit field changes;
- it does not turn logical Select All into edits for untouched/unloaded rows.

### Safe acknowledgement of in-flight saves

A save acknowledges only the exact value that was submitted successfully.

If the user edits the same field again while a request is in flight, that newer edit remains dirty instead of being erased by the older response.

Detailed editing contract: `docs/transaction-editing.md`.

---

## 10. Refresh/edit conflict reconciliation

The foundation can detect when a refreshed server value competes with an unsaved local edit for the same field.

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

### Conflict-aware mutation protection

Unresolved conflicts are not only visual metadata.

The current foundation can guard:

- row Save when that row has unresolved conflicts;
- Save selected edits when the selected dirty update set contains a conflict;
- selection-based business actions only when they write a field that is conflicted in the selected target.

Example:

```text
selected status conflict + status action
-> blocked

selected amount conflict + status action
-> allowed
```

This prevents a broad "row has any conflict, disable everything" rule.

Detailed behavior and manual test matrix: `docs/edit-conflict-reconciliation.md`.

---

## 11. Backend mutations currently demonstrated

Transactions currently demonstrates four backend operations:

```text
POST  /api/transactions/query/
PATCH /api/transactions/{id}/
PATCH /api/transactions/bulk/
PATCH /api/transactions/selection/
```

They represent four reusable categories:

```text
query
-> load server-backed rows

single-row update
-> save one explicit dirty row

explicit bulk update
-> save explicit dirty row patches

logical selection action
-> apply one business change across include/exclude selection, including unloaded rows
```

Feature endpoints and payload fields are not shared-grid concerns; the capability boundaries are.

---

## 12. Selection-based business actions

The grid can turn logical selection into a backend action target without expanding the entire dataset into IDs in the browser.

Transactions currently demonstrates status actions such as setting selected eligible rows to a status.

The generic action path is:

```text
logical include/exclude selection
-> shared target construction
-> feature filter translation / business changes
-> backend selection endpoint
-> backend eligibility enforcement
-> row-model-specific refresh
```

This capability can support other future business actions without making the grid know their business meaning.

---

## 13. Grid State / user preference persistence

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

Infinite and SSRM use separate preference keys.

The current store uses browser storage behind a replaceable `GridStateStore` boundary, so future user/profile persistence can replace storage without replacing the Grid State contract.

---

## 14. Error handling and retry

Both row models support data-load error presentation and retry.

The retry implementation remains row-model specific rather than pretending Infinite and SSRM have one identical native lifecycle.

Successful backend writes also use row-model-specific native refresh:

```text
Infinite -> refreshInfiniteCache()
SSRM     -> refreshServerSide()
```

The browser then receives authoritative server values through the normal datasource path.

---

## 15. Column/presentation capabilities currently used

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

These are feature presentation choices composed on top of native `ColDef` rather than a custom column abstraction.

---

## 16. Theming and application defaults

The application provides:

- one shared AG Grid theme;
- global default column behavior;
- centralized AG Grid module registration;
- centralized Enterprise license setup.

Feature grids can still override native grid/column options where required.

There is no generic React wrapper that hides `AgGridReact`.

---

## 17. Lifecycle hardening

The foundation explicitly treats AG Grid lifecycle ownership as part of correctness.

Current protections include:

- each concrete grid root owns one authoritative `GridApi` ref;
- the ref is cleared during `gridPreDestroy`;
- custom listener cleanup checks `api.isDestroyed()` before calling GridApi methods after teardown;
- programmatic editing writes are marked so they do not become false user edits;
- locally overlaid RowNode data is distinguished from genuinely refreshed server data so drafts are not accidentally auto-cleared.

This category should keep evolving whenever a real AG Grid warning/race is found.

---

## 18. What is deliberately not a current capability

Do not assume the foundation currently provides these:

- grouped/tree SSRM selection semantics;
- aggregation/pivot result contracts;
- backend optimistic concurrency/version enforcement for a stale client that never refreshed;
- bulk `Use all server` / `Keep all my edits` conflict resolution;
- one universal grid wrapper/component hiding Infinite and SSRM;
- database-backed user grid preferences;
- business actions inferred from currently loaded cache rows only.

These can be added when a real product requirement justifies them.

---

## 19. Where to read next

Use this document to discover a capability, then use the detailed contract for implementation/edge cases:

- `docs/ag-grid-native-usage.md` — AG Grid-native props/APIs/events we rely on;
- `docs/ag-grid.md` — architecture and ownership rules;
- `docs/server-backed-grid-reuse.md` — how to add another server-backed table;
- `frontend/src/infinite-selection-contract.md` — Infinite selection source of truth;
- `frontend/src/ssrm-selection-contract.md` — SSRM selection source of truth;
- `docs/row-interaction.md` — selectable/editable/read-only contract;
- `docs/transaction-editing.md` — editing behavior;
- `docs/edit-conflict-reconciliation.md` — refresh conflict behavior and manual testing;
- `docs/api-data-flow.md` — API/query/action flow;
- `docs/ag-grid-foundation-status.md` — current foundation status and remaining work.
