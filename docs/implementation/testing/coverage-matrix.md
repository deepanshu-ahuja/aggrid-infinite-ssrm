# Grid regression coverage matrix

## Purpose

This file is the **quick coverage map** for the implemented grid application.

Open this document when you want to answer, at a glance:

```text
Is this capability protected by focused tests?
Is there backend/API coverage where applicable?
Does the real browser cover Client, Infinite and/or SSRM?
```

Detailed test architecture and execution flow live in [`browser-regression.md`](browser-regression.md). This file intentionally stays compact.

## Legend

| Mark | Meaning |
| --- | --- |
| ✅ | meaningful automated coverage exists and the current browser scenario has passed CI where this is a Playwright column |
| F | intentionally covered at focused unit/state/component level rather than duplicated in Playwright |
| — | not applicable or not enabled on that current demo route |

Column abbreviations:

- **FE** = focused frontend/state/component tests
- **BE** = backend/API tests
- **C** = Client-Side grid Playwright
- **I** = Infinite grid Playwright
- **S** = SSRM grid Playwright

## Current verification snapshot

The latest verified application head before this documentation-only cleanup passed:

```text
Frontend lint/typecheck/tests/build  ✅
Backend Django checks/tests          ✅
Playwright Chromium                  ✅ 80 / 80
Client grid browser coverage         ✅
Infinite grid browser coverage       ✅
SSRM grid browser coverage           ✅
```

## Core grid and row-model behavior

| Capability | FE | BE | C | I | S |
| --- | :-: | :-: | :-: | :-: | :-: |
| Initial grid load + real API | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pagination / 25-row page boundary | ✅ | — | ✅ | ✅ | ✅ |
| Server sort + filter request mapping | ✅ | ✅ | — | ✅ | ✅ |
| Request freshness / stale-response guard | ✅ | — | F | F | F |
| Datasource cancellation / destroyed-grid guards | ✅ | — | F | F | F |
| Server load error + Retry | ✅ | ✅ | — | ✅ | ✅ |
| Grid State persistence | ✅ | — | ✅ | ✅ | ✅ |
| Invalid Currency/Date formatter safety | ✅ | — | ✅ | ✅ | ✅ |

## Selection, actions and export

| Capability | FE | BE | C | I | S |
| --- | :-: | :-: | :-: | :-: | :-: |
| Explicit select / deselect + count | ✅ | ✅ | ✅ | ✅ | ✅ |
| Current Page selection | ✅ | ✅ | — | ✅ | ✅ |
| Select All Records | ✅ | ✅ | ✅ | — | ✅ |
| Select All Filtered | ✅ | ✅ | — | — | ✅ |
| Filter-change selection lifecycle | ✅ | ✅ | — | F | ✅ |
| `selectionDisabled` / `readOnly` policy | ✅ | ✅ | ✅ | ✅ | ✅ |
| Selected Change Status success | ✅ | ✅ | ✅ | ✅ | ✅ |
| Selected Change Status failure keeps selection | ✅ | ✅ | ✅ | ✅ | ✅ |
| Export Current Page | ✅ | — | ✅ | ✅ | ✅ |
| Export Selected explicit rows | ✅ | ✅ | ✅ | ✅ | ✅ |

## Editing and persistence

| Capability | FE | BE | C | I | S |
| --- | :-: | :-: | :-: | :-: | :-: |
| Direct cell editing | ✅ | ✅ | ✅ | ✅ | ✅ |
| MUI Account cell editor | ✅ | ✅ | ✅ | ✅ | ✅ |
| Transaction Date editor + validation | ✅ | ✅ | ✅ | ✅ | ✅ |
| Flow 1 — replay last edit to page | ✅ | — | ✅ | ✅ | ✅ |
| Flow 2 — checked-field page edit | ✅ | — | ✅ | ✅ | ✅ |
| Dirty-row count | ✅ | — | ✅ | ✅ | ✅ |
| Row Save | ✅ | ✅ | ✅ | ✅ | ✅ |
| Row Discard | ✅ | — | ✅ | ✅ | ✅ |
| Save Selected exact `dirty ∩ selection` | ✅ | ✅ | ✅ | ✅ | ✅ |
| Discard Selected exact target | ✅ | — | ✅ | ✅ | ✅ |
| Safe in-flight acknowledgement state machine | ✅ | ✅ | F | F | F |

## Validation, conflict and row recreation

| Capability | FE | BE | C | I | S |
| --- | :-: | :-: | :-: | :-: | :-: |
| Validation rules + Save guards | ✅ | ✅ | ✅ | ✅ | ✅ |
| Validation correction + BASE revert | ✅ | — | ✅ | ✅ | ✅ |
| Backend validation rejection remains LOCAL | ✅ | ✅ | ✅ | ✅ | ✅ |
| BASE / LOCAL / REMOTE conflict creation | ✅ | — | ✅ | ✅ | ✅ |
| Conflict — Use server | ✅ | — | ✅ | ✅ | ✅ |
| Conflict — Keep my edit | ✅ | — | ✅ | ✅ | ✅ |
| Validation + conflict coexistence | ✅ | — | ✅ | ✅ | ✅ |
| Unsaved LOCAL survives authoritative refresh | ✅ | — | ✅ | ✅ | ✅ |
| LOCAL survives Infinite cache eviction | ✅ | — | — | ✅ | — |
| LOCAL survives SSRM store refresh | ✅ | — | — | — | ✅ |

## Why some browser cells are `F` or `—`

A blank-looking browser column does **not automatically mean missing testing**.

### Focused tests are intentionally stronger for some behavior

These stay deterministic in focused tests instead of being recreated as timing-sensitive browser races:

- request-start-order freshness;
- cancellation and destroyed-GridApi guards;
- safe in-flight acknowledgement state-machine permutations.

### Current demo routes do not enable every possible selection configuration

The actual browser routes are tested as they are configured today:

```text
/client
→ native Client selection behavior

/infinite
→ Current Page selection configuration

/ssrm
→ Current Page + All Filtered + All Records behavior
```

Infinite also has alternate All Filtered / All Records controller logic covered by focused tests. We do **not** create fake E2E-only product routes just to turn those cells into browser checkmarks.

## Still intentionally outside this matrix

- The broader human/manual exploratory checklists remain separate from automated coverage.
- Backend stale-write/concurrency/versioning is still a deferred product contract; do not infer that the current test suite implements that future concurrency design.
- A future DB-backed Transaction source will keep the same browser reset contract but seed/reset an isolated E2E database instead of the current in-process Python data.

## Maintenance rule

When a capability changes:

1. update its focused frontend/backend tests where applicable;
2. update Playwright when the change materially affects real React + AG Grid + browser/network behavior;
3. update the relevant row in this file;
4. update manual verification steps when browser-visible behavior changes;
5. never mark a Playwright cell ✅ until that scenario has actually passed CI.
