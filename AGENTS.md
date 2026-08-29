# AGENTS.md — Project Handoff and AI Working Contract

This file is the durable handoff for developers and coding assistants working on this repository.

**If a new chat/session starts, read this file first.** Do not rely on memory from an earlier conversation. Reconstruct current state from the repository and GitHub.

Keep this file current whenever a meaningful architecture rule, workflow rule, capability contract, discoverability contract, or roadmap decision changes.

---

## New-chat bootstrap

A user can paste this entire file into a new chat, or give the assistant this instruction:

> Open `deepanshu-ahuja/aggrid-infinite-ssrm`. Read root `AGENTS.md` first, then inspect current `main`, `grid-foundation`, open PRs, relevant source-of-truth docs, current implementation and tests. Do not rely on previous-chat memory. Continue using the repository's documented architecture, capability-tag, testing, documentation and PR standards.

Before writing code, briefly report:

1. current repository / branch / PR state;
2. relevant source-of-truth docs read;
3. current architecture relevant to the task;
4. any conflict between the request and documented behavior;
5. intended change and validation plan.

Do not ask questions that repository inspection can answer.

---

## Repository and product intent

Repository:

`deepanshu-ahuja/aggrid-infinite-ssrm`

This is a **production-oriented reusable AG Grid foundation/reference implementation**, not a disposable POC.

Current stack includes:

- React 19;
- TypeScript;
- Vite;
- AG Grid 36.x;
- AG Grid Client-Side Row Model;
- AG Grid Community Infinite Row Model;
- AG Grid Enterprise Server-Side Row Model (SSRM);
- Django + Django REST Framework backend;
- TanStack Query at normal application/API boundaries such as the Client-Side collection flow;
- frontend and backend in one repository;
- Databricks Apps as deployment target.

Do not add Docker or unrelated infrastructure unless explicitly required.

---

## Source-of-truth reading order

Before changing a capability, inspect current code and GitHub state. Never assume an old PR is still open or an old branch is ahead of `main`.

Start with:

1. `AGENTS.md`;
2. `README.md`;
3. `docs/frontend-conventions.md`;
4. `docs/grid-capability-tags.md`;
5. `docs/grid-backlog.md`;
6. `docs/grid-capabilities.md`;
7. `docs/ag-grid-native-usage.md`;
8. `docs/api-data-flow.md`.

Then read capability-specific docs as applicable, including:

- `docs/client-side-grid.md`;
- `docs/selection-counts.md`;
- `docs/selected-action-selection-lifecycle.md`;
- `docs/grid-export.md`;
- `docs/edited-row-count.md`;
- `docs/pre-client-manual-testing.md`;
- `docs/transaction-editing.md`;
- `docs/edit-conflict-reconciliation.md`;
- `docs/row-interaction.md`;
- `docs/row-interaction-manual-testing.md`;
- `docs/server-backed-grid-reuse.md`;
- `docs/github-actions-ci.md`;
- `docs/ag-grid.md`;
- `docs/ag-grid-foundation-status.md`.

For configurable-table architecture discussions, also inspect:

- `docs/configurable-table-architecture-brief.md` — standalone target-architecture brief;
- `docs/metadata-driven-table-architecture.md` — detailed proposal/discussion document.

If code and docs disagree, do not silently choose one. Determine intended/current behavior and fix the inconsistency as part of the work.

GitHub `main` plus the current working branch/open PR is the source of truth for repository state.

---

## Definition of done

A meaningful capability is not complete with code alone.

Expected deliverables normally include:

- production-quality implementation;
- focused automated tests;
- useful inline rationale for non-obvious logic;
- architecture / feature documentation;
- explicit limitations and extension points;
- manual verification guidance where browser / AG Grid lifecycle behavior matters;
- capability-tag registry/marker review when the frontend capability footprint changes;
- backlog/status updates;
- CI validation;
- accurate PR description.

A developer should be able to understand behavior from the repository without reconstructing chat history or Git archaeology.

Feature documentation should explain, where relevant:

- user-visible behavior;
- included/excluded scope;
- frontend versus backend ownership;
- native AG Grid APIs used;
- custom logic and why it exists;
- Client-Side versus Infinite versus SSRM differences;
- selection/edit/eligibility implications;
- edge cases and races;
- limitations;
- production extension path;
- exact manual verification steps.

