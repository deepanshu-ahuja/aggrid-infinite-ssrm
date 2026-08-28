# Grid Foundation Backlog

This is the **single living TODO list** for unfinished grid-foundation work.

Its job is simple:

> Keep every meaningful unfinished grid capability, risk, verification item, and deferred design decision in one place so we can pick them one by one without relying on chat history.

This document is different from:

- `docs/grid-capabilities.md` — what the grid can do **today**;
- `docs/ag-grid-native-usage.md` — which native AG Grid features/APIs we currently use;
- detailed feature/contract docs — how an implemented capability works.

If another document contains an older "remaining work" section, **this file is authoritative for the active backlog**.

---

## How we maintain this file

### Active work

Only unfinished or not-yet-verified items belong in **Active backlog**.

Each item should record:

- why it matters;
- what is missing;
- important dependencies/decisions;
- whether it is a foundation requirement or a product-driven capability;
- its current state.

### When an item is finished

Do **not** leave completed work mixed into the active TODO list.

When an item is fully implemented **and verified**:

1. remove it from **Active backlog**;
2. add a short entry to **Completed history** with the completion date/PR/doc reference;
3. update `docs/grid-capabilities.md` if the grid gained a new capability;
4. update `docs/ag-grid-native-usage.md` if native AG Grid dependencies changed;
5. update the relevant detailed contract/manual-testing document.

This keeps the TODO list small while preserving history.

### Status vocabulary

- **VERIFY** — implementation exists but we still need executable/manual confidence.
- **DESIGN** — requirement is known but semantics/API contract must be decided first.
- **TODO** — design is sufficiently understood and implementation is still missing.
- **DEFERRED** — real possible capability, but should wait for a real product requirement.

---

# Active backlog

## A. Foundation confidence and correctness

These should be considered before adding many new optional features.

### A1. Complete executable validation after latest conflict/lifecycle changes

**Status:** VERIFY  
**Priority:** Highest before merging the current conflict work

