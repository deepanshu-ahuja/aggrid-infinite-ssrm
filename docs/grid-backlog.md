# Grid Foundation Backlog

This is the living planning/control list for unfinished grid-foundation work.

Current implementation truth lives under `docs/implementation/`. This backlog may contain unfinished work, sequencing and deferred decisions.

Useful current references:

- `docs/implementation/README.md` — current implementation documentation entry point;
- `docs/implementation/grid-capabilities.md` — implemented capability catalog;
- `docs/implementation/grid-capability-tags.md` — searchable frontend capability registry;
- `docs/implementation/row-models/client.md` — Client-Side implementation guide;
- `docs/implementation/row-models/infinite.md` — Infinite implementation guide;
- `docs/implementation/row-models/ssrm.md` — SSRM implementation guide;
- `docs/implementation/ag-grid-native-usage.md` — native AG Grid surface used by current code;
- `docs/implementation/testing/` — manual verification guides.

Statuses used here: **VERIFY**, **DESIGN**, **TODO**, **PLANNED**, **DEFERRED**.

## Current agreed sequence

```text
1. Keep Client-Side, Infinite and SSRM baseline verification available
2. Implement field/input validation
3. Design and implement Import as a separate workflow
4. Build an isolated fourth configurable SSRM-based grid experiment
5. Evaluate reuse/migration only after that experiment proves its boundary
```

Manual browser verification remains required but may be consolidated later unless a real correctness defect requires immediate interruption.

# Active backlog

## A. Baseline verification

### A1. Client / Infinite / SSRM manual regression
**Status:** VERIFY  
**Priority:** Pending manual pass; non-blocking

Automated coverage exists. When the browser pass is scheduled, verify row models independently.

Server-backed guide:

- `docs/implementation/testing/server-backed-manual-testing.md`

Row-interaction guide:

- `docs/implementation/testing/row-interaction-manual-testing.md`

Client-specific scenarios are documented in:

- `docs/implementation/row-models/client.md`

Do not mark manual verification complete unless the scenarios were actually run.

### A2. Selected-row totals
**Status:** VERIFY

Implemented current contract:

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

Do not subtract only restricted rows currently loaded in browser memory.

Current implementation reference:

- `docs/implementation/selection-counts.md`

### A3. Edited-row total
**Status:** VERIFY

`Edited` means dirty rows, not dirty cells. Multiple dirty fields in one row count as one edited row.

Current implementation reference:

- `docs/implementation/edited-row-count.md`

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

Current implementation reference:

- `docs/implementation/grid-export.md`

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

## B. Capability discoverability

### B1. `GRIDCAP-*` registry and source markers
**Status:** VERIFY

`docs/implementation/grid-capability-tags.md` is authoritative for searchable frontend capability markers.

Markers remain frontend-only. Backend authority remains documented/tested through normal backend contracts and tests.

When a frontend capability footprint changes:

1. inspect its registry entry;
2. search current source/test occurrences;
3. update meaningful markers;
4. update focused tests and implementation docs.

## C. Field/input validation

### C1. Validation engine + editing integration
**Status:** DESIGN / IMPLEMENT NEXT

Validation is a first-class capability independent of configurable-table metadata.

Static Transaction configuration must be able to use validation directly. A configurable-table compiler may later produce the same resolved validation inputs, but validation must not depend on that architecture.

Required domain-neutral behavior:

- invalid LOCAL values remain visible;
- invalid LOCAL work remains dirty;
- validation state lives outside transient RowNodes and is keyed by stable row ID + field;
- row Save is blocked when relevant dirty fields are invalid;
- Save Selected Dirty is blocked when its exact dirty target contains invalid fields;
- direct cell edits and current-page/programmatic edits run the same validation semantics;
- backend structured field errors map into the same validation state;
- rejected LOCAL input remains visible/dirty after backend validation failure;
- correction/revert revalidates and clears stale errors;
- Discard clears validation belonging to discarded LOCAL work;
- validation and BASE/LOCAL/REMOTE conflict state remain separate and can coexist;
- conflict resolution revalidates the resulting effective value;
- invalid/conflict presentation can coexist predictably;
- unknown required rule keys fail predictably;
- no arbitrary executable JavaScript/expression is accepted from backend/configuration;
- focused Client/Infinite/SSRM integration tests cover lifecycle differences.

Primary engine input:

```text
rules: [
  { key: required },
  { key: maxLength, params: { max: 100 } },
  { key: numberRange, params: { min: 0, max: 1000000 } }
]
```

