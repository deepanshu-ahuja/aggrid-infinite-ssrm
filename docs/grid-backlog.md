# Grid Foundation Backlog

This is the **single living TODO/control list** for unfinished grid-foundation work. It exists so decisions and remaining work live in the repository rather than only in chat history.

Use it with:
- `docs/grid-capabilities.md` — implemented logical capabilities;
- `docs/ag-grid-native-usage.md` — meaningful native AG Grid dependencies;
- `docs/selection-edit-export.md` — current selected-count, edited-count and export semantics;
- detailed feature/manual-test docs.

The backlog is a tracking/control document. It is **not** a rule that every item must be completed before Client-Side Row Model starts.

## Maintenance rule

Statuses: **VERIFY**, **DESIGN**, **TODO**, **PLANNED**, **DEFERRED**.

When something is fully implemented and verified, remove it from Active backlog, record it under Completed history, and update capability/native/detailed docs when behavior or AG Grid dependencies changed.

## Current agreed sequence

```text
1. Finish the small pre-Client baseline
   - selected-row total
   - edited/dirty-row total semantics
   - Export Current Page + Export Selected
   - CI explanation docs
   - focused automated + manual verification

2. Start Client-Side Row Model
   - separate native-first implementation
   - match the proven user-facing capabilities where they make sense
   - reuse only genuinely row-model-neutral mechanics

3. From that baseline onward
   - evaluate new grid-foundation capabilities across Client / Infinite / SSRM together
   - do NOT force the three row models through identical implementation

4. Product-driven work continues when needed
   - import
   - richer validation/permissions
   - concurrency
   - advanced SSRM
   - named views/mass editing/create-delete/etc.
```

Only a genuine core Infinite/SSRM correctness defect should interrupt Client-Side once the small baseline above is verified.

# Active backlog

## A. Pre-Client baseline

### A1. Manual Infinite + SSRM regression pass
**Status:** VERIFY  
**Priority:** Highest

Verify both row models independently:
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

A pass in Infinite does not prove SSRM and vice versa.

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

See `docs/selection-edit-export.md`.

### A3. Edited/dirty-row total
**Status:** VERIFY

The existing tracked-editing state is authoritative. `Edited` means number of dirty rows, not dirty cells. Multiple dirty fields in one row count as one edited row; conflicts remain dirty until resolved/removed from tracked state.

See `docs/selection-edit-export.md`.

### A4. Export Current Page + Export Selected
**Status:** VERIFY

Implemented ownership:
- Current Page -> native AG Grid CSV export over the exact loaded pagination-page RowNodes;
- Selected -> backend resolves the same logical selection/filter target used by selection-based business actions and returns CSV.

Dataset-wide selected export must never fetch the whole selected server dataset into the browser first.

Import is intentionally separate and does not block Client-Side.

### A5. GitHub Actions explanation
**Status:** VERIFY

`docs/github-actions-ci.md` explains workflow/event/job/step syntax, `uses` vs `run`, permissions, concurrency, Node/Python setup, `npm ci`, every validation command, failure diagnosis, and the first real CI finding from this repository.

### A6. Lifecycle/race hardening
**Status:** Ongoing engineering rule

Warning #26 established the policy: fix concrete lifecycle ownership/timing bugs and add regression coverage. Do not suppress warnings or build speculative frameworks.

Already protected: root GridApi pre-destroy cleanup, destroyed-API guards, datasource cancellation, programmatic-write guards, and LOCAL-overlay vs fresh-REMOTE distinction.

## B. Client-Side Row Model — next implementation phase

### B1. Reusable Client-Side foundation
**Status:** PLANNED

Rule:

```text
same logical capability != same row-model implementation
```

Prefer native Client-Side AG Grid first for sorting, filtering, pagination, checkbox selection, header Select All scopes (`all`, `filtered`, `currentPage` where supported by the pinned version), selected-row traversal/counting, local filtered/displayed traversal and local export.

Do **not** port Infinite unloaded-row include/exclude machinery, SSRM selection-state ownership, server datasource translation, or server cache-specific code unless a real semantic gap requires it.

