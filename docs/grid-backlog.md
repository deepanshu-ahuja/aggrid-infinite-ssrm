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
- `docs/implementation/configurable-ssrm.md` — implemented isolated configurable SSRM foundation;
- `docs/implementation/testing/browser-regression.md` — Playwright architecture, E2E reset, CI/local execution and next-capability handoff;
- `docs/implementation/testing/coverage-matrix.html` — readable cross-layer automated coverage inventory;
- `docs/implementation/testing/` — manual verification guides;
- `docs/configurable-feature-handoff.md` — current configurable-feature architecture handoff;
- `docs/configurable-feature-config-design-progress.md` — latest configurable design/runtime checkpoint and exact resume point.

Statuses used here: **VERIFY**, **DESIGN**, **TODO**, **PLANNED**, **DEFERRED**.

## Current agreed sequence

The existing Client/Infinite/SSRM Transaction capability foundation and regression-hardening work are complete enough to support the isolated configurable architecture experiment. Transaction Import and the later mutable row-interaction fixes are merged history rather than active PR work.

PR #43 merged the native-first configurable public type contract to `main`. `configurable-feature-grid` now contains the first real defaults + normalization/compiler + isolated SSRM consumer foundation and is kept visible through PR #44 while verification continues.

Current sequence:

```text
1. Verify/harden the configurable SSRM runtime foundation on configurable-feature-grid
2. Keep generated TypeDoc + coverage/manual docs synchronized with the exact verified head
3. Continue server sort/filter/search mapping only where the real adapter/backend semantics require extension
4. Design and implement read/write/save mapping
5. Continue access/security/masking, business actions and Grid State/access reconciliation
6. Add runtime config schema/versioning when the backend/runtime exchange requires it
7. Evaluate reuse/migration only after the isolated path proves the boundary
```

Do not create another work branch automatically. Keep meaningful branch work in an open PR. Do not merge a PR unless explicitly requested by the user.

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

Implemented Transaction behavior includes registered frontend validation rules, stable row/field validation state, direct/programmatic edit integration, Row Save and exact Save Selected guards, backend field-error mapping, correction/Discard/conflict-resolution lifecycle and separation of validation from BASE/LOCAL/REMOTE conflicts.

The configurable SSRM foundation separately compiles declarative validation rules into AG Grid native editor validation and composes the lightweight PR #42 BASE + LOCAL draft observer. It does not import the older Transaction REMOTE/conflict architecture.

References:

- `docs/implementation/grid-validation.md`
- `docs/implementation/transaction-editing.md`
- `docs/implementation/configurable-ssrm.md`

### A7. Dynamic row-interaction transitions
**Status:** VERIFY / IMPLEMENTED

The mutable row-interaction regression discovered during Import/manual verification was fixed and merged. Authoritative writes can change backend-derived `interactionMode`; mutable `selectionDisabled` / `readOnly` presentation uses native `rowClassRules` so stale restricted classes are removed when a surviving RowNode becomes enabled.

Regression coverage exists across Import, single-row Save, Save Selected/bulk persistence and selected Change Status for the applicable row models.

References:

- `docs/implementation/row-interaction.md`
- `docs/implementation/testing/row-interaction-manual-testing.md`

### A8. Configurable SSRM exact-head verification
**Status:** VERIFY

