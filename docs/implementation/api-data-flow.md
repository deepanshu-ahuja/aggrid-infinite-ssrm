# API and Data Flow

This document describes the **current implemented** frontend/backend data flow for Client-Side, Infinite and SSRM Transaction grids.

It does not describe planned APIs or configurable-table metadata.

## Client-Side collection flow

Client-Side loads the complete bounded Transaction working set through TanStack Query:

```text
GET /api/transactions/
        ↓
TanStack Query authoritative cache
        ↓
fresh editable row copies
        ↓
AG Grid rowData
        ↓
native local sort/filter/pagination/selection
```

AG Grid does not receive the exact authoritative cache object references. Editable copies keep LOCAL cell mutation separate from REMOTE authoritative values used by conflict reconciliation.

Explicit Save responses return authoritative rows that are merged into the Client Query cache. The selected Change Status endpoint currently returns an update count, so the Client collection is refetched after that successful operation.

## Infinite / SSRM row-loading flow

Both server-backed row models load blocks while keeping their AG Grid adapters separate:

```text
AG Grid block request
  → Infinite or SSRM datasource adapter
  → Transaction request mapper
  → typed frontend API client
  → DRF validation
  → Transaction query service
  → { rows, totalCount, filteredCount }
  → row-model success callback
```

Each row also contains backend-provided interaction capability data such as `interactionMode` and `interactionReason`.

Raw AG Grid request objects do not cross the HTTP boundary.

`transactionRequest.mapper.ts` translates native AG Grid sort/filter models into the allow-listed backend query contract.

Example:

```json
{
  "offset": 0,
  "limit": 50,
  "sort": [{ "field": "amount", "direction": "desc" }],
  "filters": [{ "field": "status", "operator": "equals", "value": "Completed" }]
}
```

Unsupported server filter shapes fail explicitly instead of silently changing meaning.

## Query counts

Server-backed row responses currently include:

```text
totalCount
→ complete dataset size before current grid filters

filteredCount
→ number of rows matching the current translated filters
```

The latest-started server request owns renderable count metadata. A late older response may finish its AG Grid loading callback but must not overwrite counts published for a newer request.

## Row interaction flow

For loaded rows, feature adapters map backend interaction capability into native AG Grid behavior:

```text
backend interactionMode
  → Transaction row-policy adapter
  → rowSelection.isRowSelectable
  → column editable callbacks
  → shared programmatic-edit row predicate
```

Current generic meaning:

```text
enabled
→ selectable and editable

selectionDisabled
→ not selectable / not part of selected business operations
→ directly editable

readOnly
→ not selectable / not part of selected business operations
→ not editable
```

Restricted rows are not inserted into logical selection exception IDs. Backend services independently enforce authoritative eligibility.

## Single-row Save

```text
tracked row changes
  → PATCH /api/transactions/{id}/
  → backend resolves explicit row
  → backend validates row policy + writable fields
  → backend applies patch
  → authoritative row response
  → acknowledge submitted tracked values
  → update/refresh authoritative grid data
```

A `selectionDisabled` row may be saved directly. A `readOnly` row is rejected.

## Explicit bulk Save

Save Selected Edits persists already-existing LOCAL drafts:

```text
changesById
  ∩
current logical selection
  → explicit [{ id, changes }, ...]
  → PATCH /api/transactions/bulk/
  → backend validates every requested row first
  → apply explicit row patches
  → authoritative row responses
  → acknowledge submitted tracked values
```

The bulk endpoint is ID-based. It does not use logical exclude-mode selection to manufacture edits for unloaded rows.

## Selected Change Status flow

Selected Change Status is a separate business operation from dirty-edit persistence.

### Client-Side

Client can enumerate every selected row exactly:

```text
native selected rows
  → include + exact selected IDs
  → PATCH /api/transactions/selection/
  → backend eligibility + status update
  → success
  → Client clearSelection()
  → refetch authoritative collection
```

Exact Client include selection does not require backend filter context.

### Infinite / SSRM

Server-backed selected operations use the row model's logical selection intent:

```json
{
  "mode": "include | exclude",
  "ids": []
}
```

Current server resolution:

```text
include + ids
→ requested backend-eligible rows

exclude + translated filters
→ matching backend-eligible rows minus explicit user exceptions

exclude without filters
→ all backend-eligible rows minus explicit user exceptions
```

All Filtered uses the same Transaction filter mapper as normal server row loading.

All Records sends exclude-mode selection without filters.

After successful Change Status:

```text
Infinite
→ controller clearSelection()
→ refreshInfiniteCache()

SSRM
→ controller clearSelection()
→ refreshServerSide()
```

The backend request contains only the business target and changes. It does not contain a frontend selection-lifecycle setting.

## Selected export flow

### Client-Side

```text
native Client selected rows
→ native AG Grid CSV across pagination pages
```

No selected-export backend request is made.

### Infinite / SSRM

```text
row-model logical selection
  → common server selection target
  → POST /api/transactions/selection/export/
  → backend resolves authoritative eligible rows
  → backend CSV response
```

The same backend resolver semantics are used for selected mutation and selected export.

## Conflict reconciliation flow

Fresh authoritative values are reconciled against LOCAL drafts before remaining LOCAL values are overlaid back into grid rows.

Authoritative arrival differs by row model:

```text
Client
→ TanStack Query rowData replacement

Infinite
→ cache block load/refresh/recreation

SSRM
→ server-side store load/refresh/recreation
```

The shared editing state handles BASE/LOCAL/REMOTE comparison; each concrete root owns its native authoritative-data lifecycle.

## Current Transaction endpoints

```text
GET   /api/transactions/
POST  /api/transactions/query/
PATCH /api/transactions/{id}/
PATCH /api/transactions/bulk/
PATCH /api/transactions/selection/
POST  /api/transactions/selection/export/
```

Current responsibilities:

```text
GET collection
→ bounded Client working set

query
→ Infinite/SSRM block loading + counts

{id}
→ one explicit dirty-row Save

bulk
→ explicit dirty-row batch Save

selection
→ selected Change Status business operation

selection/export
→ server-backed Selected CSV
```
