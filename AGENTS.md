# AGENTS.md — Project Handoff and AI Working Contract

This file is the durable handoff for developers and coding assistants working on this repository.

**If a new chat/session starts, read this file first.** Do not rely on memory from an earlier conversation. Reconstruct the current state from the repository and GitHub.

This file must be kept current whenever a meaningful architecture rule, workflow rule, capability contract, discoverability contract, or roadmap decision changes. It is intentionally stored in the repository so a future chat can resume safely even when the previous chat is unavailable.

---

## New-chat bootstrap

A user can paste this entire file into a new chat, or give the assistant this short instruction:

> Open `deepanshu-ahuja/aggrid-infinite-ssrm`. Read root `AGENTS.md` first, then inspect the current repository, current `main`, current working branch/open PRs, and the source-of-truth docs referenced below. Do not rely on previous-chat memory. Continue the requested work using the repository's documented architecture, capability-tag, testing, documentation, and PR standards.

Before writing code, the assistant should briefly report:

1. current repository / branch / PR state found on GitHub;
2. source-of-truth docs read for the task;
3. the current architecture relevant to the requested change;
4. any conflict between the request and documented behavior;
5. the intended change and validation plan.

Do not ask the user questions that can be answered by inspecting the repository.

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
- Databricks Apps as the deployment target.

Do not add Docker or unrelated infrastructure unless explicitly required.

---

## Source-of-truth reading order

Before changing a capability, inspect the current code and current GitHub state. Never assume an old PR is still open or that an old branch is ahead of `main`.

Start with:

1. `AGENTS.md` — this working contract;
2. `README.md` — repository entry point and current developer links;
3. `docs/frontend-conventions.md` — code ownership, abstraction, comment, capability-marker, and testing standards;
4. `docs/grid-capability-tags.md` — authoritative `GRIDCAP-*` registry for locating complete capability footprints;
5. `docs/grid-backlog.md` — living roadmap / verification list;
6. `docs/grid-capabilities.md` — logical capability catalog;
7. `docs/ag-grid-native-usage.md` — native AG Grid APIs currently relied upon;
8. `docs/api-data-flow.md` — frontend/backend data-flow contract.

Then read the capability-specific docs relevant to the task, including as applicable:

- `docs/client-side-grid.md`;
- `docs/selection-counts.md`;
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

If code and docs disagree, do not silently choose one. Determine which reflects the intended/current behavior, fix the inconsistency as part of the work, and document the resolution.

GitHub `main` plus the current open PR/working branch is the source of truth for repository state.

---

## Definition of done

A meaningful capability is not complete with code alone.

Expected deliverables normally include:

- production-quality implementation;
- focused automated tests;
- useful inline rationale for non-obvious logic;
- architecture / feature documentation;
- explicit limitations and future extension points;
- manual verification guidance where browser / AG Grid lifecycle behavior matters;
- capability-tag registry/marker review when the capability footprint changes;
- backlog/status updates;
- CI validation;
- an accurate PR description.

A developer should be able to understand a feature's behavior from the repository without reconstructing it from chat history or Git archaeology.

Feature documentation should explain, where relevant:

- what the user-visible feature does;
- what is included/excluded;
- frontend versus backend ownership;
- native AG Grid APIs being used;
- custom logic and why it exists;
- Client-Side versus Infinite versus SSRM differences;
- selection/edit/eligibility implications;
- edge cases and race conditions;
- limitations;
- future production approach;
- exact manual verification steps.

Do not leave core behavior merely "inferable" from implementation.

---

## Capability-tag discoverability contract

This repository is also meant to be mined later as a reference implementation. A developer may want to extract one feature such as Select All Filtered, Current Page export, tracked conflicts, or safe AG Grid teardown without remembering every file that participates in that capability.

`docs/grid-capability-tags.md` is the **authoritative registry** of searchable `GRIDCAP-*` markers.

Working rule:

```text
need one capability
→ find its GRIDCAP-* entry in docs/grid-capability-tags.md
→ read its row-model/ownership notes
→ search the exact marker across the repository
→ review every marked integration point + linked tests/docs before extracting/adapting it
```

Important rules:

