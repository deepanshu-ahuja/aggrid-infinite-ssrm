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
- `docs/implementation/configurable-ssrm.md` — current configurable Review SSRM implementation;
- `docs/implementation/testing/configurable-ssrm-manual-testing.md` — configurable Review browser/manual verification;
- `docs/implementation/testing/browser-regression.md` — Playwright architecture, E2E reset, CI/local execution and next-capability handoff;
- `docs/implementation/testing/coverage-matrix.html` — readable cross-layer automated coverage inventory;
- `docs/configurable-feature-handoff.md` — configurable-feature architecture handoff;
- `docs/configurable-feature-config-design-progress.md` — configurable design/runtime checkpoint.

Statuses used here: **VERIFY**, **DESIGN**, **TODO**, **PLANNED**, **DEFERRED**.

## Current agreed sequence

The mature Transaction Client/Infinite/SSRM foundation remains the behavioral reference. `TransactionsSsrmNativeEditingGrid` is intentionally retained as the native-editing reference and must not be removed merely because the configurable Review route exists.

PR #43 merged the native-first configurable public type contract. PR #44 merged the initial configurable SSRM/compiler/access proof. The current continuation work expands that proof into a real three-entity Review runtime with independent backend contracts and a common selected business action.

Current sequence:

```text
1. Get the current configurable Review continuation exact-head CI green and keep docs synchronized
2. User decides/executes merge; do not merge automatically
3. Design + implement configurable edit persistence: Row Save, Save Selected Dirty, Discard, backend validation mapping
4. Add masking/unmask only with a real backend-authoritative sensitive-value contract
5. Add entity-specific secondary actions and richer row/field runtime capabilities when required
6. Reconcile native Grid State against changing resolved access before enabling configurable persistence
7. Add real backend configuration/access provider + runtime schema/versioning only when that transport exists
8. Keep concurrency/conflict/versioning deferred until explicitly reopened
```

Do not create another work branch automatically. Keep meaningful branch work in an open PR. Do not merge a PR unless explicitly requested by the user.

Do not expand Playwright merely to increase test count. Add browser coverage when a new implemented capability or concrete regression has material real-browser/AG Grid/backend risk.

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

Implemented Transaction ownership:

```text
Current Page
→ native AG Grid CSV over exact resolved pagination page

Selected Client
→ native/local selected CSV

Selected Infinite / SSRM
→ backend resolves logical selected target and writes CSV
```

The configurable Review route does not yet compose configurable export.

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

The configurable Review runtime separately compiles declarative validation rules into AG Grid native editor validation and composes lightweight BASE + LOCAL draft tracking. It intentionally does not import the older Transaction REMOTE/conflict architecture.

References:

- `docs/implementation/grid-validation.md`
- `docs/implementation/transaction-editing.md`
- `docs/implementation/configurable-ssrm.md`

### A7. Dynamic row-interaction transitions
**Status:** VERIFY / IMPLEMENTED

The mature Transaction routes support mutable `enabled | selectionDisabled | readOnly` interaction state and authoritative refresh transitions.

When Transaction is rendered as a Review entity, its existing backend-derived selectability/editability policy is preserved through the Review runtime adapter. Loan/Finance do not yet define a general row-capability payload contract.

Reference: `docs/implementation/row-interaction.md`.

### A8. Configurable Review exact-head verification
**Status:** VERIFY

Before treating the current continuation head as merge-ready, verify the exact head through CI:

```text
Frontend
→ lint
→ typecheck
→ unit/component tests
→ build

Backend
→ Django system check
→ apps.transactions tests
→ apps.review tests

Browser
→ full Playwright regression suite
```

The CI backend job must include both `apps.transactions` and `apps.review`; a green badge that omits Review backend tests is not sufficient.

Also keep `docs/implementation/testing/configurable-ssrm-manual-testing.md` current. Documented manual steps are not a claim that a manual browser pass was executed.

