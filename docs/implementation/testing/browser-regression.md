# Browser regression architecture

## Purpose

Browser regression is the final integration layer for behavior that only becomes trustworthy when the real application, real AG Grid DOM and real backend API run together.

It complements rather than replaces focused unit/state/component/backend tests.

```text
pure/state tests
→ algorithms, transforms, validation rules, BASE/LOCAL/REMOTE, selection math

component/integration tests
→ React wiring, callbacks, request mapping, save guards

backend tests
→ serializers, authoritative row policy, selected-target resolution, API errors

TypeScript Playwright
→ real Django + Vite + Chromium + AG Grid DOM
→ rendering, interaction, network lifecycle and uncaught-browser-error checks
```

## Technology and source layout

Browser tests use TypeScript and `@playwright/test` under:

```text
tests/browser/
├── package.json
├── playwright.config.ts
├── fixtures.ts
├── gridTestSupport.ts
├── baseline.spec.ts
└── validation.spec.ts
```

Important ownership:

```text
playwright.config.ts
→ browser/project settings, retries, diagnostics, base URL

fixtures.ts
→ mandatory automatic per-test E2E data reset

gridTestSupport.ts
→ stable seeded row IDs, editor locators, real-grid readiness helpers

*.spec.ts
→ capability/user-flow assertions
```

Specs must import `test` / `expect` from `./fixtures`, not directly from `@playwright/test`, so the automatic data-isolation fixture cannot be accidentally bypassed.

## CI lifecycle

GitHub Actions checks out the exact PR merge candidate, then:

```text
install root frontend dependencies
install backend Python dependencies
install tests/browser Playwright dependencies
install Chromium
        │
        ├── start one Django process :8000
        │      E2E_TESTING=true
        │      runserver --noreload
        │
        └── start Vite :5173
                │
                ▼
        npx playwright test
```

`--noreload` is deliberate. Browser regression needs one clear Django process owning one in-memory authoritative Transaction dataset; the development autoreloader would otherwise create a parent/child process boundary that adds unnecessary ambiguity to test-data ownership.

## Per-test data isolation

The Transaction API currently uses the module-level deterministic `TRANSACTIONS` list in `backend/apps/transactions/services.py`. It does not currently persist these rows in SQLite.

One Playwright job keeps one Django process alive for the suite. Without isolation this is order-dependent:

```text
Test A
→ PATCH txn-00001 account = "E2E client"
→ Django TRANSACTIONS is mutated

Test B
→ same Django process
→ unexpectedly starts with account = "E2E client"
```

The browser base fixture prevents that:

```text
Playwright test starts / retry starts
        │
        ▼
fixtures.ts automatic fixture
        │
        ▼
POST /api/transactions/__e2e__/reset/
        │
        ▼
TransactionE2EResetView
        │
        ├── E2E_TESTING false → 404
        │
        └── E2E_TESTING true
                │
                ▼
reset_transaction_demo_data()
                │
                ▼
clear current TRANSACTIONS
+ rebuild deterministic 750 rows
        │
        ▼
run browser scenario against clean data
```

The reset route is test infrastructure, not a product API:

- `E2E_TESTING` defaults to `false`;
- normal local/production application mode returns 404;
- browser CI explicitly enables the flag only for its dedicated backend process;
- every Playwright test and retry resets before user actions begin.

Current stable seed examples used by browser tests:

```text
txn-00001 → enabled, account Operating
txn-00002 → selectionDisabled
txn-00004 → readOnly
```

Use stable seeded identifiers rather than whichever rendered row happens to be first.

## Browser test flow

A normal real-grid test should follow this chain:

```text
automatic reset succeeds
        ↓
page.goto(/client | /infinite | /ssrm)
        ↓
wait for the row-model's first authoritative API response
        ↓
wait for known seeded AG Grid RowNodes by stable row-id
        ↓
perform user interaction
        ↓
assert visible state + relevant request/response
        ↓
assert correct row/field targeting
        ↓
assert no uncaught page errors
```

Waiting for merely `.ag-row` is too weak for server-backed models because a transient/loading RowNode can exist before the required business row is materialised.

## Selector rules

Prefer selectors that represent durable product/test contracts:

1. stable AG Grid row ID for a known seeded row;
2. semantic role/name when it identifies one unique user control;
3. explicit `data-testid` for custom editor internals when accessible names are intentionally duplicated elsewhere in the feature.

Examples:

```text
.ag-row[row-id="txn-00001"]
→ stable business row

getByRole('button', { name: 'Save' })
→ user-visible action

transaction-account-editor-input
→ custom MUI Account cell-editor input
```