- every capability marker starts with the exact prefix `GRIDCAP-`;
- do **not** invent ad-hoc markers in source; define a genuinely new marker in the registry first;
- use one logical marker across Client-Side, Infinite, SSRM, frontend, backend, and tests when they implement the same user/business capability differently;
- a source location may carry multiple markers when it supports multiple capabilities;
- mark extraction-relevant boundaries such as controllers, roots, shared algorithms, lifecycle/event boundaries, request translation, backend authority, and focused tests;
- do not tag every obvious helper/line merely to increase marker count;
- a marker means "this location participates in the capability", **not** "this code can be copied unchanged to every row model";
- preserve useful markers during refactors when the capability still exists;
- when a capability is added, removed, or materially changed, review the registry and existing markers in the same work;
- avoid casual marker renames because stable searchability across history is part of their value.

For a complete row-model extraction, use the row-model tags such as:

```text
GRIDCAP-ROWMODEL-CLIENT
GRIDCAP-ROWMODEL-INFINITE
GRIDCAP-ROWMODEL-SSRM
```

For one logical feature, use the specific tag such as:

```text
GRIDCAP-SEL-FILTERED
GRIDCAP-EXPORT-SELECTED
GRIDCAP-EDIT-CONFLICT
GRIDCAP-LIFECYCLE-DESTROY
```

Do not use capability markers as an excuse to create a universal wrapper. Concrete integration roots are intentionally visible and may legitimately carry several markers.

---

## Comment and JSDoc preservation rule

**Preserve useful existing explanatory comments by default.**

Do not remove or shorten comments just to make a file smaller or "cleaner".

An existing explanation should normally remain when it documents:

- architecture or ownership;
- lifecycle;
- state transitions;
- race conditions;
- AG Grid behavior that is not obvious;
- native-versus-custom responsibility;
- selection semantics;
- backend authority;
- cache / refresh behavior;
- why a particular source of truth exists;
- why an implementation intentionally differs between row models;
- capability markers that still accurately describe the integration point.

Remove or rewrite an existing comment only when:

- the underlying logic changed and the old comment became wrong;
- the explanation is genuinely obsolete;
- it is objectively redundant/noise.

When adding new non-obvious logic, add **logic-level comments near that logic**. Useful comments explain **why**, not TypeScript/Python syntax.

Avoid noise such as:

```ts
// Set the error.
setError(message);
```

The codebase is intended to remain understandable to another developer or coding agent that has never seen the original chat.

---

## Architecture principles

For each grid concern, prefer this order:

1. native AG Grid capability;
2. row-model-specific native AG Grid capability;
3. custom application logic only for a real semantic gap.

Do not create a universal `AgGridReact` wrapper or giant `useGrid()` hook that hides AG Grid lifecycle behind another abstraction.

Concrete grid roots should remain visible and should own their `GridApi`.

Reuse semantic helpers when semantics are genuinely shared, but do not force Client-Side, Infinite, and SSRM implementations into one controller when their native capabilities differ.

Promote code to `shared/grid` only when it is genuinely domain-neutral. Transaction-specific fields, API mapping, domain actions, business validation, and feature UI remain in the Transactions feature/backend.

Do not introduce an abstraction merely because two callers repeat a few lines. A shared abstraction should own a real responsibility such as lifecycle, validation, normalization, algorithmic behavior, third-party adaptation, retry/cancellation, or a meaningful stable boundary.

Use TanStack Query at ordinary application/API boundaries when useful, but do not force it into AG Grid datasource loading merely for consistency. AG Grid datasource lifecycle can own server-grid loading when it is the natural owner.

Do not add console logging just to understand flow. Prefer clear code, comments, capability markers, tests, and isolated dev tooling.

---

## Current row-model baseline

The application keeps Client-Side, Infinite, and SSRM as separate real implementations and routes so each can be verified independently.

Typical routes:

```text
/client
/infinite
/ssrm
```

### Client-Side

Client-Side Row Model receives the complete bounded Transaction working set through TanStack Query and passes editable row copies to AG Grid `rowData`.

AG Grid then owns local sorting, filtering, pagination, and selection. Client does not use Infinite/SSRM datasource or unloaded-row include/exclude machinery.