Do not leave core behavior merely inferable from implementation.

---

## Capability-tag discoverability contract

`docs/grid-capability-tags.md` is the **authoritative registry** of searchable frontend `GRIDCAP-*` markers.

Working rule:

```text
need one frontend grid capability
→ find its GRIDCAP-* entry
→ read row-model/ownership notes
→ search exact marker across frontend source/tests
→ review every marked frontend integration point + linked docs
→ separately inspect required API/backend contracts
```

Rules:

- every marker starts with `GRIDCAP-`;
- markers belong in frontend source and focused frontend tests only;
- do not add them to Python/backend source or tests;
- do not invent ad-hoc markers in source; define a genuinely new marker in the registry first;
- reuse one logical marker across row models when they implement the same user/business capability differently;
- one source location may carry multiple markers when it participates in several capabilities;
- mark extraction-relevant boundaries, not every trivial helper/line;
- a marker means participation, not copy-paste equivalence;
- preserve accurate markers during refactors;
- review registry and occurrences when a frontend capability changes;
- avoid casual marker renames;
- backend authority, validation, eligibility and persistence remain first-class even though backend code is intentionally untagged.

Row-model markers include:

```text
GRIDCAP-ROWMODEL-CLIENT
GRIDCAP-ROWMODEL-INFINITE
GRIDCAP-ROWMODEL-SSRM
```

Feature markers include examples such as:

```text
GRIDCAP-SEL-FILTERED
GRIDCAP-EXPORT-SELECTED
GRIDCAP-EDIT-CONFLICT
GRIDCAP-LIFECYCLE-DESTROY
```

Do not use capability markers as an excuse to create a universal wrapper. Concrete integration roots are intentionally visible.

---

## Comment and JSDoc preservation rule

**Preserve useful explanatory comments by default.**

Do not remove or shorten comments merely to make a file smaller.

Keep explanations that document:

- architecture or ownership;
- lifecycle;
- state transitions;
- race conditions;
- non-obvious AG Grid behavior;
- native-versus-custom responsibility;
- selection semantics;
- backend authority;
- cache / refresh behavior;
- source-of-truth rationale;
- intentional row-model differences;
- accurate capability markers.

Rewrite/remove only when logic changed, the explanation is obsolete, or it is objectively noise.

When adding non-obvious logic, add comments near that logic explaining **why**, not syntax.

Do not add console logging merely to understand flow. Prefer clear code, comments, tests, markers and isolated dev tooling.

---

## Architecture principles

For each grid concern, prefer:

1. native AG Grid capability;
2. row-model-specific native AG Grid capability;
3. custom application logic only for a real semantic gap.

Do not create a universal `AgGridReact` wrapper or giant `useGrid()` hook that hides AG Grid lifecycle.

Concrete grid roots remain visible and own their `GridApi`.

Reuse semantic helpers when semantics are genuinely shared, but do not force Client-Side, Infinite and SSRM into one controller when their native capabilities differ.

Promote code to `shared/grid` only when genuinely domain-neutral. Transaction fields, API mapping, business actions, validation rules/messages and feature UI remain feature/backend-owned.

Do not introduce an abstraction merely because two callers repeat a few lines. A shared abstraction should own a real responsibility such as lifecycle, validation, normalization, algorithmic behavior, third-party adaptation, retry/cancellation, or another stable boundary.

Use TanStack Query at normal application/API boundaries when useful, but do not force it into AG Grid datasource loading merely for consistency. AG Grid datasource lifecycle may naturally own server-grid loading.

---

## Current row-model baseline

Client-Side, Infinite and SSRM are separate real implementations/routes so each can be verified independently:

```text
/client
/infinite
/ssrm
```

The repository demonstrates all three, but a real product may deliberately use only one or a subset. **Do not create dependencies that require all three row models to exist together.**

### Client-Side

Client receives the complete bounded Transaction working set through TanStack Query and passes editable row copies to native AG Grid `rowData`.

AG Grid owns local sorting, filtering, pagination and selection.

Native selection scopes are:

```text
page      → rowSelection.selectAll = 'currentPage'
filtered  → rowSelection.selectAll = 'filtered'
all       → rowSelection.selectAll = 'all'
```

