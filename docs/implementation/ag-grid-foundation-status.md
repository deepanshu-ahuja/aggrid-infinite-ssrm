# AG Grid Foundation Status

This document is a **current implementation snapshot** of the AG Grid foundation.

It is not the backlog and does not record discarded designs. Planned work belongs in `docs/grid-backlog.md`; configurable-table target architecture belongs in the dedicated architecture documents.

For a capability-first catalog, see `docs/grid-capabilities.md`. For the native AG Grid surface currently used by the code, see `docs/ag-grid-native-usage.md`.

## Current foundation rules

- use native AG Grid behavior/API first;
- keep Client-Side, Infinite and SSRM as separate real implementations where their native ownership differs;
- share domain-neutral mechanics only;
- keep Transaction fields, business actions and backend policy feature-owned;
- keep each concrete root's `GridApi` ownership visible;
- treat lifecycle/race warnings as correctness issues rather than suppressing them.

## Application bootstrap

Current shared setup includes:

- AG Grid Enterprise license initialization;
- central AG Grid module registration through `AgGridProvider`;
- development validations in development builds;
- application AG Grid theme;
- small native global `defaultColDef` configuration;
- direct `AgGridReact` rendering from feature roots rather than a universal wrapper.

## Implemented row models

### Client-Side Row Model

`TransactionsClientGrid` currently:

- fetches the complete bounded Transaction collection through TanStack Query;
- supplies editable row copies to native `rowData`;
- uses native local sorting/filtering/pagination;
- uses native `currentPage`, `filtered` and `all` Select All scopes;
- reads exact native selected IDs/count;
- uses local/native Selected CSV export;
- reuses shared tracked editing/conflict mechanics;
- uses native Grid State persistence.

### Infinite Row Model

`TransactionsInfiniteGrid` currently:

- uses AG Grid Infinite datasource/block loading;
- sends server sort/filter through the feature request mapper;
- uses stable backend row IDs;
- uses native loaded/manual/page selection where concrete RowNodes exist;
- uses compact application state for filtered/all dataset-wide selection across unloaded rows;
- restores logical selection as rows materialise;
- refreshes authoritative resident cache blocks with `refreshInfiniteCache()` after writes;
- reuses shared tracked editing/conflict mechanics and Grid State persistence.

### Server-Side Row Model

`TransactionsSsrmGrid` currently:

- uses flat Enterprise SSRM datasource/store loading;
- sends server sort/filter through the feature request mapper;
- uses stable backend row IDs;
- uses native explicit and All Records SSRM selection state;
- uses explicit Current Page selection over concrete selectable RowNodes;
- uses application-owned All Filtered state for the current unsupported native semantic;
- refreshes authoritative store data with `refreshServerSide()` after writes;
- reuses shared tracked editing/conflict mechanics and Grid State persistence.

## Selection target contract

Server-backed selected operations use the compact logical selection shape:

```ts
{
  mode: 'include' | 'exclude',
  ids: string[],
}
```

Meaning:

```text
include + ids
→ those exact backend-eligible rows

exclude + translated filters
→ all matching backend-eligible rows minus explicit user exceptions

exclude without filters
→ all backend-eligible rows minus explicit user exceptions
```

The serialized selection does not carry a separate row-model `scope` field.

## Change Status business action

Transactions currently demonstrates one selected-row **Change Status** mutation family with different status values.

Current success lifecycle:

```text
logical selection
→ Transaction Change Status request
→ PATCH /api/transactions/selection/
→ backend succeeds
→ concrete grid root calls its row-model controller's existing clearSelection()
→ concrete grid refreshes authoritative data
```

A failed request does not run the success callback, so the existing selection remains.

There is no selection-lifecycle configuration in this implemented action path.

## Selected-row counts

Client selected count is exact because the complete selectable working set is local.

Infinite/SSRM dataset-wide selected totals currently use normal API query metadata:

```text
explicit/current-page
→ exact include ID count

All Filtered
→ filteredCount - user exceptions

All Records
→ totalCount - user exceptions
```

The server-backed count metadata describes query membership, not exact operation eligibility, so backend-selected operations can act on fewer rows than the displayed dataset-wide count when restricted unloaded rows exist.

## Row interaction

Rows currently expose generic interaction modes:

```text
enabled
selectionDisabled
readOnly
```

Frontend loaded-row behavior uses native AG Grid selectability/editability callbacks. Backend services independently enforce selection eligibility and read-only persistence for authoritative operations.

`selectionDisabled` rows remain directly editable. `readOnly` rows are neither selectable nor editable.

## Editing

Tracked edits are stored outside transient RowNodes by stable backend row ID.

Current editing behavior includes:

- direct committed cell-edit tracking;
- manual return to BASE cleaning a normal draft;
- current-page programmatic edit application;
- row Save/Discard;
- Save/Discard selected dirty rows using `dirty ∩ logical selection`;
- safe acknowledgement of only submitted values after persistence;
- protection against programmatic RowNode writes becoming fake user edits;
- restoration of LOCAL drafts when authoritative row objects/RowNodes are replaced.

## BASE / LOCAL / REMOTE conflict reconciliation

For each dirty field:

```text
BASE   = authoritative value when the field became dirty
LOCAL  = current unsaved value
REMOTE = latest newly-arrived authoritative value
```

Current reconciliation:

```text
REMOTE == BASE
→ keep LOCAL dirty

REMOTE == LOCAL
→ clean the field automatically

REMOTE differs from BASE and LOCAL
→ keep LOCAL visible
→ retain REMOTE
→ mark the field conflicted
```

Current resolution operations are `Use server` and `Keep my edit`.

Unresolved conflicts block relevant Save/business writes rather than silently overwriting or partially saving conflicted targets.

## Export

Current export capability is:

```text
Export Current Page
Export Selected
```

Current Page uses native AG Grid CSV over the exact fully resolved pagination page for all three row models.

Selected ownership differs:

- Client: native/local selected CSV across pagination pages;
- Infinite/SSRM: backend selected export using the same logical selection resolver as selected business operations.

## Grid State

Native AG Grid Grid State currently persists:

- column order;
- pinning;
- sizing;
- visibility;
- filters;
- sort.

Client, Infinite and SSRM use separate persistence keys. Row selection and pagination position are not persisted as durable preferences.

## Lifecycle hardening

Current protections include:

- concrete-root authoritative `GridApi` refs;
- clearing those refs in `gridPreDestroy`;
- destroyed-API guards for custom header cleanup/click handling;
- datasource cancellation on destroy/replacement;
- latest-started-request ownership for renderable server count metadata;
- local-overlay markers so tracked LOCAL RowNode writes are not mistaken for newly fetched REMOTE data.

## Verification status

Focused automated coverage exists across the implemented capabilities and CI runs frontend lint/typecheck/tests/build plus backend Django checks/tests.

Manual browser regression for all three row models remains separately pending until it is actually run; this document does not mark manual verification complete.