Current Client selection foundation supports native scopes:

```text
page      → rowSelection.selectAll = 'currentPage'
filtered  → rowSelection.selectAll = 'filtered'
all       → rowSelection.selectAll = 'all'
```

The Transactions demo currently defaults to `all`. Because every row is local and native `isRowSelectable` excludes both `selectionDisabled` and `readOnly`, Client selected count is exact for eligibility. With the deterministic current 750-row demo dataset, native Select All selects 624 eligible rows (63 `selectionDisabled` + 63 `readOnly` are outside selection).

Selected Client export is native/local because all selected row objects are available in browser memory. Client selected business actions still send explicit IDs to the backend, which re-checks eligibility.

### Infinite

Infinite Row Model only has concrete RowNodes for loaded rows. Dataset-wide selection therefore needs compact logical include/exclude semantics where unloaded rows must be represented.

Native explicit/page selection remains native where possible; custom state fills only the unloaded dataset-wide semantic gap.

### SSRM

SSRM uses native Enterprise server-side selection state where AG Grid already provides the required behavior. Application-owned custom state exists only for missing product semantics, notably the current Select All Filtered behavior.

Do not move all SSRM selection into React just to make it look like Infinite.

---

## Selected-row count contract

### Client-Side

Client selected count is exact:

```text
selected count
→ api.getSelectedRows().length
```

Because the complete working set is local and `isRowSelectable` is native, restricted rows never enter the selected set.

### Infinite + SSRM

For the server-backed baseline, both Infinite and SSRM use the same normal backend query metadata:

```text
Explicit / manual / current-page
→ exact selected IDs

Select All Records
→ API totalCount - explicit user deselection exceptions

Select All Filtered
→ API filteredCount - explicit user deselection exceptions
```

Selection mechanics remain row-model-specific. The dataset-wide count source is intentionally consistent.

Do not reintroduce a separate Infinite count source such as `isLastRowIndexKnown()` for selected totals unless there is a concrete demonstrated reason and the architecture is deliberately reconsidered and documented.

---

## Request freshness / out-of-order responses

Both server-backed datasources protect renderable count metadata from out-of-order responses.

The rule is:

**the latest STARTED request owns the renderable `totalCount` / `filteredCount`.**

Example:

```text
request A starts
request B starts after A

B is now the latest request

B resolves
→ B may publish totalCount / filteredCount

A resolves later
→ A may finish its AG Grid loading lifecycle
→ A MUST NOT overwrite B's count metadata
```

This is based on request-start order, **not page number**.

Therefore the same rule must work in both directions:

```text
forward:  page 1 request → page 2 request
backward: page 3 request → page 2 request
```

The second request is newer in either case.

Tests should retain explicit coverage for forward and backward request ordering for both Infinite and SSRM. Comments beside the freshness logic should make the A/B behavior obvious to a future developer.

---

## Filter-dependent selection reset

Select All Filtered is defined by the current filter universe.

Example:

```text
Filter = Pending
Select All Filtered
→ means all matching Pending rows

Filter changes to Failed
```

Keeping the old filtered-wide selection would silently redefine the user's existing selection to all Failed rows. Therefore the filter-dependent Select All Filtered selection is cleared/reset when its defining filter changes.

This rule is specific to filter-dependent selection across all three row-model implementations:

```text
Select All Filtered
→ filter changes
→ clear/reset filtered-wide selection

Select All Records
→ filter changes
→ still means the complete dataset

Ordinary explicit/manual IDs
→ do not silently become a new filtered-wide selection
```

---

## Row interaction and backend eligibility

Rows may carry backend-provided interaction modes such as:

- `enabled`;
- `selectionDisabled`;
- `readOnly`.

The frontend prevents invalid interactions where possible, but the backend remains authoritative for business operations.

Do not encode every business-disabled row as a logical user deselection exception. These concepts are different:

```text
user exception IDs
→ rows the user explicitly deselected

backend eligibility
→ rows business rules allow an operation to act on
```

---

## Count eligibility limitation

The limitation below applies to dataset-wide **server-backed** selected counts. Client-Side exact selection does not have this limitation because every row is concrete/local.