Potentially reusable mechanics: stable IDs, row capability semantics, tracked edits, Save/Discard, selected-dirty saves, conflict mechanics when locally held data is refreshed from server, validation mechanics, Grid State persistence, feature-owned actions, and presentation for selected/edited totals.

Before coding, maintain a capability matrix:

```text
Capability | Client-Side | Infinite | SSRM
```

Classify each capability as native / shared mechanic / row-model-specific / N/A.

### B2. Many Client-Side tables without repetition
**Status:** PLANNED

Assume Client Grid A/B/C/D have different columns, rows, endpoints and business rules.

Feature owns domain data, columns, validation/business rules, actions, formatting and restriction reasons. Shared Client-Side code owns only repeated Client-Side mechanics. AG Grid owns native behavior whenever possible.

Do not create a universal `AgGridReact` wrapper or giant `useGrid()` just to remove a few repeated props.

### B3. Client-Side-specific docs
**Status:** PLANNED

When implementation starts:
- create a dedicated Client-Side foundation/usage doc;
- document the capability matrix and ownership boundaries;
- explain Client-Side-specific native AG Grid props/APIs/events used;
- update `docs/ag-grid-native-usage.md` and `docs/grid-capabilities.md`;
- add Client-Side manual scenarios;
- put inline `why` comments in non-obvious logic, not only JSDoc.

## C. Core/product decisions that do not block Client-Side unless a real defect requires them

### C1. Post-business-action selection behavior
**Status:** DESIGN

Decide whether successful actions preserve selection, clear selection, or let each action choose. This is a feature/action decision, not a hidden shared-grid default.

### C2. Field validation + backend validation errors
**Status:** DESIGN

Design domain-neutral mechanics for invalid local values, field errors, Save guards, backend error mapping, preserving rejected LOCAL input, validation + conflict coexistence, and clearing errors on correction/revert. Business rules/messages stay feature/backend-owned.

### C3. Application-level unsaved-draft lifetime
**Status:** DESIGN

Decide behavior across route change, grid destroy/remount, browser refresh, and leaving/returning to the feature. Cache/RowNode persistence is not the same as application/session persistence.

### C4. Backend optimistic concurrency / stale-write protection
**Status:** DESIGN / DEFERRED until multi-user contract discussion

Frontend BASE/LOCAL/REMOTE reconciliation sees only remote changes that reach the browser. A stale client that never refreshes needs backend version/ETag/revision protection if the product requires it.

### C5. Undo/redo
**Status:** DEFERRED

Do not enable spreadsheet-style undo/redo until its interaction with durable dirty state, programmatic edits, conflicts, validation and Save/Discard is explicitly designed.

## D. Product-driven capabilities

### D1. Import
**Status:** DEFERRED

When required, design file formats, create/update/upsert semantics, identifiers, mapping, preview, validation, duplicates, atomic/partial success, error reports, progress and post-import refresh as a separate workflow.

### D2. Conditional styling / lock indicators
**Status:** Core native approach implemented; further abstraction DEFERRED

Prefer native renderers, `cellClassRules`, tooltips and feature presentation. Do not build a custom styling engine without repeated real use cases.

### D3. Advanced permissions / conditional columns
**Status:** DEFERRED

Current row capability is intentionally small: `enabled`, `selectionDisabled`, `readOnly`. Future field/action/column authorization should remain separate from role-specific shared-grid knowledge.

### D4. User/profile Grid State persistence
**Status:** DEFERRED

Current native Grid State is behind replaceable browser storage. Add backend/user persistence only when preferences must follow users across devices/sessions.

## E. Reuse proof

### E1. Second real business entity
**Status:** TODO when available

A real Payables/Invoices/Orders-style integration should prove domain neutrality, feature-owned filters/endpoints/actions, row interaction/editing reuse, separate row-model roots and documentation quality. Do not invent a fake business feature merely to manufacture reuse.

Client-Side A/B/C/D reuse is a related proof: shared Client-Side plumbing must not be copied into every table.

## F. Advanced AG Grid — deliberately deferred

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
- custom abstractions that duplicate native AG Grid without a real semantic gap.

> **Standing rule: Native AG Grid first. Row-model-specific capability second. Share only genuine semantics/mechanics. Feature business rules stay feature/backend-owned.**
