# Grid Foundation Backlog

This is the **single living TODO list** for unfinished grid-foundation work.

Its purpose is to keep capabilities, risks, verification work, and deferred decisions in the repository so we do not depend on chat history.

Related documents:

- `docs/grid-capabilities.md` — what the foundation supports **today**;
- `docs/ag-grid-native-usage.md` — meaningful native AG Grid modules, props, APIs, RowNode methods, events/listeners, and Grid State dependencies;
- detailed feature/contract docs — how an implemented capability works;
- this file — what is **still unfinished** and in what order we intend to address it.

If another document contains an older remaining-work list, this file is authoritative for the active backlog.

---

## Maintenance rules

Statuses:

- **VERIFY** — implementation exists but executable/manual confidence is still required.
- **DESIGN** — requirement is known, but semantics/API contract should be settled before coding.
- **TODO** — design is sufficiently understood and implementation is missing.
- **PLANNED** — intentionally scheduled after a named prerequisite.
- **DEFERRED** — possible capability that should wait for a real product requirement.

When an item is fully implemented and verified:

1. remove it from **Active backlog**;
2. add a short record under **Completed history**;
3. update `docs/grid-capabilities.md` if behavior/capability changed;
4. update `docs/ag-grid-native-usage.md` if meaningful native AG Grid dependencies changed;
5. update the relevant detailed/manual-testing doc.

Do not keep completed work in the active list merely for historical context.

---

# Agreed implementation order

We are **not** waiting for every optional/product capability before Client-Side Row Model.

The agreed sequence is:

```text
1. Stabilize the core Infinite + SSRM foundation
   - executable validation
   - manual regression
   - accurate selected-count semantics
   - explicit post-action selection behavior
   - field validation/error model if it is part of the reusable editing core

2. Build Client-Side Row Model support
   - separate row-model implementation
   - native Client-Side AG Grid first
   - reuse only genuinely row-model-neutral mechanics
   - prove that many client-side tables do not repeat client-side plumbing

3. Continue optional/product-driven capabilities
   - export
   - import
   - advanced permissions
   - advanced SSRM
   - named views, clipboard/range editing, create/delete, etc.
```

This sequencing matters. We want Client-Side to inherit a stable logical foundation, but we do **not** want export/import or other optional features to delay it unnecessarily.

---

# Active backlog

## A. Core Infinite + SSRM foundation — finish before Client-Side runtime work

### A1. Get the complete executable validation green

**Status:** VERIFY  
**Priority:** Highest

Repository CI now runs:

```text
Frontend
- npm ci
- npm run lint
- npm run typecheck
- npm run test:run
- npm run build

Backend
- install requirements
- python backend/manage.py check
- python backend/manage.py test apps.transactions
```

The first CI run proved the pipeline is useful: lint, typecheck, and backend passed, while two stale frontend Discard-test expectations failed. Those expectations were corrected to match the intentional editable-column + action-column refresh contract.

Done means the current PR has a fully green executable CI run. Do not call the foundation green before that.

---

### A2. Complete manual Infinite + SSRM regression pass

**Status:** VERIFY  
**Priority:** Highest

Verify the two server-backed row models independently. At minimum cover:

- explicit selection across pages;
- explicit IDs accumulated under different visible filters;
- Select All Filtered plus exceptions;
- Select All Records plus exceptions;
- sorting with selection;
- filter changes after explicit selection;
- filter changes after filtered-wide selection;
- `selectionDisabled` rows under manual/current-page/filtered/all selection;
- `readOnly` rows under selection/editing/actions;
- normal dirty edit with server unchanged;
- server converging to LOCAL;
- real BASE / LOCAL / REMOTE divergence;
- Use server;
- Keep my edit;
- row Save conflict guard;
- selected Save conflict guard;
- field-aware business-action conflict guard;
- Discard restoring latest REMOTE;
- page/model revisit not falsely auto-cleaning our own LOCAL overlay;
- genuine server/cache refresh reconciling REMOTE;
- navigation/remount/teardown without AG Grid warning #26.