Current server `totalCount` / `filteredCount` describe dataset/query membership, not exact selection eligibility.

Therefore this is intentionally possible for Infinite/SSRM:

```text
totalCount = 750
25 rows are selectionDisabled/readOnly

Select All Records UI
→ 750 selected

backend selected action/export
→ 725 eligible rows actually resolved
```

Do **not** subtract only restricted rows currently loaded in the browser. Unloaded pages may contain more restricted rows, so that would create false precision.

If a real product later requires exact actionable server-wide counts, the backend can add eligibility-aware metadata such as:

```text
selectionEligibleTotalCount
selectionEligibleFilteredCount
```

Do not add that contract until product requirements justify it.

---

## Export contract

Current export has two logical scopes, but Selected ownership differs by row model.

### Export Current Page

Current Page is already represented by concrete loaded RowNodes.

Use native AG Grid CSV export over exactly the current fully resolved pagination page. AG Grid owns CSV escaping/serialization/value processing; application code supplies the exact page boundary.

If the page is not fully resolved, refuse partial export rather than silently producing an incomplete file.

**Eligibility semantics:** Current Page export is a page snapshot, not a selected-row business operation. If `selectionDisabled` or `readOnly` rows are displayed on that page, they are included in the page export.

### Export Selected — Client-Side

Client has the complete selected set locally, so Selected export uses native AG Grid CSV with selected rows across pagination pages. It does not call the backend selected-export endpoint.

Since restricted Client rows cannot enter native selection, local Selected export naturally contains selected eligible rows only.

### Export Selected — Infinite / SSRM

Selected export is backend-owned for Infinite and SSRM because a logical selection may include rows that were never loaded in the browser.

Flow:

```text
row-model-specific selection state
        ↓
common logical selection target
        ↓
POST /api/transactions/selection/export/
        ↓
backend resolves authoritative selected rows
        ↓
backend writes CSV
        ↓
browser download
```

**Eligibility semantics:** server-backed Selected export is a backend selection operation. `selectionDisabled` and `readOnly` rows are excluded by authoritative backend eligibility.

This difference must stay explicit in docs and tests.

---

## Operation-neutral backend selection resolver

Selected business operations should reuse one backend resolver for logical selection.

Conceptually:

```text
include + IDs
→ resolve exact named rows
→ apply authoritative eligibility

exclude + filters
→ all eligible matching rows minus explicit user exception IDs

exclude without filters
→ all eligible records minus explicit user exception IDs
```

Update Selected, Export Selected, and future selected-row operations should not independently reinterpret what "selected" means.

Selection answers **which rows**. The business operation answers **what to do** with those rows.

Client selected business actions can also reuse the same backend operation by sending exact `include + ids`; Client does not need dataset-wide `exclude` state because it can enumerate the exact native selected IDs.

---

## Editing / dirty-row baseline

Tracked editing state lives outside transient RowNodes so dirty work can survive row recreation/cache lifecycle where required.

Edited count means **dirty rows**, not dirty fields:

```text
3 dirty fields in one row
→ edited row count = 1

another dirty row
→ edited row count = 2
```

Conflict behavior follows the BASE / LOCAL / REMOTE model documented in:

- `docs/transaction-editing.md`;
- `docs/edit-conflict-reconciliation.md`.

Read those docs before touching editing/reconciliation. Do not simplify the existing model accidentally.

Client reuses the same tracked-edit/conflict semantics but receives fresh authoritative data through TanStack Query / `rowData` replacement rather than a server cache/store lifecycle.

---

## Current roadmap discipline

Always read `docs/grid-backlog.md` before deciding the next capability because it is the living roadmap.

Current high-level state/sequence:

1. Client-Side, Infinite, and SSRM baseline implementations exist with focused automated coverage;
2. browser/manual verification for the three row models remains available for a later consolidated pass and must not be falsely marked complete;
3. capability-tag discoverability is being maintained so individual patterns can be extracted safely later;
4. Import/template/sample-upload remains intentionally deferred until its roadmap point;
5. future capabilities should be evaluated across Client / Infinite / SSRM together without forcing identical implementations.