The first configurable runtime foundation is implemented on `configurable-feature-grid`. Before treating it as complete, verify the exact branch head with:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run docs:configurable
```

Also run the applicable Playwright and manual browser verification. Generated TypeDoc was already stale at the pre-runtime handoff checkpoint, so it must not be described as current until `npm run docs:configurable` actually regenerates it.

Reference: `docs/implementation/testing/configurable-ssrm-manual-testing.md`.

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

Current BASE/LOCAL/REMOTE reconciliation detects divergence only after fresh authoritative data reaches the browser in the proven Transaction grids.

Backend version/ETag/revision protection requires a separate product/API contract if stale writes must be rejected even without an intervening refresh.

For the configurable SSRM path, concurrency/conflict/versioning remains a separate later decision; do not automatically bring the previous REMOTE reconciliation architecture into the new foundation.

### C3. Undo/redo
**Status:** DEFERRED

Do not enable spreadsheet-style undo/redo until its interaction with tracked drafts, programmatic edits, conflicts, validation and Save/Discard is defined.

### C4. User/profile Grid State persistence
**Status:** DEFERRED

Current native Grid State persists supported preferences through the replaceable browser-storage boundary.

Backend/user-profile persistence is not part of the current implementation.

### C5. Grouping/tree/aggregation/pivot and other advanced AG Grid features
**Status:** DEFERRED

Current SSRM implementation is flat. Do not introduce advanced semantics without an explicit product/server contract.

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

### E1. Defaults + normalization/compiler + first SSRM consumer
**Status:** VERIFY / IMPLEMENTED FOUNDATION

The first configurable runtime foundation is implemented on `configurable-feature-grid` and exposed only at `/configurable-ssrm`.

Implemented foundation:

- application configurable-SSRM defaults;
- exact `entity.gridOptions` merge behavior;
- nested `defaultColDef`, filter/editor/renderer param, rowSelection and Cell Selection merge behavior;
- mandatory runtime `unknown` JSON validation + normalization;
- filter/editor/renderer name allowlists;
- formatter/parser/validator frontend registries;
- `labelKey → headerName` compilation;
- `rowId.path → getRowId` plus shared-draft row accessor;
- `validationRules → cellEditorParams.getValidationErrors` for provided editors;
- fields → final native `ColDef[]`;
- resolved native `GridOptions`;
- isolated Transaction configurable SSRM root;
- existing Transaction request mapper/API/data-source lifecycle composition;
- existing Transaction row/cell eligibility composition;
- `useGridDraftEditing` BASE + LOCAL composition rather than copying PR #42;
- focused unit tests plus real-grid Playwright coverage.

Current canonical references:

- `docs/configurable-feature-handoff.md`;
- `docs/configurable-feature-config-design-progress.md`;
- `docs/configurable-feature/configuration-reference.md`;
- `docs/configurable-feature/type-hierarchy.md`;
- `docs/configurable-feature/concepts.md`;
- `docs/implementation/configurable-ssrm.md`;
- `docs/implementation/testing/configurable-ssrm-manual-testing.md`;
- `frontend/src/shared/grid/configurable/configuration.types.ts`;
- `frontend/src/shared/grid/configurable/configuration.defaults.ts`;
- `frontend/src/shared/grid/configurable/configuration.normalizer.ts`;
- `frontend/src/shared/grid/configurable/configuration.compiler.ts`.

Current rules remain:

- first proof is SSRM-only;
- do not refactor `/client`, `/infinite` or `/ssrm` merely to make the experiment work;
- frontend authors/supports the configuration contract; backend may persist/manage and return it;
- raw backend/storage config is validated + normalized before compilation even when current names happen to match;
- native AG Grid names/types are preferred when semantics match;
- executable behavior is represented by JSON-safe keys/params and resolved by frontend registries only when genuinely configurable;
- runtime infrastructure such as the datasource/context/compiled-column application remains frontend-owned;
- backend metadata does not dynamically select Client/Infinite/SSRM;
- server query semantics remain adapter/backend-owned rather than inferred by the compiler;
- evaluate migration/reuse only after the isolated path proves the boundary;
- migration is not automatic.

### E2. Configurable server query/search contract expansion
**Status:** DESIGN / TODO when needed

The first Transaction consumer deliberately reuses `mapTransactionGridRequest`. Extend configurable query metadata/mapping only when a real consumer requires semantics beyond that existing adapter. Do not send arbitrary AG Grid column/filter identifiers to the backend.

### E3. Configurable read/write/save mapping
**Status:** TODO

Design persistence around the proven native editing + `cellValueChanged` + `useGridDraftEditing` ownership. Keep single-row and bulk persistence semantics explicit. Do not make Select All manufacture edits for clean/unloaded rows.

### E4. Access/security/masking + business actions
**Status:** TODO

Keep business eligibility and security backend/feature-owned. Introduce registries/config descriptors only when there is a real configuration-driven action/access system to select among.

### E5. Grid State/access reconciliation
**Status:** TODO

Native Grid State remains preferred for supported view preferences, but configurable column/access changes require deliberate reconciliation semantics before persistence is enabled for this route.

### E6. Runtime config schema/versioning
**Status:** TODO when backend config exchange requires it

The runtime already has a mandatory normalization boundary. Add explicit schema/version negotiation when the backend/database representation becomes an actual external contract rather than inventing versions speculatively.

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

Implemented unchanged/converged/divergent reconciliation, `Use server`, `Keep my edit`, conflict-aware guards and Discard-to-latest-REMOTE for the proven Transaction grids.

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
