# Browser regression architecture

## Purpose

Browser regression is the final integration layer for behavior that only becomes trustworthy when the real application, real AG Grid DOM and real backend API run together.

It complements rather than replaces focused unit/state/component tests.

```text
pure/state tests
→ rules, transforms, BASE/LOCAL/REMOTE, selection math

component/integration tests
→ React wiring, callbacks, request mapping, save guards

TypeScript Playwright
→ real Django + Vite + Chromium + AG Grid DOM
→ rendering, interaction, network lifecycle and uncaught-browser-error checks
```

## Technology

Browser tests use TypeScript and `@playwright/test` under:

```text
tests/browser/
```

This matches the React/TypeScript frontend stack and gives the suite normal Playwright fixtures, assertions, traces, screenshots, videos and future authentication setup.

The temporary Python Playwright runner used to prove the first validation regression has been removed.

## CI lifecycle

GitHub Actions checks out the exact PR commit, then:

```text
install root frontend dependencies
install backend Python dependencies
install tests/browser Playwright dependencies
install Chromium
        │
        ├── start Django :8000
        └── start Vite   :5173
                │
                ▼
        npx playwright test
```

A browser test must fail on relevant uncaught `pageerror` events. A visually highlighted cell is not sufficient proof when a formatter/renderer can still throw or an adjacent field can receive the wrong state.

## Current test data

Django has SQLite configured, but the current Transactions feature does **not** read/write its Transaction rows from SQLite.

Current authoritative Transaction demo data is the deterministic in-memory `TRANSACTIONS` collection in:

```text
backend/apps/transactions/services.py
```

Therefore each CI browser job gets a fresh deterministic Transaction dataset when its Django process starts.

This is currently desirable for repeatable E2E tests:

```text
new CI job
→ new backend process
→ deterministic _build_transactions()
→ known browser-test data
```

## Future database-backed Transactions

When Transactions moves to a real repository/database, browser tests must use a dedicated E2E/test database rather than developer or production data.

Expected contract:

```text
browser test run starts
→ create/reset isolated E2E database
→ run deterministic seed/fixture
→ start backend against that database
→ run Playwright
→ destroy/reset test state
```

Tests should prefer stable seeded identifiers/data over depending on whatever rows happen to exist in another environment.

## Authentication and credentials

The current app has no authentication:

```text
DRF authentication classes = []
permission = AllowAny
```

Do not add fake login/credential code until authentication actually exists.

When authentication is introduced, use standard Playwright one-time authenticated state:

```text
CI/test credentials from environment or secret store
        │
        ▼
Playwright setup project logs in once
        │
        ▼
save storageState
        │
        ▼
normal browser projects/specs reuse storageState
```

Rules:

- do not hardcode real credentials in repository files;
- use dedicated test users/credentials;
- read secrets from environment/CI secret management;
- login once per test run where practical, not once per test;
- never reuse production browser/session state;
- invalidate/regenerate stored auth state when authentication semantics require it.

## Coverage strategy

Browser tests should target high-value integration contracts rather than duplicate every unit assertion.

Current/near-term critical paths include:

- Client, Infinite and SSRM load without uncaught browser exceptions;
- direct editing, Row Save and Discard;
- Flow 1 / Flow 2 programmatic editing;
- invalid LOCAL validation and exact field messaging;
- validation rendering must not overlap adjacent cells;
- MUI custom editor integration;
- date picker editing;
- explicit selection and selected actions;
- selected Save/Discard target semantics;
- row interaction (`enabled`, `selectionDisabled`, `readOnly`);
- current-page and selected export;
- conflict reconciliation and server-backed row recreation;
- pagination/filter/sort lifecycle where row-model mechanics differ.

A browser test should assert the contract that matters: state visible to the user, enabled/disabled actions, request/response behavior, correct row/field targeting, and absence of uncaught browser failures.

## Manual verification relationship

Human-readable manual checklists remain under `docs/implementation/testing/` even when an important scenario is automated.

Automation records repeatable regression coverage. Manual steps remain useful for exploratory review and behavior that is difficult or low-value to automate.

Never claim the entire manual checklist passed merely because a narrower Playwright suite passed.
