# AGENTS.md — Project Handoff and AI Working Contract

This file is the durable handoff for developers and coding assistants working on this repository.

**If a new chat/session starts, read this file first.** Do not rely on memory from an earlier conversation. Reconstruct the current state from the repository and GitHub.

This file must be kept current whenever a meaningful architecture rule, workflow rule, capability contract, or roadmap decision changes. It is intentionally stored in the repository so a future chat can resume safely even when the previous chat is unavailable.

---

## New-chat bootstrap

A user can paste this entire file into a new chat, or give the assistant this short instruction:

> Open `deepanshu-ahuja/aggrid-infinite-ssrm`. Read root `AGENTS.md` first, then inspect the current repository, current `main`, current working branch/open PRs, and the source-of-truth docs referenced below. Do not rely on previous-chat memory. Continue the requested work using the repository's documented architecture, testing, documentation, and PR standards.

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
- AG Grid Community Infinite Row Model;
- AG Grid Enterprise Server-Side Row Model (SSRM);
- Django + Django REST Framework backend;
- frontend and backend in one repository;
- Databricks Apps as the deployment target.

Do not add Docker or unrelated infrastructure unless explicitly required.

---

## Source-of-truth reading order

Before changing a capability, inspect the current code and current GitHub state. Never assume an old PR is still open or that an old branch is ahead of `main`.

Start with:

1. `AGENTS.md` — this working contract;
2. `README.md` — repository entry point and current developer links;
3. `docs/frontend-conventions.md` — code ownership, abstraction, comment, and testing standards;
4. `docs/grid-backlog.md` — living roadmap / verification list;
5. `docs/grid-capabilities.md` — logical capability catalog;
6. `docs/ag-grid-native-usage.md` — native AG Grid APIs currently relied upon;
7. `docs/api-data-flow.md` — frontend/backend data-flow contract.

Then read the capability-specific docs relevant to the task, including as applicable:

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
- Infinite versus SSRM differences;
- Client-Side differences when relevant;
- selection/edit/eligibility implications;
- edge cases and race conditions;
- limitations;
- future production approach;
- exact manual verification steps.

Do not leave core behavior merely "inferable" from implementation.

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
- why an implementation intentionally differs between row models.

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

Reuse semantic helpers when semantics are genuinely shared, but do not force Infinite, SSRM, and future Client-Side implementations into one controller when their native capabilities differ.

Promote code to `shared/grid` only when it is genuinely domain-neutral. Transaction-specific fields, API mapping, domain actions, business validation, and feature UI remain in the Transactions feature/backend.

Do not introduce an abstraction merely because two callers repeat a few lines. A shared abstraction should own a real responsibility such as lifecycle, validation, normalization, algorithmic behavior, third-party adaptation, retry/cancellation, or a meaningful stable boundary.

Use TanStack Query at ordinary application/API boundaries when useful, but do not force it into AG Grid datasource loading merely for consistency. AG Grid datasource lifecycle can own server-grid loading when it is the natural owner.

Do not add console logging just to understand flow. Prefer clear code, comments, tests, and isolated dev tooling.

---

## Current server-backed row-model baseline

The application keeps Infinite and SSRM as separate real implementations and routes so each can be verified independently.

Typical routes:

```text
/infinite
/ssrm
```

### Infinite

Infinite Row Model only has concrete RowNodes for loaded rows. Dataset-wide selection therefore needs compact logical include/exclude semantics where unloaded rows must be represented.

Native explicit/page selection remains native where possible; custom state fills only the unloaded dataset-wide semantic gap.

### SSRM

SSRM uses native Enterprise server-side selection state where AG Grid already provides the required behavior. Application-owned custom state exists only for missing product semantics, notably the current Select All Filtered behavior.

Do not move all SSRM selection into React just to make it look like Infinite.

---

## Selected-row count contract

For the current server-backed baseline, both Infinite and SSRM use the same normal backend query metadata:

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

This rule is specific to filter-dependent selection:

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

Current `totalCount` / `filteredCount` describe dataset/query membership, not exact selection eligibility.

Therefore this is intentionally possible:

```text
totalCount = 750
25 rows are selectionDisabled/readOnly

Select All Records UI
→ 750 selected

backend selected action/export
→ 725 eligible rows actually resolved
```

Do **not** subtract only restricted rows currently loaded in the browser. Unloaded pages may contain more restricted rows, so that would create false precision.

