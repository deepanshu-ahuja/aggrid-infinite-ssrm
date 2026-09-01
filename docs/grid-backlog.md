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

PR #43 merged the native-first configurable public type contract to `main`. `configurable-feature-grid` / PR #44 now contains defaults/compiler plus the generic feature/entity/access SSRM proof: one Review feature can resolve different Loan/Finance entity shapes and different simulated current-user projections before reaching the shared configurable SSRM root.

Current sequence:

```text
1. Verify/harden the generic configurable feature/entity/access SSRM runtime on configurable-feature-grid
2. Keep implementation/manual/handoff/TypeDoc/coverage documentation synchronized with the exact verified head
3. Add real server sort/filter/search mapping only when a real configurable entity backend requires it
4. Design and implement configurable read/write/save mapping
5. Continue business actions, action access, masking/unmask and row-specific access/capability design
6. Reconcile native Grid State against changing resolved access before enabling persistence on the configurable route
7. Add backend config/access providers plus schema/versioning only when runtime exchange actually exists
8. Evaluate reuse/migration only after the isolated path proves the boundary
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

The current generic Review feature/entity/access runtime is implemented on `configurable-feature-grid`. Before treating the head as complete, verify:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run docs:configurable
```

Also run applicable Playwright and manual browser verification for the localStorage profile/entity combinations. Generated TypeDoc must not be described as current until `npm run docs:configurable` actually regenerates it on the exact head.

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

### E1. Generic feature/entity/configuration runtime
**Status:** VERIFY / IMPLEMENTED FOUNDATION

The configurable runtime is exposed only at `/configurable-ssrm` and now proves the intended business-agnostic boundary rather than a Transaction-shaped grid.

Implemented foundation:

- application configurable-SSRM defaults;
- exact `entity.gridOptions` merge behavior;
- nested `defaultColDef`, filter/editor/renderer param, rowSelection and Cell Selection merge behavior;
- filter/editor/renderer allowlists plus formatter/parser/validator frontend registries;
- `labelKey → headerName` compilation;
- `rowId.path → getRowId` plus shared-draft row accessor;
- `validationRules → cellEditorParams.getValidationErrors` for provided editors;
- fields → final native `ColDef[]`;
- resolved native `GridOptions`;
- generic `ConfigurableSsrmEntityGrid<TData>` with no domain/profile/localStorage branching;
- Review base feature with separate `loan` and `finance` entity definitions;
- different `LoanReviewRow` and `FinanceReviewRow` data shapes through the same generic SSRM root;
- frontend-only entity-specific local `GridRowsLoader` adapters for this proof;
- `useGridDraftEditing` BASE + LOCAL composition;
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
- `frontend/src/shared/grid/configurable/configuration.compiler.ts`;
- `frontend/src/shared/grid/configurable/ConfigurableSsrmEntityGrid.tsx`.

Current rules:

- first proof remains SSRM-only;
- do not refactor `/client`, `/infinite` or `/ssrm` merely to make the experiment work;
- the configurable grid is not Transaction/Loan/Finance-specific;
- entity record keys carry business identity;
- native AG Grid names/types are preferred when semantics match;
- executable behavior remains frontend-owned;
- runtime infrastructure such as datasource/GridApi/lifecycle remains frontend-owned;
- backend metadata does not dynamically select Client/Infinite/SSRM;
- server query semantics remain adapter/backend-owned rather than inferred by the compiler;
- evaluate migration/reuse only after the isolated path proves the boundary;
- migration is not automatic.

### E2. Frontend-only current-user access projection
**Status:** VERIFY / IMPLEMENTED FOUNDATION

Implemented:

```text
base FeatureDefinition
        +
simulated current-user access
        ↓
resolveFeatureAccess
        ↓
resolved feature/entity/field set
```

Current semantics:

- missing feature/entity/field means unavailable and is removed;
- `read` forces resolved field editability off;
- `edit` preserves base editability and cannot promote a base read-only field;
- invalid entity/field identity references fail controlledly;
- profile identity and active entity remain separate.

Current FE-only development selectors:

```text
aggrid.devAccessProfile
→ loanOnly | financeOnly | loanAndFinance | loanReadOnly

aggrid.devActiveEntity
→ loan | finance
```

Change localStorage and reload `/configurable-ssrm` to verify access without provisioning real users.

These values simulate an already-resolved user/session result and are not a security boundary. Do not put role/profile-name checks inside shared grid/compiler/access code.

### E3. Runtime JSON normalization boundary
**Status:** IMPLEMENTED WHEN NEEDED / VERIFY

`configuration.normalizer.ts` remains the runtime `unknown` trust boundary for actual backend/storage JSON and for the earlier backend-like Transaction proof.

Current trusted Review base configuration is authored in frontend source using TypeScript `satisfies FeatureDefinition` and is **not** forced through runtime normalization merely to imitate a future backend.

Rule:

```text
trusted local typed config
→ access/compiler directly

real backend/storage JSON (`unknown`)
→ validate + normalize
→ access/compiler
```

Do not remove runtime validation when an actual untrusted transport exists; do not overbuild it around local constants before that boundary exists.

### E4. Configurable server query/search contract expansion
**Status:** DESIGN / TODO when a real configurable entity backend needs it

Current Loan/Finance Review rows are frontend-only local loaders and intentionally expose no server sort/filter semantics.

When a real entity backend exists, add an explicit feature-owned request mapper/field allowlist. Do not send arbitrary AG Grid `colId`/`field` identifiers to the backend and do not make the compiler infer server semantics.

The existing Transaction request mapper remains the reference for real server-backed translation.

### E5. Configurable read/write/save mapping
**Status:** TODO

Design persistence around the proven native editing + `cellValueChanged` + `useGridDraftEditing` ownership. Keep single-row and bulk persistence semantics explicit. Do not make Select All manufacture edits for clean/unloaded rows.

### E6. Business actions + access/security/masking
**Status:** DESIGN / TODO beyond current field projection

Current access work proves feature/entity/field availability and read/edit projection only.

Still design/implement when required:

- feature/entity business actions and action authorization;
- sensitive/maskable fields;
- current masked state and authoritative unmask requests;
- row-specific and field-specific runtime capabilities;
- dependency handling when an authorized projection removes required fields/capabilities;
- backend enforcement independent from UI projection.

Keep security/business eligibility backend/feature-owned. Introduce registries/config descriptors only when there is a real configuration-driven action/access system to select among.

### E7. Grid State/access reconciliation
**Status:** TODO

Native Grid State remains preferred for supported view preferences, but configurable column/access changes require deliberate reconciliation semantics before persistence is enabled for this route. Previously saved state must never restore a field/entity that current access removed.

### E8. Runtime config/access provider + schema/versioning
**Status:** TODO when backend exchange requires it

When backend configuration/access APIs actually exist:

```text
runtime JSON (`unknown`)
→ validate/normalize
→ resolve supported schema/version
→ resolved current-user access
→ compiler/runtime
```

Do not invent versioning or backend provider APIs speculatively before there is a transport contract.

## F. Reuse proof

### F1. Second business shape versus second real backend entity
**Status:** PARTIAL PROOF / TODO for real backend integration

The current Review route already proves two different frontend row/data shapes (`LoanReviewRow` and `FinanceReviewRow`) through one generic configurable SSRM root. This is useful evidence that the runtime is not Transaction-shaped.

It does **not** yet prove a second production backend/domain contract: Loan/Finance currently use FE-only local loaders. When a real second backend business entity is available, use it to prove explicit request mapping, persistence and backend authorization without changing the generic grid boundary.

Do not invent fake backend APIs merely to manufacture reuse.

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