Manual testing must treat Infinite and SSRM as separate implementations. A pass in one does not prove the other.

---

### A3. Accurate total selected-row count

**Status:** DESIGN  
**Priority:** High — explicitly requested

We need a reliable selected count for:

- manual/explicit selection;
- Current Page;
- Select All Filtered;
- Select All Records;
- dataset-wide selection after user deselection exceptions.

The important server-backed complication is:

```text
totalCount / filteredCount
!= necessarily selectable row count
```

because `selectionDisabled` and `readOnly` rows are outside the selectable universe.

Therefore do not implement this as a casual browser formula such as:

```text
filteredCount - exclusions
```

unless the count is already defined as selection-eligible.

Likely direction to evaluate:

```text
totalCount
filteredCount
eligible total count
eligible filtered count
```

or an equivalent backend-authoritative contract.

Requirements:

- correct for unloaded records;
- correct for eligible/ineligible rows;
- correct for include/exclude semantics;
- reusable across server-backed business grids;
- Infinite and SSRM may consume the metadata differently;
- Client-Side later should use native/local knowledge rather than inheriting this server-only machinery.

---

### A4. Decide post-business-action selection behavior

**Status:** DESIGN  
**Priority:** Core product semantic

Current behavior preserves selection after a successful selection-based action.

Set an explicit rule between:

```text
A. preserve selection
B. clear selection
C. let each business action choose preserve/clear
```

Questions include:

- Mark Completed/Pending/Failed behavior;
- dataset-wide selection + exceptions after success;
- destructive actions in the future;
- failed actions (normally selection should remain unchanged).

This belongs to the feature/action contract, not a hidden shared-grid default.

---

### A5. Field validation and backend validation-error model

**Status:** DESIGN  
**Priority:** High if editable-grid validation is considered part of the core before Client-Side

Tracked editing already handles dirty state, Save/Discard, in-flight acknowledgement, refresh reconciliation, and conflicts. It does not yet provide a deliberately designed reusable field-validation model.

Decide behavior for:

- invalid local values;
- field-level error presentation;
- multiple invalid fields on one row;
- row Save while invalid;
- selected Save when one selected dirty row is invalid;
- backend field validation mapped back to row + field;
- preserving rejected LOCAL input so it can be corrected;
- validation + BASE/LOCAL/REMOTE conflict on the same field;
- clearing validation on correction/revert;
- client convenience validation vs backend-authoritative business validation.

Shared editing may own domain-neutral validation state/mechanics. Actual validation rules/messages remain feature/backend-owned.

---

### A6. Continue lifecycle/race hardening when concrete issues appear

**Status:** Ongoing engineering rule  
**Priority:** As issues are discovered

Warning #26 demonstrated that intermittent AG Grid lifecycle warnings matter.

Already protected:

- root-owned `GridApi` refs cleared at grid pre-destroy;
- `api.isDestroyed()` checks around custom header cleanup/click-time API use;
- datasource request cancellation;
- programmatic selection/edit writes prevented from becoming fake user changes;
- LOCAL RowNode overlay distinguished from genuinely refreshed server data.

If future issues appear—API-after-destroy, late datasource callbacks, stale RowNodes, duplicate event feedback, selection loops, refresh/edit races—fix the ownership/timing problem and add regression coverage. Do not suppress warnings or build speculative frameworks.

---

## B. Client-Side Row Model — planned immediately after core A-items are settled

### B1. Build reusable Client-Side Row Model foundation

**Status:** PLANNED  
**Priority:** Next row-model capability after the core server-backed foundation

Client-Side is now an intentional next phase, not a speculative someday item.

The goal is **not** to copy Infinite or SSRM. The goal is to provide the same logical business-grid capabilities where they make sense while allowing the Client-Side Row Model to use its own native AG Grid behavior.

Architecture rule:

```text
same logical capability
!= same row-model implementation
```

