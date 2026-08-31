# Grid Foundation Backlog

This is the living planning/control list for unfinished grid-foundation work.

Current implementation truth lives under `docs/implementation/`. This backlog contains sequencing, verification work and deferred decisions.

Useful current references:

- `docs/implementation/README.md` — current implementation documentation entry point;
- `docs/implementation/grid-capabilities.md` — implemented capability catalog;
- `docs/implementation/grid-capability-tags.md` — searchable frontend capability registry;
- `docs/implementation/grid-import.md` — current Transaction Import contract;
- `docs/implementation/row-models/client.md` — Client-Side implementation guide;
- `docs/implementation/row-models/infinite.md` — Infinite implementation guide;
- `docs/implementation/row-models/ssrm.md` — SSRM implementation guide;
- `docs/implementation/testing/browser-regression.md` — Playwright architecture, E2E reset, CI/local execution and next-capability handoff;
- `docs/implementation/testing/coverage-matrix.html` — readable cross-layer automated coverage inventory;
- `docs/implementation/testing/` — manual verification guides;
- `docs/configurable-feature-handoff.md` — current configurable-feature architecture handoff;
- `docs/configurable-feature-config-design-progress.md` — latest configurable design checkpoint and exact resume point.

Statuses used here: **VERIFY**, **DESIGN**, **TODO**, **PLANNED**, **DEFERRED**.

## Current agreed sequence

The existing Client/Infinite/SSRM Transaction capability foundation and regression-hardening work are complete enough to support the next architecture experiment. Transaction Import and the later mutable row-interaction fixes are merged history rather than active PR work.

PR #41 merged the consolidated configurable-feature architecture handoff to `main`. The detailed configuration-contract design is continuing separately on `configurable-feature-grid` without an open PR during this design phase.

Current sequence:

```text
1. Continue configurable-feature contract design on configurable-feature-grid
2. Settle broad SSRM/native grid-level configuration + defaults/merge/normalization/registry typing
3. Continue validation, server-query, save-mapping and access/security contracts
4. Build the isolated fourth configurable SSRM-based grid only after the contracts are sufficiently stable
5. Evaluate reuse/migration only after that experiment proves its boundary
```

Do not create another design branch or open/merge a PR unless explicitly requested by the user.

Do not keep expanding Playwright merely to increase test count. Add browser coverage when a new implemented capability or a concrete regression introduces a material real-browser/AG Grid/backend risk.

# Active backlog

## A. Ongoing verification / engineering rules

### A1. Client / Infinite / SSRM manual regression
**Status:** VERIFY

Automated coverage does not replace the broader human-readable browser checklists. When a manual browser pass is scheduled, verify row models independently.

Current guides include:

- `docs/implementation/testing/server-backed-manual-testing.md`
- `docs/implementation/testing/row-interaction-manual-testing.md`
- `docs/implementation/testing/validation-manual-testing.md`
- `docs/implementation/testing/import-manual-testing.md`
- Client-specific scenarios in `docs/implementation/row-models/client.md`

Do not mark manual verification complete unless those scenarios were actually run.

### A2. Selected-row totals
**Status:** VERIFY

Implemented contract:

```text
Client
→ exact native selected rows

Infinite / SSRM explicit/manual/current-page
→ exact include ID count

Infinite / SSRM All Filtered
→ filteredCount - user exceptions

Infinite / SSRM All Records
→ totalCount - user exceptions
```

Current server-wide limitation is intentional: `totalCount` / `filteredCount` describe query membership, not exact selection eligibility for unloaded rows.

Reference: `docs/implementation/selection-counts.md`.

### A3. Edited-row total
**Status:** VERIFY

`Edited` means dirty rows, not dirty cells. Multiple dirty fields in one row count as one edited row.

Reference: `docs/implementation/edited-row-count.md`.

### A4. Export
**Status:** VERIFY

Implemented ownership:

```text
Current Page
→ native AG Grid CSV over exact resolved pagination page

Selected Client
→ native/local selected CSV

Selected Infinite / SSRM
→ backend resolves logical selected target and writes CSV
```

Reference: `docs/implementation/grid-export.md`.

### A5. Request/lifecycle hardening
**Status:** VERIFY / ongoing engineering rule

Already protected by focused code/tests:

- request-start-order freshness;
- datasource cancellation;
- GridApi pre-destroy cleanup;
- destroyed-API guards;
- local-overlay versus genuinely fresh REMOTE distinction;
- programmatic-write guards.

Do not suppress AG Grid lifecycle warnings; fix concrete ownership/timing defects.