Client selected IDs/count are exact because the complete working set is local and native `isRowSelectable` prevents restricted rows from entering selection.

Selected export is local/native. Selected business actions send explicit IDs to backend authority.

### Infinite

Infinite only has concrete RowNodes for loaded rows.

Native explicit/page selection remains native where possible. Filtered/all dataset-wide selection uses compact include/exclude state only because unloaded rows cannot be represented natively.

### SSRM

SSRM uses native Enterprise server-side selection state where AG Grid provides the required behavior. Application-owned state exists only for missing product semantics, notably current Select All Filtered behavior.

Do not move all SSRM selection into React merely to make it resemble Infinite.

### Shared semantic name does not mean shared implementation

Selection controllers are deliberately separate:

```text
useClientSideSelectionController()
useInfiniteSelectionController()
useSsrmSelectionController()
```

They may expose similarly named operations such as `clearSelection()`, but each implementation owns its row-model-specific mechanics.

Do not replace them with one `clearSelection(rowModelType)` switch or one universal selection controller.

---

## Selected-row count contract

### Client-Side

```text
selected count
→ api.getSelectedRows().length
```

### Infinite + SSRM

Server-backed baseline:

```text
Explicit / manual / current-page
→ exact selected IDs

Select All Records
→ API totalCount - explicit user deselection exceptions

Select All Filtered
→ API filteredCount - explicit user deselection exceptions
```

Selection mechanics remain row-model-specific; dataset-wide count source is intentionally consistent.

Do not reintroduce a separate Infinite count source such as `isLastRowIndexKnown()` without a demonstrated reason and deliberate documented reconsideration.

---

## Request freshness / out-of-order responses

Both server-backed datasources protect renderable count metadata from out-of-order responses.

Rule:

**the latest STARTED request owns renderable `totalCount` / `filteredCount`.**

```text
request A starts
request B starts after A

B resolves
→ B may publish counts

A resolves later
→ A may finish AG Grid loading lifecycle
→ A MUST NOT overwrite B's counts
```

This is based on request-start order, not page number. Keep forward and backward ordering tests for both Infinite and SSRM.

---

## Filter-dependent selection reset

Select All Filtered is defined by the current filter universe.

```text
Select All Filtered
→ defining filter changes
→ clear/reset filtered-wide selection

Select All Records
→ filter changes
→ still means complete dataset

ordinary explicit/manual IDs
→ do not silently become a new filtered-wide selection
```

---

## Row interaction and backend eligibility

Rows may carry backend-provided interaction modes such as:

- `enabled`;
- `selectionDisabled`;
- `readOnly`.

Frontend prevents invalid interactions where possible; backend remains authoritative.

Do not confuse:

```text
user exception IDs
→ rows explicitly deselected by user

backend eligibility
→ rows business rules allow an operation to affect
```

---

## Count eligibility limitation

For dataset-wide server-backed selection, current `totalCount` / `filteredCount` describe dataset/query membership, not exact operation eligibility.

Do not subtract only restricted rows currently loaded in browser because unloaded pages may contain more restricted rows and that creates false precision.

If product later requires exact actionable counts, backend may provide eligibility-aware metadata such as:

```text
selectionEligibleTotalCount
selectionEligibleFilteredCount
```

Do not add that contract until a product requirement justifies it.

---

## Export contract

### Current Page

Use native AG Grid CSV export over exactly the fully resolved current pagination page.

If the page is not fully resolved, refuse partial export rather than silently exporting an incomplete page.

Current Page is a page snapshot, so displayed `selectionDisabled` / `readOnly` rows are included.

### Selected — Client-Side

Use native/local AG Grid selected-row CSV because every selected row is present in browser memory.

### Selected — Infinite / SSRM

Backend owns dataset-wide selected export because logical selection may include unloaded rows.

```text
row-model-specific selection state
        ↓
common logical selection target
        ↓
backend selection resolver
        ↓
authoritative eligible rows
        ↓
CSV
```

Server-backed Selected export excludes backend-ineligible rows through backend authority.

---

## Operation-neutral backend selection resolver

Selected business operations should reuse one backend resolver for logical selection.

Conceptually:

```text
include + IDs
→ exact named rows
→ authoritative eligibility

exclude + filters
→ all eligible matching rows minus explicit user exceptions

exclude without filters
→ all eligible records minus explicit user exceptions
```

Selection answers **which rows**. Business operation answers **what to do**.

Different business actions may use different endpoints/mutations while still reusing the same logical selection target/resolver semantics.

---

## Business-action selection lifecycle

Do not carry a configurable `clear` / `preserve` policy through normal hardcoded actions when their selection behavior is already known.

Current Transaction status buttons are one **Change Status** action family with one endpoint and different status values. That mutation always clears selection on success because the changed status may alter the filter/selection universe.

Current pattern:

```text
Change Status mutation
→ backend succeeds
→ concrete grid root calls its existing clearSelection()
→ refresh authoritative rows
```

If backend fails, the success callback does not run and selection remains available for inspection/retry.

An action that should preserve selection simply does not call `clearSelection()`.

Do not create a no-op preserve function or policy `if/else` merely because another theoretical behavior exists.

### Multiple real business actions

Different business actions own their own endpoint and payload, for example:

```text
Change Status → status update mutation
Approve       → approval mutation
Assign Owner  → assignment mutation
```

Do not make one generic selection-action mutation choose unrelated endpoints from an action key.

Each action may call the current row model's existing `clearSelection()` on success when required.

### Future config-driven actions

If a future configurable action system genuinely needs behavior selected by metadata, use a safe frontend registry lookup from a JSON-safe key to executable behavior. Introduce that only when the dynamic use case exists.

Do not turn today's known action behavior into premature configuration.

Detailed contract: `docs/selected-action-selection-lifecycle.md`.

---

## Editing / dirty-row baseline

Tracked editing state lives outside transient RowNodes so dirty work can survive row recreation/cache lifecycle where required.

Edited count means dirty rows, not dirty fields:

```text
3 dirty fields in one row
→ edited row count = 1
```

Conflict behavior follows BASE / LOCAL / REMOTE as documented in:

- `docs/transaction-editing.md`;
- `docs/edit-conflict-reconciliation.md`.

Do not simplify the model accidentally.

Client reuses the same tracked-edit/conflict semantics but receives fresh authoritative data through TanStack Query / `rowData` replacement rather than a server cache/store lifecycle.

---

## Validation architecture — next implementation

Validation is a **first-class capability independent of configurable-table metadata**.

Static Transaction configuration must be able to use validation directly. A future metadata compiler may later produce the same validation inputs, but validation must not be architecturally dependent on metadata.

### Validation rule contract

The validation engine should consume a resolved array of registered rule keys plus JSON-safe params/messages, conceptually:

```text
rules: [
  { key: required },
  { key: maxLength, params: { max: 100 } },
  { key: numberRange, params: { min: 0, max: 1000000 } }
]
```

Frontend owns executable validator functions through a registry.

A reusable higher-level `ruleSetKey` may be introduced later only if repeated real rule combinations justify it. The validation engine itself should consume resolved rules rather than opaque profiles.

Do not accept arbitrary backend JavaScript/expression code.

### Validation state and editing interaction

Required behavior:

```text
user enters invalid value
→ keep LOCAL input visible
→ keep row dirty
→ record field validation error outside transient RowNodes
→ block relevant Save
→ allow user to correct or discard
```

Validation state should be keyed by stable row ID + field.

Backend remains authoritative. Structured backend field validation errors should map into the same validation state while preserving rejected LOCAL input.

Errors should clear/re-evaluate when the user corrects or reverts a field.

### Validation and conflict are separate

```text
Validation
→ is LOCAL value acceptable?

Conflict
→ did REMOTE diverge from BASE while LOCAL edit exists?
```

A field may be invalid, conflicted, or both. Do not collapse the two states.

Save guards, presentation, correction/revert behavior, backend mapping and Client/Infinite/SSRM integration must be covered by focused tests and documentation.

Review `docs/grid-capability-tags.md` before adding a validation marker.

---

## Import — next after validation

Import is a separate workflow, not ordinary grid editing.

Design and implement after validation, covering as required:

- accepted file/template formats;
- create/update/upsert semantics;
- stable identifiers;
- field mapping;
- preview/dry-run;
- validation reuse where appropriate;
- duplicate handling;
- atomic vs partial success;
- row/field error reporting;
- downloadable error output if useful;
- progress/cancellation for large jobs if required;
- authoritative post-import refresh.

