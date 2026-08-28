# Grid Foundation Backlog

This is the **single living TODO/control list** for unfinished grid-foundation work. It exists so decisions and remaining work live in the repository rather than only in chat history.

Use it with:
- `docs/grid-capabilities.md` — implemented logical capabilities;
- `docs/grid-capability-tags.md` — searchable capability footprint/extraction registry;
- `docs/client-side-grid.md` — Client-Side capability matrix, ownership and verification;
- `docs/ag-grid-native-usage.md` — meaningful native AG Grid dependencies;
- `docs/selection-edit-export.md` — navigation to the detailed selection/edit/export docs;
- detailed feature/manual-test docs.

The backlog is a tracking/control document. It is **not** a rule that every verification item must be completed before implementation work can continue.

## Maintenance rule

Statuses: **VERIFY**, **DESIGN**, **TODO**, **PLANNED**, **DEFERRED**.

When something is fully implemented and verified, remove it from Active backlog, record it under Completed history, and update capability/native/detailed docs when behavior or AG Grid dependencies changed.

## Current agreed sequence

```text
1. Keep Client-Side, Infinite and SSRM baseline verification available
   - focused automated coverage exists
   - manual browser verification remains pending and can be consolidated later
   - manual verification is important but is not a blocker for architecture/reference work

2. Maintain capability discoverability
   - GRIDCAP-* registry is authoritative
   - important roots/controllers/backend boundaries/tests carry searchable markers
   - tags identify capability participation, not copy-paste equivalence

3. From the three-row-model baseline onward
   - evaluate new grid-foundation capabilities across Client / Infinite / SSRM together
   - do NOT force the three row models through identical implementation

4. Product-driven work continues when needed
   - import
   - richer validation/permissions
   - concurrency
   - advanced SSRM
   - named views/mass editing/create-delete/etc.
```

Manual verification remains important, but it is intentionally schedulable as a later consolidated pass. Only a genuine core correctness defect should interrupt other agreed foundation work.

# Active backlog

## A. Infinite + SSRM baseline verification

### A1. Manual Infinite + SSRM regression pass
**Status:** VERIFY  
**Priority:** Pending manual pass; non-blocking

Verify both row models independently when the manual pass is scheduled:
- explicit/manual selection;
- Current Page selection;
- Select All Filtered / All Records with exceptions;
- selected-row total updates;
- `selectionDisabled` and `readOnly` behavior;
- ordinary dirty edits and total edited-row count;
- server-converged edits;
- BASE / LOCAL / REMOTE conflicts;
- Use server / Keep my edit;
- row Save and selected Save conflict guards;
- field-aware business-action guard;
- Discard restoring latest REMOTE;
- Export Current Page;
- Export Selected for explicit / filtered / all selection;
- local-overlay revisit vs genuine server refresh;
- cache/reload behavior;
- navigation/remount/teardown without AG Grid warning #26.

A pass in Infinite does not prove SSRM and vice versa. Do not mark this complete unless the browser scenarios were actually run.

### A2. Selected-row total
**Status:** VERIFY

Implemented rule:

```text
explicit/manual/current-page -> exact include ID count
Select All Filtered          -> filteredCount - user exceptions
Select All Records           -> totalCount - user exceptions
```

Current dataset-wide limitation is intentional: normal `totalCount` / `filteredCount` may include backend-ineligible rows. Do not subtract only disabled rows currently loaded in the browser because that creates false accuracy for unloaded rows.

Future production option if exact actionable counts are required:

```text
selectionEligibleTotalCount
selectionEligibleFilteredCount
```

See `docs/selection-counts.md`.

### A3. Edited/dirty-row total
**Status:** VERIFY

The existing tracked-editing state is authoritative. `Edited` means number of dirty rows, not dirty cells. Multiple dirty fields in one row count as one edited row; conflicts remain dirty until resolved/removed from tracked state.

See `docs/edited-row-count.md`.

### A4. Export Current Page + Export Selected
**Status:** VERIFY

Implemented server-backed ownership:
- Current Page -> native AG Grid CSV export over the exact loaded pagination-page RowNodes;
- Selected -> backend resolves the same logical selection/filter target used by selection-based business actions and returns CSV.

Dataset-wide selected export must never fetch the whole selected server dataset into the browser first.

Import is intentionally separate.

See `docs/grid-export.md`.

### A5. GitHub Actions explanation
**Status:** VERIFY

