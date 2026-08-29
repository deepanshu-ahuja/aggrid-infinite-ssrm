# Databricks Grid App

A greenfield React 19 and Django REST Framework application for Databricks Apps. The example Transaction feature contains separate AG Grid Client-Side, Infinite and flat Server-Side Row Model (SSRM) implementations.

## Prerequisites

- Node.js 22 or newer
- Python 3.11 or newer (matching the Databricks Apps runtime)
- An AG Grid Enterprise trial or production key only when testing SSRM

## Local setup

```bash
npm install
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Run Django and Vite in separate terminals:

```bash
source .venv/bin/activate
python backend/manage.py runserver
```

```bash
npm run dev
```

Vite serves the frontend and proxies `/api` to Django. Set `VITE_AG_GRID_LICENSE_KEY` in `.env` to remove the Enterprise trial watermark while evaluating SSRM. Client-Side and Infinite Row Model do not require an Enterprise license.

The app exposes all three real row-model roots directly:

```text
/client
/infinite
/ssrm
```

`frontend/src/features/transactions/transactionsGrid.config.ts` keeps row-model-specific configuration such as Client/Infinite selection scope (`page`, `filtered`, or `all`) and native grid options. Client-Side, Infinite and SSRM lifecycle/selection implementations remain separate rather than being hidden behind one universal wrapper.

## Verification

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
source .venv/bin/activate
python backend/manage.py test apps.transactions
```

Pull requests also run these checks in GitHub Actions. See [GitHub Actions CI](docs/github-actions-ci.md) for the current workflow explanation.

Manual browser verification may be performed later as a consolidated pass. Use [Client-Side Row Model foundation](docs/client-side-grid.md) for Client scenarios and [Pre-Client manual testing](docs/pre-client-manual-testing.md) for the pending Infinite + SSRM regression checklist. Do not mark either complete unless the browser scenarios were actually run.

## Databricks Apps

The root `package.json` build script produces `frontend/dist`. Databricks installs root Node and Python dependencies, runs the frontend build, and starts the Django WSGI application using `app.yaml`. Django and WhiteNoise serve the built SPA and hashed assets from the same process.

Configure `DJANGO_SECRET_KEY` and the AG Grid license key through Databricks App resources or environment configuration rather than committing them. The supplied `app.yaml` contains only non-secret runtime settings.

## Continuing in a new chat or coding-agent session

Read [AGENTS.md](AGENTS.md) **first**. It is the repository-owned developer/AI working contract for architecture, documentation scope, capability discovery, testing, Git/PR workflow and current roadmap sequencing.

When changing or extracting one frontend grid capability, use the [Grid capability tag registry](docs/grid-capability-tags.md): find the relevant `GRIDCAP-*` marker, read its row-model notes, then inspect the exact marker across frontend source and focused frontend tests. Backend contracts remain documented/tested normally and intentionally do not carry `GRIDCAP-*` comments.

## Documentation scope

Current implementation docs describe what the code supports now. They should not be used as a place to record rejected or hypothetical runtime options.

Planning belongs in [Grid foundation backlog](docs/grid-backlog.md). Configurable-table target architecture is kept in its clearly identified architecture/proposal documents.

## Current implementation references

Start with:

- [Project handoff / working contract](AGENTS.md) — durable engineering/workflow rules and current sequencing.
- [Grid capability tag registry](docs/grid-capability-tags.md) — frontend capability-discovery markers.
- [Grid capability catalog](docs/grid-capabilities.md) — current logical capabilities across Client, Infinite and SSRM.
- [Architecture](docs/architecture.md) — current repository/application boundaries.
- [AG Grid architecture](docs/ag-grid.md) — current native/shared/feature ownership.
- [AG Grid foundation status](docs/ag-grid-foundation-status.md) — current implementation snapshot.
- [AG Grid native usage reference](docs/ag-grid-native-usage.md) — native AG Grid runtime surface currently used.
- [API and data flow](docs/api-data-flow.md) — current Client and server-backed API flows.
- [Client-Side Row Model foundation](docs/client-side-grid.md) — current Client ownership and behavior.
- [Selected-row totals](docs/selection-counts.md) — current Infinite/SSRM dataset-wide selected-count contract.
- [Edited-row total](docs/edited-row-count.md) — current dirty-row count shared by all three row models.
- [Selected action lifecycle](docs/selected-action-selection-lifecycle.md) — current Change Status success/failure and row-model clear behavior.
- [Row interaction](docs/row-interaction.md) — current enabled/selection-disabled/read-only capability across all three row models.
- [Transaction editing](docs/transaction-editing.md) — current tracked editing and persistence behavior.
- [Unsaved edit conflict reconciliation](docs/edit-conflict-reconciliation.md) — current BASE/LOCAL/REMOTE state machine and guards.
- [Grid export](docs/grid-export.md) — current Current Page and Selected export behavior across all three row models.
- [Selection/edit/export index](docs/selection-edit-export.md) — navigation to the dedicated implementation references.
- [Theming and design tokens](docs/theming.md) — current styling/theme boundary.
- [Frontend conventions](docs/frontend-conventions.md) — frontend engineering conventions.
- [GitHub Actions CI](docs/github-actions-ci.md) — current CI workflow explanation.

## Planning / proposal references

- [Grid foundation backlog](docs/grid-backlog.md) — unfinished work, sequencing, verification and deferred decisions.
- [Configurable table architecture brief](docs/configurable-table-architecture-brief.md) — standalone target architecture.
- [Detailed metadata-driven table architecture](docs/metadata-driven-table-architecture.md) — detailed proposal/discussion material.

Manual testing guides remain verification checklists and do not imply that browser verification has already been completed.
