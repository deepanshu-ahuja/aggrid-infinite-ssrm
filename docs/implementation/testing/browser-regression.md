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
→ real Chromium + React/AG Grid + Django API together
→ rendering, interaction, network lifecycle and uncaught-browser-error checks
```

## What Playwright and Django each do

Playwright does **not** turn Django into Playwright and it does not run the Django backend inside the browser.

They are separate processes with separate responsibilities:

```text
Playwright TypeScript test runner
        ↓ controls
Chromium browser
        ↓ opens
React + AG Grid application from Vite
        ↓ HTTP API requests
Django REST API
        ↓ reads/writes
Transaction authoritative data
```

Django is simply the real backend used by the browser during an end-to-end test. Playwright drives Chromium and can also make normal HTTP requests to the Django API for test setup, such as the E2E data reset.

When this document says the backend is started in **E2E/Playwright test mode**, it means only this:

```text
E2E_TESTING=true
→ our Django setting enables the test-only Transaction reset endpoint
→ normal product behavior/API remains the same
```

`E2E_TESTING` is our environment flag, not a Playwright feature and not a standard Django mode.

## Technology and source layout

Browser tests use TypeScript and `@playwright/test` under `tests/browser/`.

Important ownership:

```text
playwright.config.ts
→ browser/project settings, retries, diagnostics, base URL, optional local slow motion

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
install frontend/backend/browser-test dependencies
install Chromium
        │
        ├── start Django :8000
        │      E2E_TESTING=true
        │      runserver --noreload
        │
        └── start Vite :5173
                │
                ▼
        npx playwright test
```

CI deliberately keeps the original `5173 → 8000` ports. The separate `5174 → 8001` pair described below is a local convenience so a developer can keep the normal development app running while Playwright uses its own isolated application processes.

### Why `E2E_TESTING=true`?

It enables only the default-off test-data reset endpoint used by the automatic Playwright fixture.

Without it, that endpoint returns 404.

### Why `--noreload`?

Normal Django development `runserver` watches Python files and may restart through its autoreloader. That is useful for development but unnecessary for E2E execution.

The Transaction demo source currently lives in one Python process as an in-memory list. `--noreload` gives the browser suite one unambiguous Django process owning that list:

```text
one Django process
→ one TRANSACTIONS list
→ reset fixture always resets that same authoritative list
```

It is a test-stability choice, not a Playwright requirement.

## Per-test data isolation

The Transaction API currently uses the module-level deterministic `TRANSACTIONS` list in `backend/apps/transactions/services.py`. It does not currently persist these rows in SQLite.

Without isolation:

```text
Test A
→ PATCH txn-00001 account = "E2E client"
→ Django TRANSACTIONS is mutated

Test B
→ same Django process
→ would inherit Test A's value
```

The automatic browser fixture prevents that:

```text
Playwright test/retry starts
        ↓
POST /api/transactions/__e2e__/reset/
        ↓
E2E_TESTING=false → 404
E2E_TESTING=true  → rebuild deterministic 750 rows
        ↓
run scenario from a known clean state
```

The reset route is test infrastructure, not a product API:

- `E2E_TESTING` defaults to `false`;
- normal local/production application mode cannot use it;
- browser CI enables it only for its dedicated backend process;
- every normal Playwright test and retry resets before user actions begin.

Current stable seed examples used by browser tests:

```text
txn-00001 → enabled, account Operating
txn-00002 → selectionDisabled
txn-00004 → readOnly
```

Use stable seeded identifiers rather than whichever rendered row happens to be first.

## Browser test flow

A normal real-grid test follows this chain:

```text
automatic reset succeeds
        ↓
page.goto(/client | /infinite | /ssrm)
        ↓
wait for authoritative API response
        ↓
wait for known seeded AG Grid RowNodes
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

Do not use positional assumptions such as "first editable row" or ambiguous `getByLabel(...).last()` selectors.

## Current Page readiness

Current Page operations are intentionally all-or-nothing. Infinite/SSRM can expose pagination before every expected RowNode is fully materialised.

The application therefore refuses a partial Current Page export/edit instead of silently operating on only loaded rows.

Browser tests should wait/poll the real action contract rather than add unexplained fixed sleeps.

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

Use those diagnostics to distinguish:

```text
product defect
vs
bad selector/test assumption
vs
shared test-state contamination
vs
row-model loading timing
```

Do not fix a browser failure by merely increasing timeouts before understanding the cause.

## Current database boundary

Django has SQLite configured, but current Transaction rows are not stored there.

```text
Django SQLite configuration
→ available framework database

Transaction grid authoritative demo rows
→ Python TRANSACTIONS list in process memory
```

The E2E reset abstraction hides that storage implementation from Playwright. The browser fixture asks only for "restore known E2E state".

## Future database-backed Transactions

When Transactions move to a real repository/database, keep the Playwright fixture contract and replace the backend implementation behind the reset boundary:

```text
browser test starts
→ reset dedicated E2E database
→ seed known rows
→ test through normal UI/API
```

Rules:

- never point Playwright at developer or production data;
- use a dedicated E2E/test database;
- migrate/seed known rows deterministically;
- reset per test when scenarios mutate shared authoritative data;
- keep stable seeded IDs where tests need known business-policy rows.

## Authentication and credentials

The current app has no authentication. Do not add fake credential code until authentication exists.

