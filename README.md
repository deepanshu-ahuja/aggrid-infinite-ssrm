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

`frontend/src/features/transactions/transactionsGrid.config.ts` keeps row-model-specific static choices such as Client/Infinite selection scope and native grid options. Client-Side, Infinite and SSRM lifecycle/selection implementations remain separate rather than being hidden behind one universal wrapper.

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

Manual browser verification may be performed later as a consolidated pass. Use the row-model and testing links in the [current implementation documentation](docs/implementation/README.md). Do not mark manual verification complete unless the browser scenarios were actually run.

## Databricks Apps

The root `package.json` build script produces `frontend/dist`. Databricks installs root Node and Python dependencies, runs the frontend build, and starts the Django WSGI application using `app.yaml`. Django and WhiteNoise serve the built SPA and hashed assets from the same process.

Configure `DJANGO_SECRET_KEY` and the AG Grid license key through Databricks App resources or environment configuration rather than committing them. The supplied `app.yaml` contains only non-secret runtime settings.

## Continuing in a new chat or coding-agent session

Read [AGENTS.md](AGENTS.md) **first**. It is the repository-owned developer/AI working contract for architecture, documentation scope, capability discovery, testing, Git/PR workflow and roadmap sequencing.

Then open [Current Grid Implementation Documentation](docs/implementation/README.md). That directory is the canonical home for behavior implemented by the repository now.

If you are interested in only one row model, start with:

- [Client-Side Row Model](docs/implementation/row-models/client.md)
- [Infinite Row Model](docs/implementation/row-models/infinite.md)
- [Server-Side Row Model (SSRM)](docs/implementation/row-models/ssrm.md)

If you are changing or extracting one frontend grid capability, use the [Grid capability tag registry](docs/implementation/grid-capability-tags.md): find the relevant `GRIDCAP-*` marker, read its row-model notes, then inspect that marker across frontend source and focused frontend tests. Backend contracts remain documented/tested normally and intentionally do not carry `GRIDCAP-*` comments.

## Documentation scope

Documentation is intentionally separated by purpose:

```text
docs/implementation/
→ implemented runtime behavior only

row-models/
→ Client / Infinite / SSRM focused entry points

shared implementation docs
→ capabilities that span row models, with differences called out explicitly

docs/grid-backlog.md
→ unfinished/planned work

configurable / metadata architecture documents
→ target or exploratory architecture, not current runtime claims
```

If a current implementation document says a configuration/API/capability exists, the code must actually support it. Rejected approaches, hypothetical options and conversation history do not belong in the current implementation area.

## Current implementation references

Start with [docs/implementation/README.md](docs/implementation/README.md). Important direct references include:

- [Grid capability catalog](docs/implementation/grid-capabilities.md)
- [Capability tag registry](docs/implementation/grid-capability-tags.md)
- [Application architecture](docs/implementation/architecture.md)
- [AG Grid architecture](docs/implementation/ag-grid.md)
- [AG Grid native usage](docs/implementation/ag-grid-native-usage.md)
- [API and data flow](docs/implementation/api-data-flow.md)
- [Selected-row totals](docs/implementation/selection-counts.md)
- [Selected action lifecycle](docs/implementation/selected-action-selection-lifecycle.md)
- [Row interaction](docs/implementation/row-interaction.md)
- [Transaction editing](docs/implementation/transaction-editing.md)
- [Edit conflict reconciliation](docs/implementation/edit-conflict-reconciliation.md)
- [Grid export](docs/implementation/grid-export.md)

## Planning / proposal references

- [Grid foundation backlog](docs/grid-backlog.md) — unfinished work, sequencing, verification and deferred decisions.
- [Configurable table architecture brief](docs/configurable-table-architecture-brief.md) — standalone target architecture.
- [Detailed metadata-driven table architecture](docs/metadata-driven-table-architecture.md) — detailed proposal/discussion material.
- [Metadata-driven UI overview](docs/metadata-driven-ui-overview.md) — supporting proposal material.