`docs/github-actions-ci.md` explains workflow/event/job/step syntax, `uses` vs `run`, permissions, concurrency, Node/Python setup, `npm ci`, every validation command, failure diagnosis, and real CI findings from this repository.

### A6. Lifecycle/race hardening
**Status:** Ongoing engineering rule

Warning #26 established the policy: fix concrete lifecycle ownership/timing bugs and add regression coverage. Do not suppress warnings or build speculative frameworks.

Already protected: root GridApi pre-destroy cleanup, destroyed-API guards, datasource cancellation, request-start-order freshness, programmatic-write guards, and LOCAL-overlay vs fresh-REMOTE distinction.

## B. Client-Side Row Model baseline

### B1. Reusable Client-Side foundation
**Status:** VERIFY

Rule:

```text
same logical capability != same row-model implementation
```

Implemented native-first baseline:
- one complete bounded Transaction collection request through TanStack Query;
- native Client-Side sorting, filtering and pagination over `rowData`;
- native header selection scopes `currentPage`, `filtered` and `all`;
- Transactions demo default scope `all`;
- exact explicit selected IDs/count because the complete working set is local;
- existing `selectionDisabled` / `readOnly` native selectability adapter;
- shared tracked editing, Save/Discard and BASE/LOCAL/REMOTE conflict mechanics;
- explicit-ID backend selected status actions;
- shared native Current Page CSV helper;
- native local Selected CSV across pagination pages;
- separate Client pagination defaults with no server cache/block configuration.

The complete capability/ownership matrix lives in `docs/client-side-grid.md`.

Do **not** port Infinite unloaded-row include/exclude machinery, SSRM selection-state ownership, server datasource translation, or server cache-specific code unless a real semantic gap requires it.

Potentially reusable mechanics remain stable IDs, row capability semantics, tracked edits, Save/Discard, selected-dirty saves, conflict mechanics when locally held data is refreshed from server, validation mechanics, Grid State persistence, feature-owned actions, and presentation for selected/edited totals.

Manual `/client` verification is documented in `docs/client-side-grid.md` and remains pending until actually run.

### B2. Many Client-Side tables without repetition
**Status:** PLANNED

Assume Client Grid A/B/C/D have different columns, rows, endpoints and business rules.

Feature owns domain data, columns, validation/business rules, actions, formatting and restriction reasons. Shared Client-Side code owns only repeated Client-Side mechanics. AG Grid owns native behavior whenever possible.

The first Transactions implementation establishes shared Client-Side mechanics for pagination defaults, selection and local selected export without creating a universal grid wrapper. A second real Client table should validate whether any additional extraction is actually justified.

Do not create a universal `AgGridReact` wrapper or giant `useGrid()` just to remove a few repeated props.

### B3. Client-Side-specific docs
**Status:** VERIFY

`docs/client-side-grid.md` records:
- the Client / Infinite / SSRM capability matrix;
- data and TanStack Query ownership;
- Client-Side native AG Grid selection/filtering/pagination/export behavior;
- exact Client selected-count semantics;
- row eligibility and editing/conflict reconciliation;
- implementation map;
- limitations / row-model choice guidance;
- deferred manual verification scenarios.

`README.md`, `docs/grid-capabilities.md`, `docs/ag-grid-native-usage.md`, `docs/api-data-flow.md` and `AGENTS.md` should remain aligned with the implemented Client baseline.

## C. Capability discoverability / extraction hardening

### C1. `GRIDCAP-*` capability registry and source markers
**Status:** VERIFY

The repository now maintains `docs/grid-capability-tags.md` as the authoritative stable registry for searchable capability markers.

The markers intentionally span important extraction boundaries such as:
- Client / Infinite / SSRM concrete roots;
- row-model selection controllers;
- current-page resolution;
- server datasource loading, cancellation and request freshness;
- query/filter translation;
- tracked editing, Save/Discard and conflicts;
- selected counts;
- Current Page / Selected export;
- Grid State;
- row eligibility;
- modules/licensing/theme;
- backend logical-selection authority;
- focused executable tests.

One source boundary may have multiple markers when it participates in several capabilities. Do not tag every trivial line. A marker means the location participates in the capability; it does not mean the same implementation should be copied to every row model.

When a capability footprint changes, review the registry and current occurrences in the same work.

## D. Core/product decisions that do not block current implementation unless a real defect requires them

### D1. Post-business-action selection behavior
**Status:** DESIGN

Decide whether successful actions preserve selection, clear selection, or let each action choose. This is a feature/action decision, not a hidden shared-grid default.

### D2. Field validation + backend validation errors
**Status:** DESIGN