For Client-Side, prefer native AG Grid for capabilities such as:

- local sorting;
- local filtering;
- pagination;
- ordinary checkbox selection;
- native header Select All scope (`all`, `filtered`, `currentPage`) where supported by our pinned AG Grid version;
- local selected-row traversal/counting;
- local displayed/filtered row traversal.

Do **not** port these server-backed mechanics unless a real semantic gap exists:

- Infinite unloaded-row include/exclude machinery;
- SSRM server-side selection-state ownership;
- server paging/filter/sort datasource translation;
- Infinite/SSRM cache-specific reconciliation logic.

Potentially reusable row-model-neutral mechanics include:

- stable row identity;
- `enabled / selectionDisabled / readOnly` capability semantics;
- tracked dirty editing;
- row Save/Discard semantics;
- selected-dirty Save semantics;
- BASE / LOCAL / REMOTE conflict mechanics when client-side data is refreshed from a server;
- validation mechanics once designed;
- Grid State persistence;
- feature-owned business actions and formatting helpers.

Before implementation, create a capability matrix:

```text
Capability | Client-Side | Infinite | SSRM
```

Classify each as:

```text
native
shared semantic/mechanic
row-model-specific custom
not applicable
```

This prevents accidental reuse merely for symmetry.

---

### B2. Make Client-Side reusable across many business tables

**Status:** PLANNED  
**Priority:** Same phase as B1

Assume future client-side grids A/B/C/D have different columns, endpoints, business actions, and permissions but should not repeat generic Client-Side plumbing.

Expected boundary:

```text
feature/table owns
- row type
- columns
- business validation
- API/domain actions
- formatting/presentation choices
- why a row/cell is restricted

shared row-model-neutral code owns only proven common semantics

client-side-specific shared code owns only repeated Client-Side mechanics

AG Grid owns native Client-Side behaviors whenever possible
```

Do not introduce a universal `AgGridReact` wrapper or giant `useGrid()` hook just to remove a few repeated props.

---

### B3. Client-Side-specific documentation

**Status:** PLANNED  
**Priority:** Required together with B1

When Client-Side implementation begins:

- create a dedicated Client-Side foundation/usage document;
- document the capability matrix and ownership boundaries;
- explain native Client-Side AG Grid props/APIs/events actually used;
- update `docs/ag-grid-native-usage.md` with meaningful new native dependencies;
- update `docs/grid-capabilities.md` with implemented Client-Side capabilities;
- include manual test scenarios specific to Client-Side;
- add inline `why` comments in non-obvious implementation branches, not only JSDoc.

Do not mix Client-Side-specific lifecycle/selection rules into Infinite or SSRM contracts.

---

## C. Editing/product decisions that can follow Client-Side if not promoted into core

### C1. Application-level lifetime of unsaved drafts

**Status:** DESIGN  
**Priority:** Medium

Drafts currently survive RowNode/cache recreation inside a living grid instance.

Still undecided outside that lifecycle:

```text
route change
grid destroy/remount
browser refresh
switch to another feature and return
```

Possible policies:

- discard when leaving;
- warn before navigation;
- persist for session;
- persist durably;
- feature-specific behavior.

Do not confuse cache persistence with application/session persistence.

---

### C2. Backend optimistic concurrency / stale-write protection

**Status:** DESIGN / DEFERRED until multi-user contract is discussed  
**Priority:** Important for real multi-user editing

Frontend BASE / LOCAL / REMOTE reconciliation only detects remote changes that actually reach the browser.

It cannot protect this case:

```text
User A loads v1
User B saves v2
User A never refreshes
User A saves a stale v1-based change
```

A later backend contract may use:

- row revision/version;
- ETag / If-Match;
- updated-at token;
- another optimistic concurrency mechanism.

Need to decide row vs field version semantics, bulk atomicity, selection-action behavior, stale-write response shape, and how backend-detected conflicts join the existing frontend resolver.

---

### C3. Undo/redo policy