Generated TypeDoc must not be described as current unless `npm run docs:configurable` was actually regenerated on the exact reported head.

## B. Capability discoverability

### B1. `GRIDCAP-*` registry and source markers
**Status:** VERIFY

`docs/implementation/grid-capability-tags.md` is authoritative for searchable frontend capability markers.

When a frontend capability footprint changes:

1. inspect its registry entry;
2. search current source/test occurrences;
3. update meaningful markers;
4. update focused tests and implementation docs.

Never invent an unregistered capability tag.

## C. Deferred core/product decisions

### C1. Application/session unsaved-draft lifetime
**Status:** DEFERRED

Current stable-ID tracked edits survive row-object/RowNode recreation while the grid feature is alive.

Do not add route/session/browser-refresh draft persistence until the product requires a longer draft lifetime.

### C2. Backend optimistic concurrency / stale-write protection
**Status:** DEFERRED

The proven Transaction grids can reconcile BASE/LOCAL/REMOTE divergence after fresh authoritative data reaches the browser. Backend version/ETag/revision rejection is a separate product/API contract.

For configurable Review, conflict/concurrency/versioning remains explicitly deferred. Do not automatically import the previous REMOTE architecture into the configurable runtime.

### C3. Undo/redo
**Status:** DEFERRED

Do not enable spreadsheet-style undo/redo until its interaction with tracked drafts, programmatic edits, conflicts, validation and Save/Discard is defined.

### C4. User/profile Grid State persistence
**Status:** DEFERRED for backend profile persistence

The mature Transaction routes persist supported native Grid State preferences through the current replaceable browser-storage boundary.

Backend/user-profile persistence is not part of the current implementation. Configurable Review also needs access/state reconciliation before enabling its own persistence.

### C5. Grouping/tree/aggregation/pivot and other advanced AG Grid features
**Status:** DEFERRED

Current SSRM implementation is flat. Do not introduce advanced semantics without an explicit product/server contract.

## D. Import

### D1. Transaction Import workflow
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

## E. Configurable Review SSRM

### E1. Generic feature/entity/configuration runtime
**Status:** VERIFY / IMPLEMENTED FOUNDATION

The configurable runtime is exposed at `/configurable-ssrm` and now proves one Review feature with three distinct entity shapes through one configurable SSRM root:

```text
Review
├── Loan
├── Finance
└── Transaction
```

Implemented foundation includes:

- application configurable-SSRM defaults;
- explicit semantic `entity.gridOptions` merge behavior;
- filter/editor/renderer allowlists and formatter/parser/validator registries;
- `labelKey → headerName` compilation;
- `rowId.path → getRowId` plus stable draft identity;
- declarative validation rules → native editor validation;
- native grid/column configuration where semantics match;
- generic `ConfigurableSsrmEntityGrid` with no Loan/Finance/Transaction/profile/localStorage branching;
- active entity runtime lookup through `entity.dataAdapterKey`;
- keyed entity remount so GridApi/datasource/selection/mutation/draft state do not leak across entities;
- SSRM retry/error lifecycle;
- mature SSRM selection controller composition: manual, Current Page, All Filtered, native All Records, logical selected counts;
- BASE + LOCAL draft tracking;
- common primary selected action boundary;
- focused tests plus real-grid Playwright coverage.

Loan and Finance have rich independent configs using server sort/filter, editors, parsers, formatters, validation and renderers. Transaction reuses the existing rich Transaction configurable entity instead of copying it.

The obsolete Transaction-only configurable grid consumer and original monolithic Review proof file are removed. `TransactionsSsrmNativeEditingGrid` remains intentionally retained.

Current canonical references:

- `docs/implementation/configurable-ssrm.md`;
- `docs/implementation/testing/configurable-ssrm-manual-testing.md`;
- `docs/configurable-feature-handoff.md`;
- `docs/configurable-feature-config-design-progress.md`;
- `frontend/src/features/review/ReviewConfigurableSsrmFeature.tsx`;
- `frontend/src/features/review/configurable/reviewFeature.definition.ts`;
- `frontend/src/features/review/configurable/reviewRuntime.registry.ts`;
- `frontend/src/shared/grid/configurable/ConfigurableSsrmEntityGrid.tsx`.

Current rules:

- configurable runtime remains SSRM-only for this experiment;
- do not refactor `/client`, `/infinite`, `/ssrm`, or `/ssrm-native-editing` merely to make Review work;
- entity keys carry business/config identity;
- executable behavior remains frontend-owned;
- backend request/response vocabulary remains entity-owned;
- datasource/GridApi/lifecycle remains in the concrete configurable SSRM root;
- backend metadata does not dynamically select Client/Infinite/SSRM;
- native AG Grid first, custom only for genuine semantic gaps.

### E2. Frontend-only current-user access projection
**Status:** VERIFY / IMPLEMENTED FOUNDATION

Implemented:

```text
base Review FeatureDefinition
        +
simulated current-user access allowlist
        ↓
resolveReviewFeatureAccess
        ↓
resolved feature/entity/field/action set
```

Semantics:

- missing feature/entity/field means unavailable and is removed;
- `read` forces resolved field editability off;
- `edit` preserves base editability and cannot promote a base read-only field;
- missing action means unavailable;
- permitted action must exist in the base entity definition;
- invalid entity/field/action references fail controlledly;
- access projection is not a partial grid config override;
- profile identity and active entity remain separate.

Development selectors:

```text
aggrid.devAccessProfile
→ loanOnly
→ financeOnly
→ transactionOnly
→ loanAndFinance
→ allEntities
→ loanReadOnly
→ loanRestricted

aggrid.devActiveEntity
→ loan | finance | transaction
```

Default profile is `allEntities`.

These values simulate an already-resolved user/session result and are not a security boundary. Do not put role/profile-name checks inside shared grid/compiler/runtime code.

### E3. Runtime JSON normalization boundary
**Status:** IMPLEMENTED WHEN NEEDED / VERIFY

`configuration.normalizer.ts` remains the runtime `unknown` trust boundary for actual backend/storage JSON and for the earlier backend-like Transaction configurable definition.

Trusted local Loan/Finance configuration is frontend-authored TypeScript and does not need artificial runtime normalization.

Rule:

```text
trusted local typed config
→ access/compiler directly

real backend/storage JSON (`unknown`)
→ validate + normalize
→ access/compiler
```

Do not remove runtime validation when a real untrusted transport exists; do not overbuild it around local constants before that boundary exists.

### E4. Configurable server query/search contracts
**Status:** VERIFY / IMPLEMENTED FOUNDATION

Loan and Finance are now real Django-backed configurable entities, not frontend arrays.

They deliberately use independent backend contracts:

```text
Loan
POST /api/review/loans/query/
→ offset / limit / sort / filters

Finance
POST /api/review/finance/search/
→ window / orderBy / criteria
→ records / counts response vocabulary

Transaction
POST /api/transactions/query/
→ existing Transaction query contract
```

Each entity owns its request mapper/field allowlist. The generic grid receives only a normalized `GridRowsLoader` result.

Do not collapse these into one polymorphic Review endpoint merely because one frontend grid renders them.

### E5. Configurable read/write/save mapping
**Status:** TODO / NEXT CORE CAPABILITY

Current native cell editing proves validation + BASE/LOCAL tracking only. The common Review `Submit` action is a business action, not edit persistence.

Next persistence design must cover at least:

- single-row Save;
- Save Selected Dirty;
- row/selected Discard;
- entity-owned request mapping and backend endpoint differences;
- backend field validation/error mapping;
- success acknowledgement without clearing newer local edits;
- authoritative refresh/reconciliation after persistence;
- exact behavior for clean/unloaded selected rows.