Do not write selectors such as "first editable row" or `getByLabel('Account').last()` when another Account checkbox/input can legitimately exist. Those tests can pass against the wrong control and become flaky when layout changes.

## Current Page readiness

Current Page operations are intentionally all-or-nothing. Infinite/SSRM can expose pagination before every expected RowNode is fully materialised.

The application therefore refuses a partial Current Page export/edit instead of silently operating on only loaded rows.

Browser tests should wait/poll the real action contract rather than add unexplained fixed sleeps. A temporary "current page is still loading" result is not a reason to weaken the production all-or-nothing guard.

## Failure diagnostics

CI retains diagnostics for browser failures:

```text
trace
screenshot
video
Playwright HTML report
Django log
Vite log
```

Use the trace/network timeline to distinguish:

```text
product defect
vs
bad selector/test assumption
vs
shared test-state contamination
vs
row-model loading timing
```

Do not "fix" a browser failure by increasing timeouts until the underlying category is understood.

## Current database boundary

Django has SQLite configured, but current Transaction rows are not stored there.

```text
Django SQLite configuration
→ available framework database

Transaction grid authoritative demo rows
→ Python TRANSACTIONS list in process memory
```

The E2E reset abstraction deliberately hides that implementation detail from Playwright. The browser suite asks only for "restore known E2E state".

## Future database-backed Transactions

When Transactions move to a real repository/database, keep the Playwright fixture contract and replace the backend implementation behind the reset boundary:

```text
browser test starts
→ reset dedicated E2E database
→ run deterministic seed/fixture
→ test through normal UI/API
```

Rules:

- never point Playwright at developer or production data;
- use a dedicated E2E/test database;
- migrate/seed known rows deterministically;
- reset per test when scenarios mutate shared authoritative data;
- keep stable seeded IDs where tests need known business-policy rows.

## Authentication and credentials

The current app has no authentication:

```text
DRF authentication classes = []
permission = AllowAny
```

Do not add fake credential code until authentication exists.

When authentication is introduced:

```text
CI E2E credentials from secret/environment store
        ↓
Playwright setup project logs in once
        ↓
save storageState
        ↓
normal browser projects/specs reuse storageState
```

Rules:

- dedicated test user only;
- credentials from CI/environment secrets, never source control;
- login once per run where practical, not once per test;
- never reuse a production browser/session state;
- data reset and authentication setup remain separate concerns.

## Coverage strategy

Playwright should cover high-value end-to-end contracts and real AG Grid/browser integration, not every logical permutation already proven by focused tests.

Good Playwright candidates include:

- row-model loading/sort/filter/pagination integration;
- selection scopes and lifecycle visible to users;
- Save/Discard and selected Save/Discard wiring;
- logical selected actions and export;
- row eligibility;
- editor integration and validation presentation;
- BASE/LOCAL/REMOTE conflict presentation/resolution;
- Infinite cache / SSRM store recreation with LOCAL work;
- error/retry and request lifecycle where the browser adds evidence;
- uncaught renderer/formatter exceptions.

Keep combinatorial rule/state math in unit/state tests.

The current cross-layer inventory is tracked in:

- `docs/implementation/testing/coverage-matrix.md`.

## Adding or changing a feature

For every meaningful browser-visible or AG Grid lifecycle capability:

```text
inspect existing focused tests
        ↓
implement/change feature
        ↓
add/update pure/component/backend tests as applicable
        ↓
add/update Playwright when real browser/grid integration is material
        ↓
update manual verification steps
        ↓
update coverage matrix
        ↓
run CI and report only actually executed coverage as passed
```

A new browser spec must use the repository fixture so its starting data does not depend on prior specs.

## Local execution

Install once as needed:

```bash
npm ci
python -m pip install -r requirements.txt
cd tests/browser && npm install
npx playwright install chromium
```

Start the dedicated E2E backend in one terminal:

```bash
E2E_TESTING=true python backend/manage.py runserver 127.0.0.1:8000 --noreload
```

Start Vite in another:

```bash
npm run dev -- --host 127.0.0.1
```

Run the browser suite:

```bash
cd tests/browser
npx playwright test
```

Normal development/manual Django startup should not set `E2E_TESTING=true` unless the developer intentionally wants the reset endpoint for an E2E run.

## Manual verification relationship

Human-readable manual checklists remain under `docs/implementation/testing/` even when an important scenario is automated.

Automation records repeatable regression coverage. Manual steps remain useful for exploratory review and behavior that is difficult or low-value to automate.

Never claim the entire manual checklist passed merely because a narrower Playwright suite passed.
