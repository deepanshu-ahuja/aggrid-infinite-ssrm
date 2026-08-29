# Grid Foundation Backlog

This is the living planning/control list for unfinished grid-foundation work.

Current implementation truth lives under `docs/implementation/`. This backlog contains sequencing, verification work and deferred decisions.

Useful current references:

- `docs/implementation/README.md` — current implementation documentation entry point;
- `docs/implementation/grid-capabilities.md` — implemented capability catalog;
- `docs/implementation/grid-capability-tags.md` — searchable frontend capability registry;
- `docs/implementation/grid-import.md` — current Transaction Import contract;
- `docs/implementation/configurable-ssrm-experiment.md` — current isolated configurable SSRM boundary experiment;
- `docs/implementation/row-models/client.md` — Client-Side implementation guide;
- `docs/implementation/row-models/infinite.md` — Infinite implementation guide;
- `docs/implementation/row-models/ssrm.md` — SSRM implementation guide;
- `docs/implementation/testing/browser-regression.md` — Playwright architecture, E2E reset, CI/local execution and next-capability handoff;
- `docs/implementation/testing/coverage-matrix.html` — readable cross-layer automated coverage inventory;
- `docs/implementation/testing/` — manual verification guides.

Statuses used here: **VERIFY**, **DESIGN**, **TODO**, **PLANNED**, **DEFERRED**.

## Current agreed sequence

The existing-capability regression-hardening implementation is complete. Transaction Import was merged through PR #38. The later row-interaction refresh hardening was merged through PR #39 after exact-head CI passed; it includes native `rowClassRules`, SSRM eligibility/selection reconciliation, mutation-path regression coverage, and active indeterminate-header presentation coverage.

PR #40 is the current isolated configurable SSRM experiment. Its first code checkpoint implements the JSON-safe provider / validation / compiler / allowlisted registry boundary and one real `/configurable-ssrm` SSRM composition path without refactoring `/client`, `/infinite`, or `/ssrm`.

CI run #275 at checkpoint `04a02c63c03f74ef3a08507e3d6f0de9b81cdd3d` passed Frontend lint/typecheck/unit/build, Backend checks/tests, and **98/98** Playwright browser scenarios, including the new configurable SSRM real-query proof. Documentation cleanup follows on the same PR and requires its own exact-head CI before merge readiness is claimed.

Current handoff sequence:

```text
1. Finish PR #40 implementation/docs exact-head CI
2. Merge PR #40 only when explicitly requested
3. After merge, synchronize grid-foundation with the new main head
4. If chosen, prove local resolved access projections as the next configurable-table phase
5. Evaluate reuse/migration only after the isolated boundary has enough evidence; migration is not automatic
```

Do not keep expanding Playwright merely to increase test count. Add browser coverage when a new capability or a concrete regression introduces a material real-browser/AG Grid/backend risk.

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
- `docs/implementation/testing/configurable-ssrm-manual-testing.md`
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
**Status:** VERIFY

Authoritative writes can change the backend-derived `interactionMode`. Mutable `selectionDisabled` / `readOnly` presentation uses native `rowClassRules` so old restricted classes are removed when a surviving RowNode becomes enabled.

Merged PR #39 regression coverage exercises the transition lifecycle across all three row models through:

- Import;
- single-row Save;
- Save Selected / bulk persistence;
- selected Change Status.

The Save Selected SSRM scenario also verifies that rows selected while enabled do not remain explicitly selected after the authoritative response makes them non-selectable. Client and SSRM additionally verify that an active indeterminate header remains primary-colored rather than visually resembling a disabled checkbox.

References:

- `docs/implementation/row-interaction.md`
- `docs/implementation/testing/row-interaction-manual-testing.md`

## B. Capability discoverability

### B1. `GRIDCAP-*` registry and source markers
**Status:** VERIFY

`docs/implementation/grid-capability-tags.md` is authoritative for searchable frontend capability markers. The configurable-table boundary uses `GRIDCAP-CONFIGURABLE-TABLE`.

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
**Status:** VERIFY

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

Import implementation is merged on `main`. The remaining VERIFY status is for broader/manual verification, not unfinished implementation.

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

### E1. Fourth configurable grid path
**Status:** VERIFY / PR #40

The first isolated SSRM composition slice is implemented on `/configurable-ssrm` and intentionally does not refactor the proven Client, Infinite or SSRM roots.

Implemented boundary:

- JSON-safe table/column metadata contract with `schemaVersion` and `definitionVersion`;
- explicit stable column `id`, data `field`, optional `semanticKey`, bounded layout, supported sort/filter metadata and registry references;
- runtime validation before metadata reaches AG Grid;
- executable metadata values are rejected;
- asynchronous replaceable definition-provider interface, currently backed by local metadata;
- frontend allowlisted renderer/editor/formatter compiler registries with controlled unknown-key failure;
- feature-owned allowlisted data-source resolver;
- frontend route explicitly chooses SSRM; metadata does not choose Client/Infinite/SSRM;
- existing SSRM loading/query/row-eligibility mechanics are reused;
- focused compiler tests plus a real browser scenario proving metadata-compiled columns drive a real SSRM backend sort/query.

Checkpoint verification: CI #275 passed Frontend, Backend and **98/98** Playwright scenarios at `04a02c63c03f74ef3a08507e3d6f0de9b81cdd3d`. Final documentation commits still require exact-head CI before PR #40 is considered ready.

Current deliberate non-goals:

- backend-served metadata;
- role/group/access projections;
- sensitive-field masking/unmasking;
- tracked-editing parity on the experiment route;
- metadata-driven business actions;
- migration of existing routes;
- JSON exposure of arbitrary AG Grid options;
- metadata-driven row-model choice.

References:

- `docs/implementation/configurable-ssrm-experiment.md`
- `docs/implementation/testing/configurable-ssrm-manual-testing.md`

### E2. Local resolved access projections
**Status:** PLANNED / AFTER E1 MERGE IF CHOSEN

Use one base definition to prove safe local field visibility/read-only projections for two access profiles before involving a backend metadata endpoint.

Keep access/policy semantics out of generic grid mechanics. Unknown or disallowed fields must fail safely rather than becoming visible by default.

### E3. Backend metadata provider
**Status:** PLANNED / AFTER LOCAL PROJECTION PROOF

Only after the local schema/compiler/projection boundary is proven, replace the local provider with a typed backend metadata source. Preserve the same frontend validation/compiler boundary.

### E4. Reuse/migration decision
**Status:** DESIGN / AFTER EXPERIMENT EVIDENCE

Evaluate whether any proven existing route should adopt the boundary. Migration is not automatic and should happen only where it reduces real duplication without hiding native AG Grid lifecycle ownership.

## F. Reuse proof

### F1. Second real business entity
**Status:** TODO when available

A real second table should prove domain neutrality of the shared mechanics.

Do not invent a fake business feature merely to manufacture reuse.

# Completed history

## 2026-08 — Existing-capability regression hardening

Completed the audit/hardening phase before the next product capability:

- deterministic per-test Playwright Transaction reset;
- stable seeded IDs, selectors and authoritative readiness helpers;
- compact coverage matrix;
- broad high-value Client / Infinite / SSRM browser regression coverage;
- focused frontend/backend tests kept at deterministic boundaries instead of duplicating every permutation in Playwright;
- durable Playwright/AGENTS testing rules;
- implementation browser run: 80/80 Playwright scenarios passed in real Chromium, with frontend and backend checks also passing.

Reference: `docs/implementation/testing/browser-regression.md`.

## 2026-08 — Three row-model baseline

Client-Side, Infinite and flat SSRM exist as separate concrete routes with native-first loading/selection ownership and focused automated coverage.

## 2026-08 — Row interaction

Implemented `enabled | selectionDisabled | readOnly`, native loaded-row guards, backend authority for server-wide operations, editing integration and presentation. PR #39 later hardened authoritative interaction-mode transitions and SSRM explicit-selection reconciliation.

Reference: `docs/implementation/row-interaction.md`.

## 2026-08 — Tracked editing and persistence

Implemented stable-ID dirty tracking, row Save/Discard, selected dirty Save/Discard, separate single/bulk writes and safe in-flight acknowledgement.

Reference: `docs/implementation/transaction-editing.md`.

## 2026-08 — BASE / LOCAL / REMOTE conflicts

Implemented unchanged/converged/divergent reconciliation, `Use server`, `Keep my edit`, conflict-aware guards and Discard-to-latest-REMOTE.

Reference: `docs/implementation/edit-conflict-reconciliation.md`.

## 2026-08 — Field/input validation

Implemented registered JSON-safe validation rules, stable row/field validation state, direct/programmatic edit integration, Row Save and exact Save Selected guards, backend DRF field-error mapping, correction/Discard/conflict-resolution lifecycle, and coexistence with BASE/LOCAL/REMOTE conflict state.

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