Design domain-neutral mechanics for invalid local values, field errors, Save guards, backend error mapping, preserving rejected LOCAL input, validation + conflict coexistence, and clearing errors on correction/revert. Business rules/messages stay feature/backend-owned.

### D3. Application-level unsaved-draft lifetime
**Status:** DESIGN

Decide behavior across route change, grid destroy/remount, browser refresh, and leaving/returning to the feature. Cache/RowNode persistence is not the same as application/session persistence.

### D4. Backend optimistic concurrency / stale-write protection
**Status:** DESIGN / DEFERRED until multi-user contract discussion

Frontend BASE/LOCAL/REMOTE reconciliation sees only remote changes that reach the browser. A stale client that never refreshes needs backend version/ETag/revision protection if the product requires it.

### D5. Undo/redo
**Status:** DEFERRED

Do not enable spreadsheet-style undo/redo until its interaction with durable dirty state, programmatic edits, conflicts, validation and Save/Discard is explicitly designed.

## E. Product-driven capabilities

### E1. Import
**Status:** DEFERRED

When required, design file formats, create/update/upsert semantics, identifiers, mapping, preview, validation, duplicates, atomic/partial success, error reports, progress and post-import refresh as a separate workflow.

Import/template/sample upload is not part of the Client-Side foundation and does not block completing the three-row-model baseline.

### E2. Conditional styling / lock indicators
**Status:** Core native approach implemented; further abstraction DEFERRED

Prefer native renderers, `cellClassRules`, tooltips and feature presentation. Do not build a custom styling engine without repeated real use cases.

### E3. Advanced permissions / conditional columns
**Status:** DEFERRED

Current row capability is intentionally small: `enabled`, `selectionDisabled`, `readOnly`. Future field/action/column authorization should remain separate from role-specific shared-grid knowledge.

### E4. User/profile Grid State persistence
**Status:** DEFERRED

Current native Grid State is behind replaceable browser storage. Add backend/user persistence only when preferences must follow users across devices/sessions.

## F. Reuse proof

### F1. Second real business entity
**Status:** TODO when available

A real Payables/Invoices/Orders-style integration should prove domain neutrality, feature-owned filters/endpoints/actions, row interaction/editing reuse, separate row-model roots and documentation quality. Do not invent a fake business feature merely to manufacture reuse.

Client-Side A/B/C/D reuse is a related proof: shared Client-Side plumbing must not be copied into every table.

## G. Advanced AG Grid — deliberately deferred

- grouped/tree/aggregation/pivot SSRM;
- advanced column management / named views;
- clipboard / range / fill-handle / mass editing;
- row create/delete.

Each requires explicit product semantics before implementation.

# Completed history

## 2026-08 — Row eligibility / selectability
Implemented `enabled / selectionDisabled / readOnly`, native loaded-row guards, backend eligibility for unloaded actions, and consistent editing/action behavior. See `docs/row-interaction.md`.

## 2026-08 — Single-row + selected-dirty editing persistence
Implemented stable-ID dirty tracking, row Save/Discard, selected dirty Save/Discard, separate single/bulk backend writes, read-only protection and safe in-flight acknowledgement. See `docs/transaction-editing.md`.

## 2026-08 — BASE / LOCAL / REMOTE reconciliation
Implemented unchanged/converged/divergent reconciliation, Use server, Keep my edit, conflict guards and Discard-to-latest-REMOTE. See `docs/edit-conflict-reconciliation.md`.

## 2026-08 — AG Grid warning #26 hardening
Implemented GridApi pre-destroy ownership cleanup, destroyed-API guards and regression coverage. Manual teardown remains in A1.

## 2026-08 — Repository CI + executable validation
Added GitHub CI without Docker: frontend lint/typecheck/tests/build and backend Django check/Transactions tests. The first run exposed two stale Discard-test expectations; those tests were corrected to the intentional editable-column + action-column refresh contract.

# Explicit non-goals unless requirements change

- universal `AgGridReact` wrapper;
- giant generic `useGrid()` hiding native AG Grid;
- configurable preserve-draft policies;
- bulk Use-all-server / Keep-all-local conflict commands;
- speculative advanced SSRM features;
- Docker for this Databricks same-repository app;
- custom abstractions that duplicate native AG Grid without a real semantic gap;
- excessive `GRIDCAP-*` markers on trivial implementation details.

> **Standing rule: Native AG Grid first. Row-model-specific capability second. Share only genuine semantics/mechanics. Feature business rules stay feature/backend-owned.**