Do not hide Import inside normal edit persistence.

---

## Configurable-table experiment — after Import

Build configurable-table runtime work first as an **isolated fourth SSRM-based grid path**.

Purpose: prove the correct metadata compiler/resolver/registry composition boundary without risking the three proven Transaction grids.

Rules:

- do not refactor `/client`, `/infinite`, or `/ssrm` merely to make the experiment work;
- do not rewrite shared loading, selection, tracked editing, conflict, freshness, lifecycle or Grid State algorithms while the experiment is still proving its boundary;
- intentional temporary feature-level duplication is acceptable when it protects proven behavior and makes comparison explicit;
- build compiler/resolver/registry logic in the isolated path first;
- metadata may describe fields, labels, renderers, editors, formatters, validation, authorization, actions and other supported business/UI composition;
- frontend/application chooses which AG Grid row model(s) the product supports;
- backend metadata does **not** dynamically choose Client/Infinite/SSRM;
- backend sends JSON-safe application metadata, never AG Grid `ColDef` with executable code;
- executable renderers/editors/formatters/validators/action behaviors remain frontend registry implementations;
- only after the fourth grid proves the architecture should existing Transaction composition be evaluated for migration;
- migration is not automatic merely because the experiment works.

The lower generic row-model mechanics are treated as protected while the composition boundary is being proven.

---

## Current roadmap discipline

Always read `docs/grid-backlog.md` before deciding the next capability.

Current high-level sequence:

1. Client-Side, Infinite and SSRM baselines exist with focused automated coverage; manual browser verification remains available for a later consolidated pass;
2. selected Change Status success lifecycle is simplified: business request only, direct row-model `clearSelection()` after success;
3. implement field/input validation as an independent capability using resolved `rules[]`;
4. design/implement Import as a separate workflow;
5. build the isolated fourth configurable SSRM-based experiment;
6. only after that experiment is proven, evaluate whether any proven composition should replace Transaction-specific composition in existing grids;
7. application-level draft lifetime, backend concurrency, grouped/tree/aggregation/pivot and other advanced capabilities remain deferred until product need.

**When this sequence changes, update this file and `docs/grid-backlog.md` together.**

---

## Testing expectations

Meaningful behavior changes should have focused tests at stable boundaries, including as applicable:

- request mapping;
- datasource lifecycle;
- forward/backward request ordering;
- stale-filter behavior;
- selection transformations;
- selected counts;
- business-action success lifecycle and row-model-specific clear behavior;
- validation rule execution/state/Save guards;
- backend validation error mapping;
- backend selection resolution;
- export semantics;
- eligibility;
- edit/conflict reconciliation;
- Client-Side native scope mapping and exact local selection;
- capability-marker searches when frontend footprint changes.

Test Client-Side, Infinite and SSRM independently where lifecycle or selection implementation differs. Share helpers only for genuinely shared semantics.

Typical frontend verification:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Typical backend verification:

```bash
python backend/manage.py check
python backend/manage.py test apps.transactions
```

Inspect GitHub Actions after pushing.

Do not claim browser/manual verification unless it was actually performed.

---

## Git and PR workflow

GitHub is repository-state source of truth.

Before making changes:

- inspect current `main`;
- inspect `grid-foundation` and current open PR;
- inspect recently merged PRs when relevant;
- inspect CI status.

### Continuous working branch rule

**`grid-foundation` is the project's continuous working branch.**

After a PR is merged to `main`, synchronize/fast-forward `grid-foundation` to the new `main` state before continuing when necessary.

**Do not create a new feature/work branch unless the user explicitly asks for one.**

Do not write blindly onto a stale `grid-foundation`.

Maintain meaningful PRs for ongoing work.

**Never merge a PR unless the user explicitly asks for the merge.**

If the user merges while work is in progress, detect that state before further writes, sync `grid-foundation`, and continue there rather than automatically creating another branch.

PR descriptions should accurately state:

- behavior delivered;
- architecture/ownership decisions;
- limitations;
- automated validation;
- manual verification status;
- relevant docs;
- capability-marker/registry changes when applicable.