If a real product later requires exact actionable counts, the backend can add eligibility-aware metadata such as:

```text
selectionEligibleTotalCount
selectionEligibleFilteredCount
```

Do not add that contract until product requirements justify it.

---

## Export contract

Current server-backed export has two deliberately different scopes.

### Export Current Page

Current Page is already represented by concrete loaded RowNodes.

Use native AG Grid CSV export over exactly the current fully resolved pagination page. AG Grid owns CSV escaping/serialization/value processing; application code supplies the exact page boundary.

If the page is not fully resolved, refuse partial export rather than silently producing an incomplete file.

**Eligibility semantics:** Current Page export is a page snapshot, not a selected-row business operation. If `selectionDisabled` or `readOnly` rows are displayed on that page, they are included in the page export.

### Export Selected

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

**Eligibility semantics:** Selected export is a backend selection operation. `selectionDisabled` and `readOnly` rows are excluded by authoritative backend eligibility.

This difference must stay explicit in docs and tests:

| Export scope | Data owner | Includes `selectionDisabled` / `readOnly`? |
| --- | --- | --- |
| Current Page | Browser / native AG Grid CSV | Yes, when they are displayed on the page |
| Selected | Backend selection resolver | No |

The UI selected count can therefore be larger than the number of rows emitted by Selected export under the current eligibility-count limitation.

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

---

## Current roadmap discipline

Always read `docs/grid-backlog.md` before deciding the next capability because it is the living roadmap.

At the time this handoff was established, the high-level sequence was:

1. complete/manual-verify the Infinite + SSRM baseline;
2. build the Client-Side Row Model foundation;
3. revisit Import later.

Import/template/sample-upload functionality from older POCs is intentionally deferred until its roadmap point.

When Client-Side work begins, reuse shared **semantics** where appropriate but prefer native/local Client-Side mechanics when all rows are already in browser memory. Do not copy server-only datasource or selected-export behavior unnecessarily.

Multiple future Client-Side grids should reuse a proper client foundation rather than copy-paste plumbing.

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
- edit/conflict reconciliation.

Test Infinite and SSRM independently where their lifecycle or selection implementation differs. Share tests/helpers only for genuinely shared semantics.

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

Maintain a meaningful PR for branch work.

**Never merge a PR unless the user explicitly asks for the merge.**

If the user merges while work is in progress, detect that state before further writes. Continue from the new `main` and open/update the correct next PR instead of building on stale assumptions.

PR descriptions should accurately state:

- behavior delivered;
- architecture/ownership decisions;
- limitations;
- automated validation;
- manual verification status;
- relevant docs.

---

## Key implementation entry points

These are common entry points for current server-grid work. Search for additional call sites before changing a shared contract.

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

- `frontend/src/features/transactions/grid/TransactionsInfiniteGrid.tsx`
- `frontend/src/features/transactions/grid/TransactionsSsrmGrid.tsx`

### Selection/action/export

- `frontend/src/features/transactions/grid/transactionSelectionAction.ts`
- `frontend/src/features/transactions/grid/useTransactionExport.ts`
- `frontend/src/features/transactions/api/transactions.contracts.ts`

### Backend selection/export

- `backend/apps/transactions/services.py`
- `backend/apps/transactions/api/serializers.py`
- `backend/apps/transactions/api/views.py`

---

## Required working style for future assistants

When asked to implement/review something:

1. inspect current repository/GitHub state first;
2. read this file and relevant source-of-truth docs;
3. inspect current implementation and tests;
4. explain any important architectural issue discovered;
5. implement the change using native-first ownership principles;
6. preserve useful existing comments/rationale;
7. add local logic-level comments for new non-obvious behavior;
8. add/update focused tests;
9. update feature docs, manual verification, README/backlog when relevant;
10. run/inspect validation and CI;
11. keep the PR description accurate;
12. report what changed and what still needs manual verification.

Push back on a requested approach when it would weaken the architecture or create unnecessary abstraction, but explain the reason and provide the better alternative.

Do not overengineer. Do not introduce infrastructure/dependencies unrelated to a demonstrated requirement.

---

## Maintenance rule for this file

`AGENTS.md` is part of the project's Definition of Done.

Whenever work changes any of the following, review and update this file in the same PR if needed:

- architecture/ownership rules;
- row-model responsibilities;
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