A reusable higher-level rule-profile key should be considered only if repeated real rule combinations justify it. The validation engine itself should consume resolved rules.

Before adding a validation capability marker, review:

- `docs/implementation/grid-capability-tags.md`

## D. Deferred core/product decisions

### D1. Application/session unsaved-draft lifetime
**Status:** DEFERRED

Current stable-ID tracked edits survive row-object/RowNode recreation while the grid feature is alive.

Do not add route/session/browser-refresh draft persistence until the product requires a longer draft lifetime.

### D2. Backend optimistic concurrency / stale-write protection
**Status:** DEFERRED

Current BASE/LOCAL/REMOTE reconciliation detects divergence only after fresh authoritative data reaches the browser.

Backend version/ETag/revision protection requires a separate product/API contract if stale writes must be rejected even without an intervening refresh.

### D3. Undo/redo
**Status:** DEFERRED

Do not enable spreadsheet-style undo/redo until its interaction with tracked drafts, programmatic edits, conflicts, validation and Save/Discard is defined.

### D4. User/profile Grid State persistence
**Status:** DEFERRED

Current native Grid State persists supported preferences through the replaceable browser-storage boundary.

Backend/user-profile persistence is not part of the current implementation.

### D5. Grouping/tree/aggregation/pivot and other advanced AG Grid features
**Status:** DEFERRED

Current SSRM implementation is flat. Do not introduce advanced semantics without an explicit product contract.

## E. Import

### E1. Import workflow
**Status:** TODO / AFTER VALIDATION

Import is separate from ordinary tracked editing.

Design/implementation should cover as required:

- accepted file/template formats;
- stable identifiers;
- create/update/upsert semantics;
- field mapping;
- preview/dry-run;
- validation reuse where appropriate;
- duplicate handling;
- atomic versus partial-success behavior;
- row/field error reporting;
- downloadable error output when useful;
- progress/cancellation for large jobs when required;
- authoritative post-import refresh.

Do not hide Import inside ordinary cell-edit persistence.

## F. Isolated configurable SSRM experiment

### F1. Fourth configurable grid path
**Status:** PLANNED / AFTER IMPORT

Build a separate SSRM-based grid composition path to prove the metadata compiler/resolver/registry boundary.

Rules:

- do not refactor `/client`, `/infinite` or `/ssrm` merely to make the experiment work;
- do not rewrite proven shared loading, selection, tracked editing, conflict, freshness, lifecycle or Grid State mechanics while the composition boundary is still being proven;
- temporary feature-level duplication is acceptable when it protects proven behavior and makes comparison explicit;
- backend metadata may describe supported JSON-safe table/business composition;
- backend metadata does not dynamically select Client/Infinite/SSRM;
- frontend/application chooses the supported AG Grid row model(s);
- executable renderers/editors/formatters/validators/action behavior remain frontend implementations;
- evaluate migration/reuse only after the isolated path proves the boundary;
- migration is not automatic.

Architecture proposal material remains separate from current implementation docs.

## G. Reuse proof

### G1. Second real business entity
**Status:** TODO when available

A real second table should prove domain neutrality of the shared mechanics.

Do not invent a fake business feature merely to manufacture reuse.

# Completed history

## 2026-08 — Three row-model baseline

Client-Side, Infinite and flat SSRM exist as separate concrete routes with native-first loading/selection ownership and focused automated coverage.

## 2026-08 — Row interaction

Implemented `enabled | selectionDisabled | readOnly`, native loaded-row guards, backend authority for server-wide operations, editing integration and presentation.

Current reference:

- `docs/implementation/row-interaction.md`

## 2026-08 — Tracked editing and persistence

Implemented stable-ID dirty tracking, row Save/Discard, selected dirty Save/Discard, separate single/bulk writes and safe in-flight acknowledgement.

Current reference:

- `docs/implementation/transaction-editing.md`

## 2026-08 — BASE / LOCAL / REMOTE conflicts

Implemented unchanged/converged/divergent reconciliation, `Use server`, `Keep my edit`, conflict-aware guards and Discard-to-latest-REMOTE.

Current reference:

- `docs/implementation/edit-conflict-reconciliation.md`

## 2026-08 — Selected Change Status lifecycle

The Change Status mutation carries only the business request. After backend success, each concrete grid root calls its own selection controller's existing `clearSelection()` and refreshes authoritative data. Failed requests retain selection.

There is no current configurable `clear | preserve` runtime policy.

Current reference:

- `docs/implementation/selected-action-selection-lifecycle.md`

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