Run the complete repository verification:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
source .venv/bin/activate
python backend/manage.py test apps.transactions
```

Why this remains active:

- the latest edit-conflict and AG Grid lifecycle fixes changed shared editing/grid-root code;
- there is currently no repository CI/status check proving the current branch green;
- older passing test output predates the current changes and cannot certify them.

Done means:

- all commands pass on the current branch;
- any failure found is fixed rather than waived without a reason.

---

### A2. Complete manual Infinite + SSRM regression pass

**Status:** VERIFY  
**Priority:** Highest before calling the foundation settled

Verify both row models independently, especially combinations that cross capabilities.

Minimum scenarios:

- explicit selection across pages;
- explicit IDs selected under different visible filters;
- Select All Filtered plus user exceptions;
- Select All Records plus user exceptions;
- sorting with selection;
- filter changes with explicit selection;
- filter changes with filtered-wide selection;
- `selectionDisabled` rows under manual/page/filtered/all selection;
- `readOnly` rows under selection/editing/actions;
- normal dirty edit with server unchanged;
- server converging to LOCAL;
- real BASE / LOCAL / REMOTE conflict;
- Use server;
- Keep my edit;
- row Save conflict guard;
- selected Save conflict guard;
- field-aware business-action conflict guard;
- Discard restoring latest REMOTE;
- page/model revisit not falsely auto-cleaning LOCAL;
- genuine refresh reconciling REMOTE;
- Infinite cache refresh and later visit to previously unloaded/evicted rows;
- SSRM refresh/reload;
- grid navigation/remount/teardown without AG Grid warning #26.

Done means the manual test documents reflect the scenarios actually verified.

---

### A3. Add normal repository CI for grid/frontend/backend verification

**Status:** TODO  
**Priority:** High quality/infrastructure item

Current validation depends too much on a developer remembering to run commands locally.

Desired capability:

- lint;
- TypeScript typecheck;
- frontend tests;
- frontend build;
- backend Transactions tests;
- PR status visible in GitHub.

Keep this lightweight. Do not add Docker just to run CI.

---

### A4. Continue lifecycle/race hardening when real AG Grid issues are found

**Status:** Ongoing rule, not a speculative rewrite  
**Priority:** As issues are discovered

Warning #26 demonstrated that intermittent lifecycle warnings matter.

Known protection already exists for:

- clearing root-owned `GridApi` refs at grid pre-destroy;
- checking `api.isDestroyed()` before custom listener cleanup/click-time API calls;
- datasource request cancellation;
- preventing our programmatic selection/edit writes from feeding back as user changes;
- distinguishing a LOCAL RowNode overlay from genuinely refreshed server data.

Future examples to treat as foundation defects if observed:

- GridApi use after destroy;
- late datasource callbacks into replaced/destroyed grids;
- duplicate/native-event feedback loops;
- stale RowNode assumptions;
- refresh/edit races;
- selection sync loops.

Do not create speculative abstractions here. Fix concrete lifecycle problems and add regression coverage.

---

## B. Selection and action semantics

### B1. Accurate total selected-row count

**Status:** DESIGN  
**Priority:** High — explicitly requested earlier

We want a reliable selected count for:

- manual / explicit selection;
- Current Page;
- Select All Filtered;
- Select All Records;
- dataset-wide selection with user deselection exceptions.

Important complication:

```text
totalCount / filteredCount
!= necessarily selection-eligible count
```

because rows may be:

```text
selectionDisabled
readOnly
```

Those rows are outside the selectable universe.

Therefore this must not be implemented as a casual browser formula such as:

```text
filteredCount - exceptionCount
```

unless the backend count already represents only selection-eligible rows.

Likely design direction to evaluate:

```text
totalCount
filteredCount
selectionEligibleCount (or equivalent authoritative metadata)
```

Potentially we may need both all-record eligible count and current-filter eligible count depending on the query/action contract.

The solution must work for unloaded rows and both Infinite + SSRM without enumerating the whole dataset in the browser.

---

### B2. Decide post-business-action selection behavior

**Status:** DESIGN  
**Priority:** Medium

Current behavior preserves selection after a successful selection-based business action.

We still need an explicit product rule:

```text
Option A -> always preserve selection
Option B -> always clear selection after success
Option C -> each business action chooses preserve/clear
```

This must be an action/product decision, not an invisible shared-grid default.

Questions to settle:

- after Mark Completed/Failed/Pending, should rows remain selected?
- should selected exceptions remain after dataset-wide actions?
- does behavior differ for destructive actions later?
- should failed actions leave selection untouched? (likely yes, but define it explicitly.)

---

### B3. Dataset selection with ineligible rows — count semantics only

**Status:** DESIGN / mostly implemented  
**Priority:** Covered mainly by B1

The core selection behavior is already implemented:

- disabled/read-only rows are outside the selection universe;
- they are not manufactured as `exclude` IDs;
- loaded rows are guarded by native AG Grid selectability;
- backend eligibility protects unloaded rows.

The remaining gap from the original capability list is **accurate dataset-wide selected counts**, tracked in B1.

This item exists only so the original roadmap dependency is not forgotten. Remove it once B1 is completed and documented.

---

## C. Editing completeness

### C1. Field validation and server validation-error model

**Status:** DESIGN  
**Priority:** High before editing is reused broadly

Current tracked editing handles dirty state, saving, discarding and refresh conflicts, but we do not yet have a deliberately designed reusable validation model for serious editable business grids.

Need to decide behavior for:

- invalid local value;
- field-level validation message;
- row with multiple invalid fields;
- preventing row Save while invalid;
- preventing selected Save when one selected dirty row is invalid;
- whether selected Save blocks completely or supports a deliberate partial policy;
- backend validation error mapped back to the exact row/field;
- keeping rejected local input visible for correction;
- validation error + BASE/LOCAL/REMOTE conflict on the same field;
- clearing validation when the user corrects/reverts a value;
- client validation vs backend-authoritative business validation.

Do not build Transactions-specific validation into shared tracked editing. Shared mechanics should remain domain-neutral while the feature owns validation rules/messages.

---

### C2. Application-level lifetime of unsaved drafts

**Status:** DESIGN  
**Priority:** Medium

Within a living grid instance, drafts already survive RowNode/cache recreation.

Still undecided: what should happen beyond the grid instance?

Examples:

```text
user edits rows
-> route changes away from the page

