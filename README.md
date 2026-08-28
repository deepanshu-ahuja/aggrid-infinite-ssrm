# Databricks Grid App

A greenfield React 19 and Django REST Framework application for Databricks Apps. The example transaction feature contains separate AG Grid Infinite Row Model and flat Server-Side Row Model (SSRM) implementations.

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

Vite serves the frontend and proxies `/api` to Django. Set `VITE_AG_GRID_LICENSE_KEY` in `.env` to remove the Enterprise trial watermark while evaluating SSRM. Infinite Row Model does not require an Enterprise license.

The app exposes both real row-model roots directly:

```text
/infinite
/ssrm
```

`frontend/src/features/transactions/transactionsGrid.config.ts` keeps row-model-specific configuration such as Infinite selection scope (`page`, `filtered`, or `all`) and grid options. Infinite and SSRM lifecycle/selection implementations remain separate rather than being hidden behind one universal wrapper.

## Verification

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
source .venv/bin/activate
python backend/manage.py test apps.transactions
```

Pull requests also run these checks in GitHub Actions. See [GitHub Actions CI](docs/github-actions-ci.md) for a developer-oriented explanation of the workflow syntax, commands, and how to diagnose failures.

For browser verification of the current server-backed baseline, use [Pre-Client manual testing](docs/pre-client-manual-testing.md).

## Databricks Apps

The root `package.json` build script produces `frontend/dist`. Databricks installs root Node and Python dependencies, runs the frontend build, and starts the Django WSGI application using `app.yaml`. Django and WhiteNoise serve the built SPA and hashed assets from the same process.

Configure `DJANGO_SECRET_KEY` and the AG Grid license key through Databricks App resources or environment configuration rather than committing them. The supplied `app.yaml` contains only non-secret runtime settings.

## Continuing in a new chat or coding-agent session

Read [AGENTS.md](AGENTS.md) **first**. It is the repository-owned project handoff and AI/developer working contract: architecture rules, comment-preservation standard, current server-grid semantics, testing/documentation expectations, Git/PR workflow, key source files, and the bootstrap instruction for a new chat.

`AGENTS.md` is intentionally maintained in the repository so continuation does not depend on access to an earlier ChatGPT/Codex conversation. When architecture, capability contracts, workflow rules, or roadmap sequencing change, review and update that file in the same work.

## Project documentation

Start with these grid-foundation entry points:

- [Project handoff / working contract](AGENTS.md) — read first when starting a new developer or coding-agent session; points to the live sources of truth and records durable project rules.
- [Grid foundation backlog](docs/grid-backlog.md) — the single living TODO/control list for unfinished capabilities, risks, verification work, and deferred decisions.
- [Grid capability catalog](docs/grid-capabilities.md) — what the current grid foundation can do logically, independent of one UI flow.
- [AG Grid native usage reference](docs/ag-grid-native-usage.md) — which native AG Grid props, APIs, RowNode methods, events, state and modules the project currently relies on.
- [Selected-row totals](docs/selection-counts.md) — exact/manual counts, All Filtered/All Records formulas, API `totalCount` / `filteredCount`, Infinite versus SSRM ownership, stale-response handling, and future eligibility-aware counts.
- [Edited-row total](docs/edited-row-count.md) — dirty-row semantics and tracked-edit ownership.
- [Grid export](docs/grid-export.md) — why export exists, native Current Page export, backend Selected export, common logical selection target, and future export options.
- [Pre-Client manual testing](docs/pre-client-manual-testing.md) — step-by-step Infinite + SSRM browser verification for selection counts, edited totals, export and existing edit/conflict regression.
- [GitHub Actions CI](docs/github-actions-ci.md) — what the repository workflow does and how to read a failed run.

Then use the detailed source-of-truth documents for implementation and edge cases:

- [Architecture](docs/architecture.md)
- [Frontend conventions](docs/frontend-conventions.md)
- [Theming and design tokens](docs/theming.md)
- [Reusable server-backed grid guide](docs/server-backed-grid-reuse.md)
- [Server-backed row interaction policy](docs/row-interaction.md)
- [Row interaction implementation and manual testing](docs/row-interaction-manual-testing.md)
- [AG Grid architecture](docs/ag-grid.md)
- [AG Grid foundation status](docs/ag-grid-foundation-status.md)
- [Transaction editing](docs/transaction-editing.md)
- [Unsaved edit conflict reconciliation and manual testing](docs/edit-conflict-reconciliation.md)
- [API and data flow](docs/api-data-flow.md)

The legacy [combined selection/edit/export index](docs/selection-edit-export.md) remains only as a navigation page to the dedicated guides above.