When authentication is introduced:

```text
CI E2E credentials from secret/environment store
        ↓
Playwright setup project logs in once
        ↓
save storageState
        ↓
normal browser specs reuse storageState
```

Use a dedicated test user and never hardcode real credentials.

## Coverage strategy

Playwright should cover high-value end-to-end contracts and real AG Grid/browser integration, not every logical permutation already proven by focused tests.

Good Playwright candidates include row-model loading/sort/filter/pagination integration, selection lifecycle, Save/Discard, selected actions/export, row eligibility, editors/validation, BASE/LOCAL/REMOTE conflicts, cache/store recreation, error/retry and uncaught renderer/formatter errors.

Keep combinatorial rule/state math and deterministic races in focused tests when a browser adds no useful evidence.

The readable current inventory is:

- `docs/implementation/testing/coverage-matrix.html`.

Open it locally for the intended styled view:

```bash
open docs/implementation/testing/coverage-matrix.html
```

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

### Recommended: keep the normal app running in parallel

The local E2E scripts use a separate port pair from the normal development app:

```text
normal development
React/Vite :5173 → Django :8000

Playwright E2E
React/Vite :5174 → Django :8001
```

This is important because the E2E Django process repeatedly resets its own in-memory Transaction data. Your normal Django process on `8000` remains separate and is not reset by Playwright.

First-time browser setup from the repository root:

```bash
npm run e2e:install
```

Keep your normal development React/Django processes running if you want. Then open two additional terminals for the E2E application.

Terminal A — dedicated E2E Django:

```bash
source .venv/bin/activate
npm run e2e:backend
```

This starts:

```text
Django :8001
E2E_TESTING=true
--noreload
```

Terminal B — dedicated E2E Vite:

```bash
npm run e2e:frontend
```

This starts:

```text
Vite :5174
/api proxy → http://127.0.0.1:8001
```

Terminal C — choose the Playwright mode that matches what you want to do.

### Fast automated run

```bash
npm run e2e:test
```

Headless and fast. This is closest to normal CI behavior.

### Visible but still fast

```bash
npm run e2e:headed
```

A Chromium window is visible and tests run one at a time, but Playwright still performs actions at machine speed.

### Visible and deliberately slow

```bash
npm run e2e:watch
```

This is the easiest mode when the goal is simply to **watch what the automated test is doing**. It runs headed, one worker at a time, and inserts roughly 700 ms of Playwright slow motion between operations.

Slow motion is only a local viewing aid. CI does not use it.

### Interactive Playwright UI

```bash
npm run e2e:ui
```

Use this to browse the test list, run one test, rerun failures and inspect the timeline. The test itself still runs quickly unless a slow-motion configuration is used.

### Debug an existing test step-by-step

```bash
npm run e2e:debug
```

Debug mode is for an **existing test**. Playwright Inspector opens and pauses execution. Use its Resume/Play control to continue normally or Step Over to advance through one Playwright action at a time. The locator picker can also show which element a locator points to.

Think of debug mode as:

```text
existing test code
→ pause
→ inspect current browser
→ step one action
→ inspect again
```

It is not the easiest tool for creating a brand-new flow from manual clicking. Use recording/codegen for that.

## Record a manual flow and generate Playwright code

Playwright Codegen is useful when a developer does not yet know Playwright syntax and wants to create a starting test by using the application normally.

Keep the dedicated E2E backend and frontend running, then reset the E2E data once before recording if the flow depends on known seed values:

```bash
npm run e2e:reset
```

Start the recorder:

```bash
npm run e2e:record
```

Two windows open:

```text
Chromium window
→ you click, type, select, edit and navigate normally

Playwright Inspector
→ generated Playwright test code appears as you perform those actions
```

The recorder can capture normal actions such as clicks and fills. Its toolbar can also generate basic visibility/text/value assertions.

When the flow is finished, stop recording and copy the generated code into the appropriate `tests/browser/*.spec.ts` file.

### Generated code is a starting point, not the final committed test

Codegen does not know all repository contracts. Before committing generated code:

1. import `test` / `expect` from `./fixtures`, not directly from `@playwright/test`, so the automatic per-test data reset remains active;
2. use stable seeded row IDs and durable role/test-id selectors rather than fragile positional AG Grid selectors;
3. add meaningful assertions for the business outcome, not only clicks;
4. wait for the real API/grid readiness condition where needed;
5. make the test independent of previous tests and recording-session mutations;
6. reuse `gridTestSupport.ts` helpers where they already express the correct readiness/row contract.

Codegen itself does not execute the normal `fixtures.ts` test fixture while you are interactively recording. That is why `npm run e2e:reset` is available before recording. Once the generated flow becomes a real spec using `./fixtures`, normal per-test reset happens automatically.

### Direct browser-package commands

The browser package also exposes convenience scripts:

```bash
cd tests/browser
npm run test:headed
npm run test:watch
npm run test:ui
npm run test:debug
npm run record
```

The root `npm run e2e:*` commands are preferred because they consistently target the separate local E2E application on `5174 → 8001`.

## Manual verification relationship

Human-readable manual checklists remain under `docs/implementation/testing/` even when an important scenario is automated.

Automation records repeatable regression coverage. Manual steps remain useful for exploratory review and behavior that is difficult or low-value to automate.

Never claim the entire manual checklist passed merely because the Playwright suite passed.