**Status:** DEFERRED  
**Priority:** Product-driven

Before enabling spreadsheet-style undo/redo, define how it interacts with durable tracked edits, programmatic edits, conflicts, rebases, Save/Discard, and validation. Native convenience must not contradict the application editing state machine.

---

## D. Product-driven capabilities — do not block Client-Side

### D1. Export

**Status:** DESIGN / TODO

Distinguish:

1. current/loaded/local-grid export, where native AG Grid may be enough;
2. server/dataset export for logical All Filtered / All Records selections across unloaded rows.

Do not load a huge server dataset into the browser merely to export it. Server-wide export should consume logical selection + filters + export options and use backend processing when required.

Decide CSV/Excel, raw vs formatted values, visible vs all columns, selection-only semantics, and synchronous vs job-style backend export only when product requirements justify them.

---

### D2. Import

**Status:** DEFERRED until required

Import is a separate workflow. Decide file formats, create/update/upsert semantics, identifiers, mapping, preview, validation, duplicates, atomic vs partial success, error reports, large-file progress, and post-import refresh when there is a real requirement.

Do not force import into shared grid mechanics without a proven reusable integration point.

---

### D3. Conditional row/cell styling and lock indicators

**Status:** Mostly implemented; further abstraction DEFERRED

Already use native composition such as renderers, `cellClassRules`, tooltips, read-only/selection-disabled presentation, and conflict styling.

Prefer native `ColDef`/renderer/class-rule capabilities. Do not build a custom styling rule framework until multiple real features prove the need.

---

### D4. Advanced permissions / conditional columns

**Status:** DEFERRED until real authorization requirements exist

Current generic row capability remains intentionally small:

```text
enabled
selectionDisabled
readOnly
```

Future products may need field/action/column permissions. Keep authorization/business capability/column presentation separate, and never make shared grid code understand concrete user roles directly.

---

### D5. Server/user-profile Grid State persistence

**Status:** DEFERRED

Current native Grid State is persisted behind a replaceable browser-storage boundary. Add a user/profile API only when preferences must follow users across sessions/devices. Do not duplicate AG Grid state into another client-side state model.

---

## E. Reuse proof

### E1. Prove the foundation with another real business entity

**Status:** TODO when the next real table exists

Transactions is the current main consumer. A second real feature such as Payables/Invoices/Orders should validate that:

- shared mechanics are actually domain-neutral;
- business filter mapping/endpoints/actions remain feature-owned;
- row interaction/editing contracts work outside Transactions;
- row-model-specific roots stay separate;
- docs are sufficient for another developer to adopt the foundation.

Do not create a fake second business feature solely to manufacture reuse. Refactor only patterns proven common by a real integration.

Client-Side A/B/C/D reuse is a related but different proof: multiple Client-Side tables should share only real Client-Side/common mechanics rather than copy-pasting each table implementation.

---

## F. Advanced AG Grid capabilities — deliberately deferred

### F1. Grouped/tree/aggregation/pivot SSRM

**Status:** DEFERRED

Current SSRM contract is deliberately flat. Grouping/tree/pivot would require explicit datasource, backend aggregate/group route, hierarchical selection, eligibility-count, action, and refresh semantics. Do not assume today's flat include/exclude contract automatically applies.

### F2. Advanced column management / named views

**Status:** DEFERRED

Possible later work includes tool panels, named views, shared/default views, reset-to-default, and admin templates. Core Grid State persistence already exists; richer view management should follow product need.

### F3. Clipboard / range / fill-handle / mass-edit policy

**Status:** DEFERRED

Before enabling spreadsheet-style mass editing, define interaction with locked cells, dirty tracking, validation, conflicts, selected Save, server-backed scale, and backend mutation limits.

### F4. Row create/delete workflows

**Status:** DEFERRED

Current editing updates existing rows. Create/delete would need temporary identity, validation, permissions, sorting/filtering behavior, conflict/concurrency rules, selection safety, and post-mutation refresh semantics.