Do not make Select All manufacture edits for rows that are not dirty.

TanStack Query may own mutation lifecycle at the application boundary when natural; do not force it into SSRM datasource fetching.

### E6. Business actions, action access, masking and row capabilities
**Status:** PARTIAL / DESIGN TODO

Implemented now:

- JSON-safe action identity metadata;
- default-deny action access projection;
- one common primary Review action slot (`submit`);
- TanStack mutation ownership in Review;
- entity-owned action adapters with different API payloads/responses;
- success clears selection + refreshes the active SSRM store;
- failure preserves selection/store;
- Loan and Finance backend action contracts;
- Transaction Review adapter over existing Transaction selected-update behavior.

Still TODO when required:

- entity-specific secondary action rendering/execution;
- masking/unmask/sensitive-value retrieval;
- richer row-specific/field-specific runtime capabilities beyond current Transaction row-interaction policy;
- dependency handling when access removes fields required by another capability;
- real backend authorization independent of UI projection.

Masking concepts remain separate:

```text
maskable
currently masked
can request unmask
```

Do not send a clear sensitive value to the browser and merely hide it with CSS. Do not add placeholder masking metadata to current entities before the backend-authoritative unmask contract exists.

### E7. Grid State/access reconciliation
**Status:** TODO

Native Grid State remains preferred for supported view preferences, but configurable entity/access changes require deliberate reconciliation before persistence is enabled on this route. Previously saved state must never restore a field/entity removed by current access.

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

Do not invent versioning or provider APIs before there is a real transport contract.

## F. Reuse proof

### F1. Multiple real backend entity contracts
**Status:** VERIFY / IMPLEMENTED FOUNDATION PROOF

Review now proves three business entity/runtime shapes through the same configurable SSRM root:

- Loan — its own Django query/action contract and `id` row identity;
- Finance — deliberately different Django query/action vocabulary and `recordKey` identity;
- Transaction — existing Transaction backend/query/action behavior reused through thin Review adapters.

The current Django sources are deterministic in-process data rather than a production database, but they are real independent HTTP contracts exercised by the frontend and backend tests. The reuse proof no longer depends on frontend-only arrays.

The generic grid remains unchanged by those backend differences. That is the boundary to preserve when future production entities replace the deterministic sources.

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

The Change Status mutation carries only the business request. After backend success, each mature concrete Transaction grid root calls its own selection controller's existing `clearSelection()` and refreshes authoritative data. Failed requests retain selection.

Reference: `docs/implementation/selected-action-selection-lifecycle.md`.

## 2026-08 — CI and lifecycle hardening

CI runs frontend lint/typecheck/tests/build plus backend Django checks/tests without Docker. GridApi teardown, datasource cancellation and request freshness have focused regression coverage.

# Explicit non-goals unless requirements change

- universal `AgGridReact` wrapper;
- giant generic `useGrid()` hiding native AG Grid;
- one fake shared selection controller for all row models;
- one `clearSelection(rowModelType)` switch;
- one generic mutation that chooses unrelated business endpoints from an action key;
- one polymorphic Review endpoint merely because entities share a grid;
- server datasource mechanics in Client-Side;
- duplicate backend interpretations of logical selection;
- custom abstractions duplicating native AG Grid without a real semantic gap;
- backend metadata dynamically choosing Client/Infinite/SSRM;
- refactoring proven grids merely to support the configurable Review experiment;
- deleting `TransactionsSsrmNativeEditingGrid` merely because configurable Review exists;
- Docker for this same-repository Databricks App without a real requirement;
- speculative advanced SSRM/grouping/pivot/aggregation behavior;
- speculative concurrency/versioning on configurable Review;
- excessive `GRIDCAP-*` markers on trivial code.

> **Standing rule: native AG Grid first; use the best capability of the actual row model; share only genuine semantics/mechanics; keep business rules feature/backend-owned.**
