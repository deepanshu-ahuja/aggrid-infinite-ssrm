# Architecture

```text
.
├── frontend/
│   └── src/
│       ├── app/                 application composition and providers
│       ├── features/            feature-owned UI, API contracts, mapping and grid definitions
│       ├── shared/              genuinely reusable API and grid infrastructure
│       └── theme/               library-neutral tokens plus MUI and AG Grid adapters
├── backend/
│   ├── config/                  Django settings, URLs and WSGI/ASGI entry points
│   └── apps/transactions/       DRF endpoints and Transaction services
├── docs/                        implementation, architecture and engineering documentation
├── app.yaml                     Databricks Apps runtime command
├── package.json                 frontend dependencies, build and quality scripts
└── requirements.txt             Python runtime dependencies
```

## Application and grid boundaries

`AppProviders` owns application-wide AG Grid setup such as module/license initialization and the intentionally small native global GridOptions surface.

Feature tables render `AgGridReact` directly. There is no universal table wrapper that hides AG Grid lifecycle.

Each concrete grid root owns its own `GridApi` and row-model lifecycle:

```text
TransactionsClientGrid
TransactionsInfiniteGrid
TransactionsSsrmGrid
```

The three row models are separate implementations. Shared code captures only mechanics or semantics that are genuinely common.

## Transaction feature ownership

The Transactions feature owns:

- Transaction columns and feature renderers/editors;
- frontend API contracts;
- AG Grid filter/sort to backend-query mapping;
- Transaction business actions;
- Transaction editable-field configuration;
- feature presentation for row interaction and edit conflicts.

Shared grid code does not know Transaction field names or business rules.

## Client-Side Row Model

Client-Side receives the complete bounded Transaction collection through TanStack Query and passes editable row copies to native AG Grid `rowData`.

AG Grid owns local sorting, filtering, pagination and selection.

The Client selection controller uses native Select All scopes and exact selected IDs because the complete working set is available in browser memory.

## Infinite Row Model

Infinite uses AG Grid's datasource/block lifecycle for server-backed loading.

Native selection is used for concrete loaded rows. Compact application state represents filtered/all dataset-wide selection because unloaded Infinite rows do not have RowNodes.

## Server-Side Row Model

SSRM uses Enterprise server-side datasource/store behavior and native server-side selection state where AG Grid supports the required meaning.

Application state exists only for the current All Filtered semantic that is not represented by the configured native SSRM selection behavior.

## Shared grid layer

`frontend/src/shared/grid` currently owns reusable mechanics including:

- Client and server-backed defaults;
- Infinite and SSRM datasource adapters;
- row-model-specific selection controllers;
- stable current-page RowNode resolution;
- logical server-selection target helpers;
- row interaction primitives;
- tracked edit/conflict state mechanics;
- native Grid State persistence boundary;
- export helpers;
- formatters;
- error overlay;
- AG Grid module/license bootstrap.

Shared code uses AG Grid's concepts directly instead of recreating an application-specific grid API.

## Editing and conflict ownership

Unsaved edit state is application-owned and keyed by stable backend row ID so it does not depend on RowNode lifetime or Client row-object identity.

The shared editing engine tracks BASE/LOCAL/REMOTE values and field conflicts. Each concrete grid root supplies the row-model-specific point where fresh authoritative data arrives and the row-model-specific refresh behavior.

## Row interaction and backend authority

Rows currently expose one of three generic interaction modes:

```text
enabled
selectionDisabled
readOnly
```

The backend/feature decides why a row receives a mode. Shared grid code only applies the generic selection/editing meaning.

Frontend callbacks prevent invalid loaded-row interaction; backend services independently enforce eligibility and read-only rules for authoritative writes and server-wide selected operations.

## Grid State

Native AG Grid `GridState` is used for current persisted view preferences:

- column order/pinning/sizing/visibility;
- filtering;
- sorting.

Client, Infinite and SSRM use separate persistence keys. Pagination position and business row selection are not persisted as user preferences.

## Deployment boundary

Frontend and backend remain one repository and one Databricks App deployment unit. Django serves the API and built frontend application.

No Docker/Kubernetes/Helm/Nginx layer is part of the current repository architecture.