Multiple future Client-Side grids should reuse a proper client foundation rather than copy-paste plumbing, but wait for a second real table before inventing abstractions that have not been proven necessary.

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
- backend validation;
- backend selection resolution;
- export semantics;
- eligibility;
- edit/conflict reconciliation;
- Client-Side native scope mapping and exact local-selection behavior;
- capability-marker searches when a capability footprint changes.

Test Client-Side, Infinite, and SSRM independently where their lifecycle or selection implementation differs. Share tests/helpers only for genuinely shared semantics.

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

Also inspect the GitHub Actions run after pushing.

Do not claim browser/manual verification was completed unless it was actually performed.

---

## Git and PR workflow

GitHub is the repository-state source of truth.

Before making changes:

- inspect current `main`;
- inspect the working branch;
- inspect open PRs;
- inspect recently merged PRs when relevant;
- inspect CI status.

The project has commonly used `grid-foundation` as the working branch. Continue that convention when it is clean and appropriate, but do not blindly write onto a stale branch. If it is behind with no unique work, fast-forward/recreate the continuation from current `main` before changing files.

A deliberately isolated infrastructure/discoverability change may use a focused branch when that keeps the PR clean; do not proliferate branches for ordinary feature work without reason.

Maintain a meaningful PR for branch work.

**Never merge a PR unless the user explicitly asks for the merge.**

If the user merges while work is in progress, detect that state before further writes. Continue from the new `main` and open/update the correct next PR instead of building on stale assumptions.

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

These are common entry points for current grid work. Search the relevant `GRIDCAP-*` marker and additional call sites before changing or extracting a shared contract.

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

### Shared datasource/order tests

- `frontend/src/shared/grid/data/datasources.test.ts`

### Transaction grid roots

- `frontend/src/features/transactions/grid/TransactionsClientGrid.tsx`
- `frontend/src/features/transactions/grid/TransactionsInfiniteGrid.tsx`
- `frontend/src/features/transactions/grid/TransactionsSsrmGrid.tsx`

### Selection/action/export

- `frontend/src/shared/grid/selection/gridSelectionActionTarget.ts`
- `frontend/src/features/transactions/grid/transactionSelectionAction.ts`
- `frontend/src/features/transactions/grid/useTransactionExport.ts`
- `frontend/src/features/transactions/api/transactions.contracts.ts`

### Editing

- `frontend/src/shared/grid/editing/trackedGridEditing.ts`
- `frontend/src/shared/grid/editing/useTrackedGridEditing.ts`
- `frontend/src/shared/grid/editing/useCurrentPageEditActions.ts`
- `frontend/src/features/transactions/grid/useTransactionEditPersistence.ts`

### Backend selection/export/eligibility

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
3. identify the relevant `GRIDCAP-*` marker(s) in `docs/grid-capability-tags.md` and search their current repository occurrences;
4. inspect current implementation and tests, including cross-capability/shared touchpoints revealed by those markers;
5. explain any important architectural issue discovered;
6. implement the change using native-first ownership principles;
7. preserve useful existing comments/rationale and applicable capability markers;
8. add local logic-level comments for new non-obvious behavior;
9. add/update focused tests;
10. update capability markers/registry plus feature docs, manual verification, README/backlog when relevant;
11. run/inspect validation and CI;
12. keep the PR description accurate;
13. report what changed and what still needs manual verification.

Push back on a requested approach when it would weaken the architecture or create unnecessary abstraction, but explain the reason and provide the better alternative.

Do not overengineer. Do not introduce infrastructure/dependencies unrelated to a demonstrated requirement.

---

## Maintenance rule for this file

`AGENTS.md` is part of the project's Definition of Done.

Whenever work changes any of the following, review and update this file in the same PR if needed:

- architecture/ownership rules;
- row-model responsibilities;
- capability-tag/discoverability rules;
- selection/count semantics;
- request freshness behavior;
- eligibility behavior;
- export/import behavior;
- editing/conflict semantics;
- testing requirements;
- branch/PR workflow;
- roadmap sequencing;
- key source-of-truth documentation paths.

The goal is simple: **a new developer or a new chat must be able to resume the project safely from the repository alone.**