---

## Key implementation entry points

### Client-Side data/selection

- `frontend/src/features/transactions/grid/TransactionsClientGrid.tsx`
- `frontend/src/features/transactions/api/transactions.queries.ts`
- `frontend/src/shared/grid/config/clientSideGridDefaults.ts`
- `frontend/src/shared/grid/selection/client-side/useClientSideSelectionController.ts`
- `frontend/src/shared/grid/export/exportSelectedRowsCsv.ts`
- `backend/apps/transactions/api/client_views.py`
- `docs/client-side-grid.md`

### Infinite selection/loading

- `frontend/src/shared/grid/selection/infinite/useInfiniteSelectionController.tsx`
- `frontend/src/shared/grid/data/infinite/createInfiniteDatasource.ts`
- `frontend/src/shared/grid/data/infinite/useInfiniteRowLoading.ts`

### SSRM selection/loading

- `frontend/src/shared/grid/selection/server-side/useSsrmSelectionController.ts`
- `frontend/src/shared/grid/data/server-side/createServerSideDatasource.ts`
- `frontend/src/shared/grid/data/server-side/useServerSideRowLoading.ts`

### Transaction grid roots

- `frontend/src/features/transactions/grid/TransactionsClientGrid.tsx`
- `frontend/src/features/transactions/grid/TransactionsInfiniteGrid.tsx`
- `frontend/src/features/transactions/grid/TransactionsSsrmGrid.tsx`

### Selection/action/export

- `frontend/src/shared/grid/selection/gridSelectionActionTarget.ts`
- `frontend/src/features/transactions/grid/TransactionSelectionActions.tsx`
- `frontend/src/features/transactions/grid/transactionSelectionAction.ts`
- `frontend/src/features/transactions/grid/useTransactionSelectionAction.ts`
- `frontend/src/features/transactions/grid/useTransactionExport.ts`
- `frontend/src/features/transactions/api/transactions.contracts.ts`
- `docs/selected-action-selection-lifecycle.md`

### Editing / upcoming validation

- `frontend/src/shared/grid/editing/trackedGridEditing.ts`
- `frontend/src/shared/grid/editing/useTrackedGridEditing.ts`
- `frontend/src/shared/grid/editing/useCurrentPageEditActions.ts`
- `frontend/src/features/transactions/grid/transactionEditing.ts`
- `frontend/src/features/transactions/grid/transactionColumns.ts`
- `frontend/src/features/transactions/grid/useTransactionEditPersistence.ts`
- `docs/transaction-editing.md`
- `docs/edit-conflict-reconciliation.md`

### Backend selection/export/eligibility/edit persistence

- `backend/apps/transactions/services.py`
- `backend/apps/transactions/api/serializers.py`
- `backend/apps/transactions/api/views.py`

### Capability discovery

- `docs/grid-capability-tags.md`

---

## Required working style for future assistants

When asked to implement/review something:

1. inspect current repository/GitHub state first;
2. read this file and relevant source-of-truth docs;
3. identify relevant `GRIDCAP-*` marker(s) and search current frontend source/test occurrences;
4. inspect current implementation/tests and separate backend/API contracts where required;
5. explain important architectural issues discovered;
6. implement using native-first ownership principles;
7. preserve useful comments/rationale and accurate capability markers;
8. add local logic-level comments for new non-obvious behavior;
9. add/update focused tests;
10. update registry/docs/manual guidance/backlog/README when relevant;
11. run/inspect validation and CI;
12. keep PR description accurate;
13. report what changed and what still needs manual verification.

Push back when a requested approach would weaken architecture or create unnecessary abstraction, explain why, and provide the better alternative.

Do not overengineer. Do not introduce unrelated dependencies/infrastructure.

---

## Maintenance rule for this file

`AGENTS.md` is part of the project's Definition of Done.

Review/update it in the same PR when work changes:

- architecture/ownership rules;
- row-model responsibilities;
- capability discoverability rules;
- selection/count semantics;
- request freshness;
- eligibility;
- export/import behavior;
- editing/conflict/validation semantics;
- testing requirements;
- branch/PR workflow;
- roadmap sequencing;
- key source-of-truth paths.

Goal: **a new developer or new chat must be able to resume safely from the repository alone.**