user edits rows
-> grid component is destroyed/remounted

user edits rows
-> browser refresh/reload

user edits rows
-> switches to another feature/grid and comes back
```

Possible product rules include:

- discard drafts when leaving the grid;
- warn before navigation;
- persist drafts for the session;
- persist drafts durably;
- feature-specific behavior.

Do not accidentally infer app-level draft persistence from our RowNode/cache persistence capability.

---

### C3. Backend optimistic concurrency / stale-write protection

**Status:** DESIGN / DEFERRED until multi-user contract is discussed  
**Priority:** Important for real multi-user editing, but separate from current frontend conflict work

Current BASE / LOCAL / REMOTE reconciliation only detects a competing server value **after authoritative remote data reaches the client**.

It cannot prevent this by itself:

```text
User A loads version 1
User B saves version 2
User A never refreshes
User A saves stale version 1-based changes
```

A production multi-user protection model may need one of:

- row revision/version;
- ETag / If-Match;
- updated-at concurrency token;
- another optimistic-concurrency contract.

Need to decide:

- row-level vs field-level version semantics;
- single-row save response;
- bulk-save atomicity when one row is stale;
- selection business actions and concurrency expectations;
- frontend presentation of backend-detected stale writes;
- how backend concurrency conflicts join the existing BASE/LOCAL/REMOTE resolver.

Do **not** confuse this with the already-implemented frontend refresh reconciliation.

---

### C4. Undo / redo policy for tracked server-backed edits

**Status:** DEFERRED  
**Priority:** Only when product requires it

AG Grid/native editing may offer undo/redo behavior, but our durable edit model also owns:

- dirty tracking;
- originals;
- server refresh reconciliation;
- conflicts;
- Save/Discard;
- programmatic bulk edits.

Before enabling/adding undo/redo, define whether it acts on:

- the immediate cell editor only;
- tracked LOCAL history;
- programmatic edits;
- conflict resolutions;
- changes after server refresh/rebase.

Do not turn on an undo feature that disagrees with durable tracked editing semantics.

---

## D. Existing roadmap capabilities still not implemented

### D1. Export

**Status:** DESIGN / TODO  
**Priority:** Product-driven

Export has at least two very different meanings.

#### Current/loaded-grid export

Potentially native AG Grid-oriented:

```text
export what is currently loaded/displayed in the browser
```

Need to decide:

- CSV vs Excel;
- visible columns vs all columns;
- formatted values vs raw values;
- current sort/filter presentation;
- selection-only export for explicitly loaded rows.

#### Server/dataset export

Required for large logical selections such as:

```text
All Filtered
All Records
exclude + exceptions
```

The browser must not load/enumerate the full dataset just to export it.

Likely architecture:

```text
logical selection
+ translated filters when needed
+ export column/options contract
-> backend export
-> file/result
```

Need to decide synchronous file response vs background/export-job semantics only when actual dataset size/product requirements demand it.

---

### D2. Import

**Status:** DESIGN / DEFERRED until required  
**Priority:** Product-driven and mostly independent

Import is a separate workflow, not a natural extension of selection.

Questions to decide when needed:

- CSV / Excel / both;
- create vs update vs upsert;
- stable identifier used for updates;
- schema/column mapping;
- preview before commit;
- client vs backend validation;
- duplicate handling;
- atomic whole-file import vs partial success;
- row-level error report;
- large-file processing/progress;
- refresh strategy after successful import;
- whether current grid filters/selection matter at all.

Keep import out of shared grid mechanics unless a proven reusable integration point appears.

---

### D3. Conditional row/cell styling and lock indicators

**Status:** Mostly implemented; DEFERRED for further abstraction  
**Priority:** Add only when another real use case appears

Already demonstrated through native AG Grid composition:

- custom cell renderers;
- `cellClassRules`;
- tooltips;
- conflict styling;
- read-only / selection-disabled presentation;
- feature-owned status/access presentation.

What is **not** currently needed is a giant custom conditional-style rules engine.

Future work should first use native `ColDef`/renderer/class-rule capabilities. Generalize only after multiple features prove a common semantic requirement.

---

### D4. Advanced permissions / conditional columns

**Status:** DEFERRED  
**Priority:** When real authorization rules exist

Current generic capability model is intentionally small:

```text
enabled
selectionDisabled
readOnly
```

Future authorization may require richer rules such as:

- can edit amount but not status;
- can execute Action A but not Action B;
- row editable only for owner/team;
- column hidden for a role;
- column visible but read-only for a role;
- action allowed only for certain row state/amount/permission combinations;
- backend authorization independent of UI visibility.

When required, distinguish clearly between:

```text
business capability
authorization permission
presentation/column visibility
```

Do not make shared grid code understand user roles directly.

---

## E. Reuse and product maturity

### E1. Prove reuse with a second real business grid

**Status:** TODO when the next real table is available  
**Priority:** Important architecture proof, but do not create a fake feature only for this

Transactions is currently the main real consumer of the foundation.

A second table such as Payables, Invoices, Orders, etc. should test whether:

- shared selection is genuinely domain-neutral;
- tracked editing is reusable without Transaction assumptions;
- row interaction modes fit another domain;
- feature filter mapping remains feature-owned;
- endpoints/business actions stay out of shared grid code;
- Infinite/SSRM roots are reusable without a giant wrapper;
- documentation is sufficient for another developer to adopt the foundation.

Treat the second real integration as an architecture test. Refactor only patterns proven common by that experience.

---

### E2. Server/user-profile persistence for Grid State

**Status:** DEFERRED  
**Priority:** When product needs preferences across sessions/devices

Current native AG Grid preference state is persisted behind `GridStateStore` using browser storage.

Persisted slices already include:

- column order;
- pinning;
- widths;
- visibility;
- filters;
- sorting.

Potential future requirement:

```text
user preference API
-> load/save native GridState for user/grid key
```

The existing storage boundary is intentionally replaceable. Do not redesign Grid State ownership just to add a server store.

---

### E3. Client-Side Row Model support

**Status:** DEFERRED / not currently a missing requirement  
**Priority:** Only if a real table fits client-side data

AG Grid Enterprise can still use the Client-Side Row Model; Enterprise does not force SSRM.

Our current project foundation focuses on server-backed Infinite + flat SSRM because that matches the real use case.

If a future table has a genuinely small dataset and benefits from client-side filtering/sorting/selection:

- evaluate native Client-Side Row Model first;
- do not force it through Infinite/SSRM abstractions;
- reuse only proven semantic helpers such as interaction/editing where they actually fit.

Do not build a third row-model root speculatively.

---

## F. Advanced AG Grid capabilities — deliberately deferred

### F1. Grouped/tree/aggregation/pivot SSRM

**Status:** DEFERRED  
**Priority:** Only for a concrete product requirement

Current SSRM contract is deliberately flat.

A future grouped/tree/pivot feature would require deliberate work on:

- datasource request contract;
- group keys/routes;
- aggregate result contract;
- pivot metadata;
- hierarchical selection state;
- backend action semantics for groups vs leaf rows;
- eligible-row counting under grouped selection;
- refresh/cache semantics.

Do not assume the current flat include/exclude contract automatically solves hierarchical selection.

---

### F2. Advanced column-management / named views

**Status:** DEFERRED  
**Priority:** Product-driven

Possible future capabilities:

- column chooser/tool panel;
- named/saved grid views;
- shared/default views;
- reset-to-default view;
- admin-provided view templates.

We already persist core native Grid State. Add richer view management only if the product needs it.

---

### F3. Clipboard / range / fill-handle / mass-edit policy

**Status:** DEFERRED  
**Priority:** Product-driven

Before enabling spreadsheet-like mass editing, decide how it integrates with:

- read-only/locked cells;
- tracked dirty state;
- validation;
- BASE/LOCAL/REMOTE conflicts;
- bulk Save;
- huge server-backed selections;
- backend mutation limits.

Do not let native convenience editing bypass our durable edit/mutation rules.

---

### F4. Row create/delete workflows

**Status:** DEFERRED  
**Priority:** Product-driven

Current editing foundation updates existing rows.

If future grids need create/delete, design separately:

- temporary/new-row identity;
- validation;
- optimistic vs server-confirmed insertion;
- interaction with sorting/filtering;
- delete permissions;
- selected/dataset-wide delete safety;
- conflict/concurrency behavior;
- refresh and selection cleanup after deletion.

---

# Original capability roadmap — mapping to current state

This section preserves the earlier ordered list that drove the foundation work.

| Original order | Capability | Current state | Active backlog reference |
| ---: | --- | --- | --- |
| 1 | Row eligibility / selectability | Implemented | Verification continues in A2 |
| 2 | Row/cell capabilities: editable, locked/read-only, actionable | Implemented core model | Richer permissions deferred to D4 |
| 3 | Dataset selection with ineligible rows | Core behavior implemented | Accurate count remains B1/B3 |
| 4 | Bulk-action eligibility + backend enforcement | Implemented | Verify combinations in A2 |
| 5 | Unsaved edit vs server action conflict | Implemented | Verify in A1/A2; backend stale-write protection is C3 |
| 6 | Conditional row/cell styling + lock indicators | Core/native approach implemented | Further abstraction deferred to D3 |
| 7 | Export | Not implemented | D1 |
| 8 | Import | Not implemented | D2 |
| 9 | More advanced permissions / conditional columns | Not implemented by design | D4 |

Once the remaining portion of an old roadmap item is completed, remove its duplicate active item(s) above and keep only the historical record here/under Completed history as appropriate.

---

# Completed history

This section records meaningful backlog items that were completed and therefore removed from Active backlog.

## 2026-08 — Row eligibility / selectability foundation

Completed:

- generic `enabled / selectionDisabled / readOnly` row interaction states;
- native loaded-row selectability integration;
- backend eligibility enforcement for unloaded selection actions;
- disabled rows kept outside include/exclude bookkeeping;
- editing/action behavior aligned with row capability.

Detailed docs:

- `docs/row-interaction.md`
- `docs/row-interaction-manual-testing.md`

---

## 2026-08 — Single-row and selected-dirty editing persistence

Completed:

- stable-ID dirty tracking;
- row Save/Discard;
- explicit bulk Save/Discard over `dirty ∩ logical selection`;
- separate single-row and bulk backend write paths;
- read-only backend protection;
- safe acknowledgement of submitted values without erasing newer in-flight edits.

Detailed doc:

- `docs/transaction-editing.md`

---

## 2026-08 — Unsaved edit vs refreshed server conflict reconciliation

Completed implementation:

- BASE / LOCAL / REMOTE state model;
- server-unchanged preservation;
- server-converged auto-clean;
- true field-level conflict detection;
- Use server;
- Keep my edit with BASE rebase;
- conflict-aware row Save;
- conflict-aware selected Save with no silent partial save;
- field-aware business-action mutation guard;
- Discard restores latest REMOTE for conflicted fields.

Still awaiting the active verification items in A1/A2 before the current PR should be considered fully certified.

Detailed doc:

- `docs/edit-conflict-reconciliation.md`

---

## 2026-08 — AG Grid warning #26 teardown hardening

Completed implementation:

- custom Infinite header checks `api.isDestroyed()` before teardown/click-time API use;
- concrete roots clear their authoritative `GridApi` ref during pre-destroy;
- regression test models AG Grid destroying its API before React disposes the custom header.

Still covered by A2 manual teardown/remount verification.

---

# Explicit non-goals unless requirements change

These are not active TODOs simply because they are technically possible:

- giant universal `AgGridReact` wrapper;
- giant generic `useGrid()` API hiding native AG Grid;
- configurable preserve-draft refresh policies;
- bulk `Use all server` / `Keep all my edits` conflict resolution;
- speculative SSRM grouping/pivot/tree support;
- speculative client-side row-model implementation;
- Docker infrastructure just to run this Databricks same-repository application;
- custom grid abstractions that duplicate native AG Grid capabilities without a proven semantic gap.

The working rule remains:

> Native AG Grid first. Row-model-specific capability second. Custom reusable application mechanics only for a real missing semantic. Feature business rules stay in the feature/backend.