### A6. Validation + editing integration
**Status:** VERIFY

Implemented behavior includes registered frontend validation rules, stable row/field validation state, direct/programmatic edit integration, Row Save and exact Save Selected guards, backend field-error mapping, correction/Discard/conflict-resolution lifecycle and separation of validation from BASE/LOCAL/REMOTE conflicts.

References:

- `docs/implementation/grid-validation.md`
- `docs/implementation/transaction-editing.md`

### A7. Dynamic row-interaction transitions
**Status:** VERIFY / IMPLEMENTED

The mutable row-interaction regression discovered during Import/manual verification was fixed and merged. Authoritative writes can change backend-derived `interactionMode`; mutable `selectionDisabled` / `readOnly` presentation uses native `rowClassRules` so stale restricted classes are removed when a surviving RowNode becomes enabled.

Regression coverage exists across Import, single-row Save, Save Selected/bulk persistence and selected Change Status for the applicable row models.

References:

- `docs/implementation/row-interaction.md`
- `docs/implementation/testing/row-interaction-manual-testing.md`

## B. Capability discoverability

### B1. `GRIDCAP-*` registry and source markers
**Status:** VERIFY

`docs/implementation/grid-capability-tags.md` is authoritative for searchable frontend capability markers.

When a frontend capability footprint changes:

1. inspect its registry entry;
2. search current source/test occurrences;
3. update meaningful markers;
4. update focused tests and implementation docs.

## C. Deferred core/product decisions

### C1. Application/session unsaved-draft lifetime
**Status:** DEFERRED

Current stable-ID tracked edits survive row-object/RowNode recreation while the grid feature is alive.

Do not add route/session/browser-refresh draft persistence until the product requires a longer draft lifetime.

### C2. Backend optimistic concurrency / stale-write protection
**Status:** DEFERRED

Current BASE/LOCAL/REMOTE reconciliation detects divergence only after fresh authoritative data reaches the browser.

Backend version/ETag/revision protection requires a separate product/API contract if stale writes must be rejected even without an intervening refresh.

### C3. Undo/redo
**Status:** DEFERRED

Do not enable spreadsheet-style undo/redo until its interaction with tracked drafts, programmatic edits, conflicts, validation and Save/Discard is defined.

### C4. User/profile Grid State persistence
**Status:** DEFERRED

Current native Grid State persists supported preferences through the replaceable browser-storage boundary.

Backend/user-profile persistence is not part of the current implementation.

### C5. Grouping/tree/aggregation/pivot and other advanced AG Grid features
**Status:** DEFERRED

Current SSRM implementation is flat. Do not introduce advanced semantics without an explicit product contract.

## D. Import

### D1. Import workflow
**Status:** VERIFY / IMPLEMENTED

Current implemented contract:

- CSV only;
- update existing Transactions only;
- stable `id` target;
- editable fields `account`, `amount`, `currency`, `status`, `transactionDate`;
- mutation-free Preview;
- Apply revalidates and is all-or-nothing;
- backend persisted-field validation reuse;
- duplicate, unknown and read-only target errors;
- structured row/field error presentation;
- concrete Client/Infinite/SSRM authoritative refresh after Apply;
- existing LOCAL drafts remain separate and reconcile against imported REMOTE values normally.

Current deliberate non-goals:

- create/upsert;
- XLSX;
- configurable field mapping;
- partial success;
- downloadable error file;
- async progress/cancellation;
- backend optimistic concurrency/versioning.

References:

- `docs/implementation/grid-import.md`
- `docs/implementation/testing/import-manual-testing.md`

Do not hide Import inside ordinary cell-edit persistence.

## E. Isolated configurable SSRM experiment

### E1. Configuration contract and fourth grid path
**Status:** DESIGN

The configurable architecture is now actively being designed on `configurable-feature-grid`.

Current canonical design references:

- `docs/configurable-feature-handoff.md`;
- `docs/configurable-feature-config-design-progress.md`;
- `docs/configurable-feature/configuration-reference.md`;
- `docs/configurable-feature/type-hierarchy.md`;
- `frontend/src/shared/grid/configurable/configuration.types.ts`.

Current rules:

- first proof is SSRM-only;
- do not refactor `/client`, `/infinite` or `/ssrm` merely to make the experiment work;
- do not rewrite proven shared loading, selection, tracked editing, conflict, validation, freshness, lifecycle or Grid State mechanics while the composition boundary is still being proven;
- temporary feature-level duplication is acceptable when it protects proven behavior and makes comparison explicit;
- frontend authors/supports the configuration contract; backend may persist/manage and return it;
- raw backend/storage config is validated + normalized before compilation even when current names happen to match;
- native AG Grid names/types are preferred when semantics match;
- broad SSRM-relevant declarative configuration should not be artificially limited to today's demo properties;
- executable behavior is represented by JSON-safe keys/params and resolved by frontend registries only when genuinely configurable;
- registry implementations should use real AG Grid callback/component/property types where practical;
- runtime infrastructure such as the datasource/context/compiled columns remains frontend-owned;
- backend metadata does not dynamically select Client/Infinite/SSRM;
- evaluate migration/reuse only after the isolated path proves the boundary;
- migration is not automatic.

Exact next design batch is maintained in `docs/configurable-feature-config-design-progress.md`.

## F. Reuse proof

### F1. Second real business entity
**Status:** TODO when available

A real second table should prove domain neutrality of the shared mechanics.

Do not invent a fake business feature merely to manufacture reuse.

# Completed history

## 2026-08 — Existing-capability regression hardening

Completed the audit/hardening phase before the configurable architecture work:

- deterministic per-test Playwright Transaction reset;
- stable seeded IDs, selectors and authoritative readiness helpers;
- compact coverage matrix;
- broad high-value Client / Infinite / SSRM browser regression coverage;
- focused frontend/backend tests kept at deterministic boundaries instead of duplicating every permutation in Playwright;
- durable Playwright/AGENTS testing rules;
- an implementation browser run passed 80/80 Playwright scenarios in real Chromium alongside frontend/backend checks at that checkpoint.

Reference: `docs/implementation/testing/browser-regression.md`.

## 2026-08 — Three row-model baseline

Client-Side, Infinite and flat SSRM exist as separate concrete routes with native-first loading/selection ownership and focused automated coverage.

## 2026-08 — Row interaction

Implemented `enabled | selectionDisabled | readOnly`, native loaded-row guards, backend authority for server-wide operations, editing integration and dynamic presentation.

Reference: `docs/implementation/row-interaction.md`.

## 2026-08 — Tracked editing and persistence

Implemented stable-ID dirty tracking, row Save/Discard, selected dirty Save/Discard, separate single/bulk writes and safe in-flight acknowledgement.

Reference: `docs/implementation/transaction-editing.md`.

## 2026-08 — BASE / LOCAL / REMOTE conflicts

Implemented unchanged/converged/divergent reconciliation, `Use server`, `Keep my edit`, conflict-aware guards and Discard-to-latest-REMOTE.

Reference: `docs/implementation/edit-conflict-reconciliation.md`.

## 2026-08 — Field/input validation

Implemented registered JSON-safe validation rules, stable row/field validation state, direct/programmatic edit integration, Row Save and exact Save Selected guards, backend DRF field-error mapping, correction/Discard/conflict-resolution lifecycle and coexistence with BASE/LOCAL/REMOTE conflict state.

References:

- `docs/implementation/grid-validation.md`
- `docs/implementation/transaction-editing.md`

## 2026-08 — Selected Change Status lifecycle

The Change Status mutation carries only the business request. After backend success, each concrete grid root calls its own selection controller's existing `clearSelection()` and refreshes authoritative data. Failed requests retain selection.

There is no current configurable `clear | preserve` runtime policy.

Reference: `docs/implementation/selected-action-selection-lifecycle.md`.

## 2026-08 — CI and lifecycle hardening

CI runs frontend lint/typecheck/tests/build plus backend Django checks/tests without Docker. GridApi teardown, datasource cancellation and request freshness have focused regression coverage.

# Explicit non-goals unless requirements change

- universal `AgGridReact` wrapper;
- giant generic `useGrid()` hiding native AG Grid;
- one fake shared selection controller for all row models;
- one `clearSelection(rowModelType)` switch;
- configurable `clear | preserve` policy for a hardcoded action whose behavior is known;
- one generic mutation that chooses unrelated business endpoints from an action key;
- server datasource mechanics in Client-Side;
- duplicate backend interpretations of logical selection;
- custom abstractions duplicating native AG Grid without a real semantic gap;
- backend metadata dynamically choosing Client/Infinite/SSRM;
- refactoring proven grids merely to support the isolated configurable-grid experiment;
- Docker for this same-repository Databricks App without a real requirement;
- speculative advanced SSRM/grouping/pivot/aggregation behavior;
- excessive `GRIDCAP-*` markers on trivial code.

> **Standing rule: native AG Grid first; use the best capability of the actual row model; share only genuine semantics/mechanics; keep business rules feature/backend-owned.**
