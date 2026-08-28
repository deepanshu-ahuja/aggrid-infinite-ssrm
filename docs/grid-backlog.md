# Grid Foundation Backlog

This is the **single living TODO list** for unfinished grid-foundation work. It exists so decisions and remaining work live in the repository rather than only in chat history.

Use with:
- `docs/grid-capabilities.md` — implemented logical capabilities;
- `docs/ag-grid-native-usage.md` — meaningful native AG Grid dependencies;
- detailed feature/contract docs — implementation and manual scenarios.

If another document contains an older remaining-work list, this file is authoritative.

## Maintenance rule

Statuses: **VERIFY**, **DESIGN**, **TODO**, **PLANNED**, **DEFERRED**.

When something is fully done and verified: remove it from Active backlog, record it under Completed history, and update capability/native/detailed docs when behavior or AG Grid dependencies changed.

## Agreed order

```text
1. Finish core Infinite + SSRM foundation
   - manual regression
   - accurate selected-count semantics
   - post-action selection behavior
   - field validation/error model if treated as core

2. Build Client-Side Row Model
   - separate native-first implementation
   - reuse only genuinely row-model-neutral mechanics
   - support many future client-side tables without copy/paste

3. Continue optional/product-driven work
   - export/import
   - advanced permissions
   - advanced SSRM
   - named views, mass editing, create/delete, etc.
```

We do **not** need to finish every optional backlog item before Client-Side.

# Active backlog

## A. Core Infinite + SSRM — finish before Client-Side runtime work

### A1. Manual Infinite + SSRM regression pass
**Status:** VERIFY  
**Priority:** Highest

Verify both row models independently:
- explicit selection across pages and filters;
- Select All Filtered / All Records with exceptions;
- sorting/filter changes with selection;
- `selectionDisabled` and `readOnly` behavior;
- ordinary dirty edits;
- server-converged edits;
- BASE / LOCAL / REMOTE conflicts;
- Use server / Keep my edit;
- row Save and selected Save conflict guards;
- field-aware business-action guard;
- Discard restoring latest REMOTE;
- local-overlay revisit vs genuine server refresh;
- cache/reload behavior;
- navigation/remount/teardown without AG Grid warning #26.

A pass in Infinite does not prove SSRM and vice versa.

### A2. Accurate total selected-row count
**Status:** DESIGN  
**Priority:** High

Need correct counts for manual/current-page, All Filtered, All Records, and user exceptions.

For server-backed grids:

```text
totalCount / filteredCount
!= necessarily selectable count
```

because `selectionDisabled` and `readOnly` rows are outside the selectable universe. Do not use `filteredCount - exclusions` unless the count is explicitly selection-eligible.

Evaluate backend-authoritative metadata such as eligible total + eligible filtered counts. Requirements: unloaded rows, include/exclude semantics, eligibility, Infinite + SSRM reuse without forcing identical implementations.

Client-Side later should use its native/local knowledge instead of inheriting this server-only counting machinery.

### A3. Post-business-action selection behavior
**Status:** DESIGN  
**Priority:** Core product semantic

Decide whether successful actions:
- preserve selection;
- clear selection;
- or let each action choose.

This is a feature/action decision, not a hidden shared-grid default. Failed actions should have explicitly defined behavior too.

### A4. Field validation + backend validation errors
**Status:** DESIGN  
**Priority:** High if considered part of reusable editing core

Design domain-neutral mechanics for:
- invalid local values and field errors;
- multiple invalid fields;
- row Save / selected Save guards;
- backend validation mapped to row + field;
- preserving rejected LOCAL input;
- validation + conflict on the same field;
- clearing errors on correction/revert.

Business validation rules/messages stay feature/backend-owned.

### A5. Lifecycle/race hardening
**Status:** Ongoing engineering rule

Warning #26 established the policy: fix concrete lifecycle ownership/timing bugs and add regression coverage. Do not suppress warnings or build speculative frameworks.

Already protected: root GridApi pre-destroy cleanup, `isDestroyed()` checks, datasource cancellation, programmatic-write guards, and LOCAL-overlay vs fresh-REMOTE distinction.

## B. Client-Side Row Model — next phase after core A-items

### B1. Reusable Client-Side foundation
**Status:** PLANNED

Client-Side is intentionally next, not speculative.

Rule:

```text
same logical capability != same row-model implementation
```

Prefer native Client-Side AG Grid first for sorting, filtering, pagination, checkbox selection, header Select All scopes (`all`, `filtered`, `currentPage` where supported by our pinned version), selected-row traversal/counting, and local filtered/displayed traversal.

Do **not** port Infinite unloaded-row include/exclude machinery, SSRM selection-state ownership, server datasource translation, or server cache-specific code unless a real semantic gap requires it.

Potentially reusable mechanics: stable IDs, row capability semantics, tracked edits, Save/Discard, selected-dirty saves, conflict mechanics when locally held data is refreshed from server, validation mechanics, Grid State persistence, and feature-owned business actions.

Before coding, create:

```text
Capability | Client-Side | Infinite | SSRM
```

and classify each capability as native / shared mechanic / row-model-specific / N/A.

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

Do not mix Client-Side-specific rules into Infinite/SSRM contracts.

## C. Editing/product decisions that may follow Client-Side

### C1. Application-level unsaved-draft lifetime
**Status:** DESIGN

Decide behavior across route change, grid destroy/remount, browser refresh, and leaving/returning to the feature. Cache/RowNode persistence is not the same as session/application persistence.

### C2. Backend optimistic concurrency / stale-write protection
**Status:** DESIGN / DEFERRED until multi-user contract discussion

Frontend BASE/LOCAL/REMOTE reconciliation only sees remote changes that reach the browser. A stale client that never refreshes still needs backend version/ETag/revision-style protection if the product requires it.

Later decide row vs field version semantics, bulk atomicity, selection actions, stale-write responses, and integration with the existing conflict resolver.

### C3. Undo/redo
**Status:** DEFERRED

Do not enable spreadsheet-style undo/redo until its interaction with durable dirty state, programmatic edits, conflicts, validation and Save/Discard is explicitly designed.

## D. Product-driven capabilities — do not block Client-Side

### D1. Export
**Status:** DESIGN / TODO

Separate local/current-grid export from server/dataset export. Dataset-wide All Filtered / All Records export must not force the browser to load the entire server dataset. Decide CSV/Excel, raw/formatted values, columns, selection semantics and backend job behavior when required.

### D2. Import
**Status:** DEFERRED

When required, design file formats, create/update/upsert, identifiers, mapping, preview, validation, duplicates, atomic/partial success, error reports, progress and post-import refresh as a separate workflow.

### D3. Conditional styling / lock indicators
**Status:** Core native approach implemented; further abstraction DEFERRED

Prefer native renderers, `cellClassRules`, tooltips and feature presentation. Do not build a custom styling engine without repeated real use cases.

### D4. Advanced permissions / conditional columns
**Status:** DEFERRED

Current row capability is intentionally small: `enabled`, `selectionDisabled`, `readOnly`. Future field/action/column authorization should remain separate from role-specific shared-grid knowledge.

### D5. User/profile Grid State persistence
**Status:** DEFERRED

Current native Grid State is behind replaceable browser storage. Add backend/user persistence only when preferences must follow users across devices/sessions.

## E. Reuse proof

### E1. Second real business entity
**Status:** TODO when available

A real Payables/Invoices/Orders-style integration should prove domain neutrality, feature-owned filters/endpoints/actions, row interaction/editing reuse, separate row-model roots and documentation quality. Do not invent a fake business feature merely to manufacture reuse.

Client-Side A/B/C/D reuse is a related proof: shared Client-Side plumbing must not be copied into every table.

## F. Advanced AG Grid — deliberately deferred

- **Grouped/tree/aggregation/pivot SSRM** — requires explicit hierarchical datasource, selection, eligibility-count, action and refresh contracts.
- **Advanced column management / named views** — only when product needs richer view management.
- **Clipboard / range / fill-handle / mass editing** — must integrate with locks, dirty state, validation, conflicts and backend mutation limits.
- **Row create/delete** — separate identity, permission, validation, selection, conflict and refresh semantics required.

# Original roadmap mapping

| # | Capability | State | Remaining |
| ---: | --- | --- | --- |
| 1 | Row eligibility / selectability | Implemented | A1 manual verification |
| 2 | Row/cell editable/read-only/actionable capabilities | Core implemented | D4 for richer permissions |
| 3 | Dataset selection with ineligible rows | Core implemented | A2 selected counts |
| 4 | Bulk-action eligibility + backend enforcement | Implemented | A1 manual verification |
| 5 | Unsaved edit vs server action conflict | Implemented | A1 verification; C2 stale-write protection |
| 6 | Conditional styling + lock indicators | Core/native implemented | D3 only if more abstraction needed |
| 7 | Export | Not implemented | D1 |
| 8 | Import | Not implemented | D2 |
| 9 | Advanced permissions / conditional columns | Deferred | D4 |

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
Added GitHub CI without Docker: frontend lint/typecheck/tests/build and backend Django check/Transactions tests. The first run exposed two stale Discard-test expectations; those tests were corrected to the intentional editable-column + action-column refresh contract. The follow-up CI run on `grid-foundation` completed successfully on 2026-08-28.

# Explicit non-goals unless requirements change

- universal `AgGridReact` wrapper;
- giant generic `useGrid()` hiding native AG Grid;
- configurable preserve-draft policies;
- bulk Use-all-server / Keep-all-local conflict commands;
- speculative advanced SSRM features;
- Docker for this Databricks same-repository app;
- custom abstractions that duplicate native AG Grid without a real semantic gap.

Client-Side Row Model is **not** a non-goal anymore. It is planned after the core Infinite/SSRM items above.

> **Standing rule: Native AG Grid first. Row-model-specific capability second. Share only genuine semantics/mechanics. Feature business rules stay feature/backend-owned.**