---

# Original capability roadmap — current mapping

This preserves the earlier ordered roadmap that drove the foundation work.

| Original order | Capability | Current state | Remaining reference |
| ---: | --- | --- | --- |
| 1 | Row eligibility / selectability | Implemented | Manual verification A2 |
| 2 | Row/cell capabilities: editable, locked/read-only, actionable | Core implemented | Rich permissions D4 |
| 3 | Dataset selection with ineligible rows | Core behavior implemented | Accurate count A3 |
| 4 | Bulk-action eligibility + backend enforcement | Implemented | Manual verification A2 |
| 5 | Unsaved edit vs server action conflict | Implemented | Verify A1/A2; stale-write concurrency C2 |
| 6 | Conditional row/cell styling + lock indicators | Core/native approach implemented | Further abstraction D3 |
| 7 | Export | Not implemented | D1 |
| 8 | Import | Not implemented | D2 |
| 9 | Advanced permissions / conditional columns | Deferred by design | D4 |

---

# Completed history

## 2026-08 — Row eligibility / selectability foundation

Completed implementation:

- generic `enabled / selectionDisabled / readOnly` row interaction states;
- native loaded-row selectability/editability integration;
- backend eligibility enforcement for unloaded selection actions;
- disabled rows outside include/exclude bookkeeping;
- editing/action behavior aligned with row capability.

Docs: `docs/row-interaction.md`, `docs/row-interaction-manual-testing.md`.

---

## 2026-08 — Single-row and selected-dirty editing persistence

Completed implementation:

- stable-ID dirty tracking;
- row Save/Discard;
- bulk Save/Discard over `dirty ∩ logical selection`;
- separate single-row and bulk backend persistence;
- read-only backend protection;
- acknowledgement that does not erase a newer edit made while an older save is in flight.

Doc: `docs/transaction-editing.md`.

---

## 2026-08 — BASE / LOCAL / REMOTE edit reconciliation

Completed implementation:

- server unchanged -> LOCAL remains dirty;
- server converged -> auto-clean;
- divergent REMOTE -> field conflict while LOCAL remains visible;
- Use server;
- Keep my edit with BASE rebase;
- conflict-aware row Save;
- conflict-aware selected Save with no silent partial save;
- field-aware business-action guard;
- Discard restores latest REMOTE.

Executable/manual verification is still tracked under A1/A2.

Doc: `docs/edit-conflict-reconciliation.md`.

---

## 2026-08 — AG Grid warning #26 teardown hardening

Completed implementation:

- custom Infinite header guards destroyed GridApi use;
- concrete roots clear their authoritative GridApi refs during pre-destroy;
- regression coverage for AG Grid destroying its API before React cleanup.

Manual teardown verification remains in A2.

---

## 2026-08 — Repository CI infrastructure

Completed implementation:

- pull-request CI against `main`;
- frontend lint/typecheck/tests/build;
- backend Django system check + Transactions tests;
- dependency caching;
- stale-run cancellation;
- no Docker.

A green run for the current branch is still required by A1; adding CI and passing CI are intentionally separate facts.

---

# Explicit non-goals unless requirements change

These are not active TODOs merely because they are technically possible:

- universal `AgGridReact` wrapper;
- giant generic `useGrid()` abstraction hiding native AG Grid;
- configurable preserve-draft refresh policies;
- bulk `Use all server` / `Keep all my edits` conflict commands;
- speculative advanced SSRM grouping/tree/pivot implementation;
- Docker infrastructure for this Databricks same-repository app;
- custom abstractions that duplicate native AG Grid without a real semantic gap.

Client-Side Row Model is **no longer a non-goal**. It is planned after the core Infinite/SSRM items above are settled, and it must remain a separate native-first row-model implementation.

The standing architecture rule is:

> **Native AG Grid first. Row-model-specific capability second. Share only genuine semantics/mechanics. Feature business rules stay feature/backend-owned.**
