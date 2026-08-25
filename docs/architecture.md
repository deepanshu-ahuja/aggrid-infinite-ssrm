# Architecture

The repository keeps frontend and backend deployable as one Databricks App while retaining clear application boundaries.

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
│   └── apps/transactions/       DRF endpoint and transaction query service
├── docs/                        architectural and engineering conventions
├── app.yaml                     Databricks Apps runtime command
├── package.json                 frontend dependencies, build and quality scripts
└── requirements.txt             Python runtime dependencies
```

## Boundaries

`AppProviders` owns application-wide AG Grid setup such as module/license initialization and the intentionally small native global GridOptions surface. Feature tables render `AgGridReact` directly and keep row-model behavior, datasources, selection, IDs and lifecycle callbacks visible. MUI is consumed directly except for true application composition; there is no parallel `AppBox`/`AppStack` component system.

The transaction feature owns its columns, renderers, frontend API contract and AG Grid-to-API mapping. Shared grid code knows how to load a flat block of rows but knows nothing about transaction fields or Django payloads.

The Infinite and SSRM transaction tables are separate feature components selected by feature configuration, not UI state. Infinite uses shared selection calculations for page/filtered/all intent where native Infinite selection cannot represent unloaded rows. SSRM uses its native server-side selection APIs where supported and keeps only the unsupported filtered/current-page behavior explicit. The feature remains responsible for deciding when selection intent is submitted to a business operation.

Native AG Grid Grid State is used for persisted table preferences such as column layout, sorting and filtering. The current browser store is behind a small persistence contract so storage can change later without rewriting the grids. Selection and pagination position are intentionally not treated as persisted user preferences.

Django validates a stable pagination, sorting and filtering contract. The current deterministic data source proves the integration locally and is a replaceable service boundary for a later Databricks SQL or other repository implementation.

## Intentionally absent

- No Docker, Kubernetes, Helm, Nginx or separate production Node server.
- No wrappers for MUI primitives and no recreated AG Grid API.
- No universal row-model framework, repository framework or speculative custom hooks.
- No SSRM grouping, aggregation, pivoting or tree-data contract.
- No authentication strategy or Databricks data client until those requirements are selected.
