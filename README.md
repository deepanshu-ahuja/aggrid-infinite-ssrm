# Databricks Grid App

A greenfield React 19 and Django REST Framework application for Databricks Apps. The example transaction feature uses AG Grid Infinite Row Model by default and includes a deliberately small, flat SSRM trial path.

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

The feature-level `frontend/src/features/transactions/transactionsGrid.config.ts` chooses which separate table is rendered (`infinite` or `ssrm`). Infinite header-selection scope (`page`, `filtered` or `all`) and pagination/cache props are configured independently from SSRM. These client/product choices are intentionally not exposed as demo toggles in the application UI.

## Verification

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
source .venv/bin/activate
python backend/manage.py test apps.transactions
```

## Databricks Apps

The root `package.json` build script produces `frontend/dist`. Databricks installs root Node and Python dependencies, runs the frontend build, and starts the Django WSGI application using `app.yaml`. Django and WhiteNoise serve the built SPA and hashed assets from the same process.

Configure `DJANGO_SECRET_KEY` and the AG Grid license key through Databricks App resources or environment configuration rather than committing them. The supplied `app.yaml` contains only non-secret runtime settings.

## Project documentation

- [Architecture](docs/architecture.md)
- [Frontend conventions](docs/frontend-conventions.md)
- [Theming and design tokens](docs/theming.md)
- [Reusable server-backed grid guide](docs/server-backed-grid-reuse.md)
- [AG Grid architecture](docs/ag-grid.md)
- [AG Grid foundation status](docs/ag-grid-foundation-status.md)
- [Transaction editing](docs/transaction-editing.md)
- [API and data flow](docs/api-data-flow.md)
