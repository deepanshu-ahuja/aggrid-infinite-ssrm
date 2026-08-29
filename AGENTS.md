# AGENTS.md — Project Handoff and AI Working Contract

This file is the durable working contract for developers and coding assistants working on this repository.

**If a new chat/session starts, read this file first.** Reconstruct current state from the repository and GitHub rather than relying on previous-chat memory.

Repository:

`deepanshu-ahuja/aggrid-infinite-ssrm`

Continuous working branch:

`grid-foundation`

This is a production-oriented reusable/reference AG Grid foundation, not a disposable POC.

---

## New-chat bootstrap

Before changing code:

1. inspect current `main`;
2. inspect `grid-foundation`;
3. inspect the current open PR and recently merged PRs when relevant;
4. read this file;
5. open `docs/implementation/README.md`;
6. read the relevant row-model guide and capability docs;
7. inspect current source/tests rather than assuming an old PR description is still true.

Do not ask the user questions that repository inspection can answer.

GitHub is the source of truth for branch/PR state.

---

## Current stack and deployment boundary

Current stack includes:

- React 19;
- TypeScript;
- Vite;
- AG Grid 36.x;
- AG Grid Client-Side Row Model;
- AG Grid Community Infinite Row Model;
- AG Grid Enterprise Server-Side Row Model (SSRM);
- TanStack Query at normal application/API boundaries such as the Client collection flow;
- Django + Django REST Framework;
- frontend and backend in one repository;
- Databricks Apps as deployment target.

Do not add Docker or unrelated infrastructure unless explicitly requested.

Do not add console logging merely to understand control flow. Prefer clear code, comments, focused tests and isolated dev tooling.

---

## Documentation structure and scope contract

### Canonical current implementation area

`docs/implementation/` is the canonical home for documentation that explains behavior implemented by the repository now.

Start with:

- `docs/implementation/README.md`.

Current implementation docs must be usable as **portable implementation references**. A developer should be able to understand the implemented capability without needing this repository's backlog, proposal documents, PR history, chat history, or discarded-design history.

If a current implementation document says a configuration key, API, behavior, hook, option, state transition or capability exists, current code must actually support it.

Do not put these into current implementation docs merely because they were discussed:

- rejected approaches;
- hypothetical runtime configuration;
- speculative APIs;
- possible future registries;
- conversation history;
- PR/change history;
- project roadmap commentary;
- options current code does not expose;
- proposed solutions for requirements that are not implemented.

Current limitations are appropriate when they state what the implementation does or does not support today. Do not add a speculative future solution merely to explain a limitation.

When ownership, call flow, lifecycle or state transitions are materially easier to understand visually, add a small diagram to the relevant implementation document. Portable plain-text/ASCII diagrams are the default because they remain readable in raw Markdown and ordinary local viewers. Do not rely on Mermaid-only diagrams unless rendering is explicitly guaranteed, and do not add diagrams merely for decoration.

### Row-model implementation entry points

A developer must be able to understand one row model without first reading all three.

Canonical row-model guides:

- `docs/implementation/row-models/client.md`;
- `docs/implementation/row-models/infinite.md`;
- `docs/implementation/row-models/ssrm.md`.

Detailed Infinite/SSRM selection contracts live beside those guides.

A row-model guide should explain that model's own loading, selection, count ownership where relevant, refresh/retry, editing integration, export ownership, lifecycle/Grid State and implementation entry points. Do not retell unrelated row models unless comparison is required to explain the current model.

### Shared capability docs

When a capability is genuinely shared, keep one shared capability document and explicitly call out meaningful Client/Infinite/SSRM differences.

Examples:

- `docs/implementation/selection-counts.md`;
- `docs/implementation/transaction-editing.md`;
- `docs/implementation/grid-validation.md`;
- `docs/implementation/edit-conflict-reconciliation.md`;
- `docs/implementation/grid-export.md`;
- `docs/implementation/row-interaction.md`.

Do not make a shared document imply one universal implementation when row-model mechanics differ.

### Manual verification docs

Current browser/manual verification guides live under:

- `docs/implementation/testing/`.

**Manual verification steps are a required deliverable for every meaningful browser-visible or AG Grid lifecycle capability/change.** Do not wait for the user to ask for them.

When such a capability changes, in the same work:

1. create or update the relevant guide under `docs/implementation/testing/`;
2. cover each applicable row model independently when mechanics/lifecycle differ;
3. include concrete setup, actions, expected visible/state/network outcomes, important negative cases and pass criteria;
4. include interactions with existing lifecycle/state that can regress, such as selection, dirty state, validation, conflicts, refresh/recreation, Save/Discard, errors or export as applicable;
5. link the guide from `docs/implementation/README.md` and the relevant capability document when useful.

Automated tests do not replace these documented browser/manual steps. If a change truly has no meaningful browser/manual surface, a separate checklist is not required, but that should be evident from the capability's scope rather than silently omitted.

If the active execution environment provides a usable browser and the application can be run/accessed, perform the relevant browser verification as part of the work where practical. If the environment cannot run or access the application, keep the steps documented and report that execution limitation precisely.

Never claim a manual/browser pass was completed unless it actually was.

### Browser automation and regression inventory

TypeScript Playwright is the repository's real-browser integration layer.

Canonical references:

- `docs/implementation/testing/browser-regression.md` — architecture, CI flow, deterministic test-data reset, selector/readiness rules, diagnostics, future dedicated E2E database/auth boundary and local execution;
- `docs/implementation/testing/coverage-matrix.md` — cross-layer inventory of implemented capability coverage and remaining gaps.

Rules:

- browser specs must import `test` / `expect` from `tests/browser/fixtures.ts`, not directly from `@playwright/test`;
- the automatic fixture must reset authoritative E2E Transaction data before every test and retry;
- no browser test may depend on data mutated by an earlier test, file order, retry order or another row model's scenario;
- use stable seeded row IDs for known business-policy rows rather than positional "first matching row" assumptions;
- prefer unique semantic selectors; use explicit test IDs for custom editor internals when the same accessible label legitimately identifies another control;
- wait for real authoritative data/materialisation/network preconditions rather than using arbitrary sleeps to mask lifecycle races;
- keep pure algorithms/combinatorial state transitions in focused tests when a browser adds no useful evidence;
- use Playwright for material real React + AG Grid + backend integration, rendering, editor, selection, lifecycle, network and uncaught-page-error risks;
- update the coverage matrix when automated/manual coverage materially changes;
- a written Playwright test is not a passed browser check until the exact code head actually executes successfully.

The current Transaction source is an in-process deterministic Python list. The Playwright fixture resets it through a default-off E2E-only backend boundary. When Transactions become database-backed, preserve the Playwright reset contract and move its backend implementation to a dedicated seeded/reset E2E database; never use developer or production data.

The current app has no authentication. When authentication exists, use a Playwright setup project to log in once with dedicated test credentials from environment/CI secrets, save `storageState`, and reuse it across normal browser specs. Do not hardcode real credentials.

### Backlog and proposal material

`docs/grid-backlog.md` is the living planning/control document and may contain unfinished work, sequencing and deferred decisions.

Clearly identified architecture proposal documents may describe target/exploratory architecture that is not implemented yet.

Do not copy that planning/proposal material into implementation docs.

### Moving documentation

When moving or renaming implementation documentation:

1. move the canonical content;
2. update `README.md`, this file, capability registry references and live internal links;
3. remove the obsolete old file/path.

Do **not** keep placeholder `Moved:` documents by default. Retain an old path only when there is a specific external compatibility requirement.

When code and a current implementation doc disagree, inspect source/tests, determine current intended behavior and fix the inconsistency in the same work.

---

## Definition of done

A meaningful capability is not complete with code alone.

Expected deliverables normally include:

- production-quality implementation;
- focused automated tests at the strongest deterministic boundaries;
- backend/API tests when backend authority/contracts change;
- TypeScript Playwright coverage when real browser/AG Grid/backend integration materially matters;
- useful comments/JSDoc for non-obvious ownership, state or lifecycle logic;
- current implementation documentation;
- explicit current limitations;
- **documented manual/browser verification steps for every meaningful browser-visible or AG Grid lifecycle capability/change**;
- execution of those browser steps when the active environment can run/access the application;
- regression coverage-matrix review/update when the capability footprint or coverage changes;
- capability-tag review when the frontend capability footprint changes;
- backlog/status updates when sequencing/status changes;
- CI validation;
- accurate PR description.

A developer should be able to understand current behavior without reconstructing chat history or Git archaeology.

---

## Capability-tag discoverability

`docs/implementation/grid-capability-tags.md` is the authoritative registry for frontend `GRIDCAP-*` markers.

Working flow:

```text
need a frontend grid capability
→ find its GRIDCAP-* registry entry
→ read applicability / row-model ownership
→ search the exact marker in frontend source/tests
→ inspect every meaningful occurrence
→ inspect required backend/API behavior separately
```

Rules:

- markers belong in frontend source and focused frontend tests only;
- do not add markers to Python/backend source or backend tests;
- define a genuinely new marker in the registry before adding it to source;
- use one logical marker across row models when the capability is shared but mechanics differ;
- a marker means participation, not copy-paste equivalence;
- preserve accurate markers during refactors;
- do not tag trivial lines merely to increase coverage.

Core row-model markers:

```text
GRIDCAP-ROWMODEL-CLIENT
GRIDCAP-ROWMODEL-INFINITE
GRIDCAP-ROWMODEL-SSRM
```

---

## Comment preservation

Preserve useful explanatory comments by default.

Keep comments that explain:

- ownership;
- lifecycle;
- state transitions;
- races;
- native-versus-custom responsibility;
- backend authority;
- cache/refresh behavior;
- selection semantics;
- conflict semantics;
- why row models intentionally differ;
- why a particular source of truth exists.

Rewrite/remove a comment when underlying logic changed, the explanation became obsolete, or it is objectively noise.

New non-obvious logic should have local rationale comments explaining **why**, not syntax.

Capability markers help find code. Explanatory comments explain why the code exists. Preserve both when still accurate.

---

## Core architecture principles

For each grid concern prefer:

1. native AG Grid capability;
2. row-model-specific native AG Grid capability;
3. custom application logic only for a real semantic gap.

Do not create a universal `AgGridReact` wrapper or giant `useGrid()` hook that hides AG Grid lifecycle.

Concrete roots remain visible and own their own `GridApi`.

Promote code to `shared/grid` only when genuinely domain-neutral.

Transaction-specific fields, request mapping, endpoints, business actions, business validation/rules/messages and feature presentation remain feature/backend-owned.

Do not create an abstraction merely because a few callers repeat lines. Shared abstractions should own a stable responsibility such as lifecycle, validation, normalization, algorithmic behavior, third-party adaptation, retry/cancellation or another proven shared boundary.

Use TanStack Query at normal application/API boundaries when useful. Do not force it into Infinite/SSRM datasource loading merely for consistency; AG Grid datasource lifecycle is the natural owner there.

---

## Row-model independence

The repository demonstrates:

```text
/client
/infinite
/ssrm
```

A real application may use all three, one, or a subset.

**Do not create dependencies that require all three row models to exist together.**

### Client-Side

Client receives the complete bounded Transaction working set through TanStack Query and passes editable row copies to native `rowData`.

AG Grid owns local sorting, filtering, pagination and selection.

Native Select All scopes:

```text
page      → currentPage
filtered  → filtered
all       → all
```

Selected IDs/count are exact because the complete working set is local. Selected export is native/local.

### Infinite

Infinite has concrete RowNodes only for loaded rows.

Native loaded/manual/current-page selection stays native where possible.

Filtered/all dataset-wide selection uses compact include/exclude application state because unloaded rows do not have RowNodes.

### SSRM

SSRM uses native Enterprise server-side selection state where AG Grid represents the required meaning.

Application-owned state exists only for the current All Filtered semantic gap.

Do not move all SSRM selection into React merely to resemble Infinite.

### Selection controllers remain separate

```text
useClientSideSelectionController()
useInfiniteSelectionController()
useSsrmSelectionController()
```

They may expose the same semantic operation such as `clearSelection()`, but each owns different mechanics.

Do not replace them with one row-model switch/universal controller.

---

## Selected-row count contract

### Client

```text
selected count
→ exact native selected rows
```

### Infinite / SSRM

```text
explicit/manual/current-page
→ exact include ID count

All Filtered
→ API filteredCount - explicit user exceptions

All Records
→ API totalCount - explicit user exceptions
```

Server `totalCount` / `filteredCount` describe query membership rather than exact selected-operation eligibility.

Do not subtract only restricted rows currently loaded in browser memory; unloaded pages can contain additional restricted rows and that would create false precision.

---

## Request freshness

For Infinite/SSRM renderable count metadata:

> the latest **started** request owns `totalCount` / `filteredCount` publication.

```text
request A starts
request B starts later
B resolves → may publish counts
A resolves later → may finish AG Grid load lifecycle but must not overwrite B's counts
```

This is based on request-start order, not page number.

Retain forward and backward request-order tests.

---

## Filter-dependent selection

```text
Select All Filtered
→ defining filter changes
→ clear/reset that filtered-wide selection

Select All Records
→ visible filter changes
→ remains All Records

explicit/manual IDs
→ remain explicit IDs
```

---

## Row interaction and backend authority

Current generic row modes:

```text
enabled
selectionDisabled
readOnly
```

Frontend prevents invalid loaded-row interaction where possible. Backend authority remains required for authoritative writes/operations and unloaded rows.

Do not confuse user deselection exceptions with backend eligibility.

Restricted rows are not manufactured as logical exclude IDs.

---

## Export contract

### Current Page

All three row models use native AG Grid CSV over the exact fully resolved current pagination page.

If the expected page is not fully materialised, refuse partial export.

Displayed restricted rows are included because Current Page is a page snapshot.

### Selected — Client

Use native/local selected-row CSV across pagination pages.

### Selected — Infinite / SSRM

Use backend selected export because the logical selected universe can contain unloaded rows.

The same logical backend resolver semantics are reused for selected mutation and selected export.

---

## Current selected business action

Transactions implements one selected **Change Status** mutation family:

```text
Mark Completed
Mark Pending
Mark Failed
```

Current lifecycle:

```text
current selection target
→ Change Status request
→ backend succeeds
→ concrete grid root calls its existing row-model clearSelection()
→ concrete root refreshes authoritative data
```

If the request fails, the success callback does not run and selection remains available.

The request does not carry a selection-lifecycle configuration value.

Different row models clear through their own controllers; there is no universal clear implementation.

---

## Editing / dirty-row baseline

Tracked editing state lives outside transient RowNodes and is keyed by stable backend row ID.

Edited count means dirty rows, not dirty fields.

Current editing includes:

- direct committed cell edits;
- current-page programmatic edit application;
- row Save/Discard;
- Save/Discard selected dirty rows;
- safe in-flight acknowledgement;
- BASE/LOCAL/REMOTE conflict reconciliation;
- local-overlay protection so programmatic values are not mistaken for fresh REMOTE data;
- field validation integrated with direct/programmatic LOCAL edits;
- Row Save and exact Save Selected validation guards;
- backend field validation error mapping without losing rejected LOCAL work.

For a dirty field:

```text
REMOTE == BASE
→ keep LOCAL dirty

REMOTE == LOCAL
→ auto-clean

REMOTE differs from BASE and LOCAL
→ conflict
```

`Use server` applies REMOTE and clears the field draft. `Keep my edit` keeps LOCAL dirty against REMOTE as the new BASE.

---

## Validation — implemented baseline

Validation is a first-class capability independent of configurable-table metadata.

Static Transaction configuration uses it directly.

The validation engine consumes resolved rule arrays with stable registered rule keys plus JSON-safe params/messages:

```text
rules: [
  { key: required },
  { key: maxLength, params: { max: 100 } },
  { key: numberRange, params: { min: 0, max: 1000000 } }
]
```

Frontend owns executable validator functions. Do not accept arbitrary executable JavaScript/expressions from backend/configuration.

Current state behavior:

```text
invalid LOCAL value
→ keep LOCAL visible
→ keep row dirty
→ record field error by stable row ID + field
→ block relevant Row Save / exact Save Selected target
→ correction/revert revalidates and clears stale errors
```

Direct cell edits and current-page programmatic edits run the same validation semantics.

Backend structured field errors map into the same validation state while rejected LOCAL input remains visible and dirty.

Discard clears validation for discarded work. `Use server` clears validation for the LOCAL value it removes. `Keep my edit` revalidates the retained LOCAL value.

Validation and conflict remain separate and may coexist:

```text
Validation
→ is LOCAL acceptable?

Conflict
→ did REMOTE diverge from BASE while LOCAL exists?
```

Current implementation reference:

- `docs/implementation/grid-validation.md`.

Review `docs/implementation/grid-capability-tags.md` when the validation footprint changes.

---

## Import — after existing-capability regression hardening

Import is a separate workflow, not normal grid editing.

Do not start Import while the active regression-hardening backlog still contains agreed high-value gaps. Once that hardening is complete, design/implementation should cover the required file format, identifiers, mapping, preview, validation reuse, duplicate/error semantics and authoritative refresh without hiding Import inside normal tracked editing.

---

## Configurable-table experiment — after Import

Build configurable-table runtime work first as an **isolated fourth SSRM-based grid path**.

Rules:

- do not refactor `/client`, `/infinite` or `/ssrm` merely to make the experiment work;
- do not rewrite proven shared row-model mechanics while the composition boundary is still being proven;
- temporary feature-level duplication is acceptable when it protects proven behavior;
- frontend/application chooses which AG Grid row model(s) the product supports;
- backend metadata does not dynamically choose Client/Infinite/SSRM;
- backend metadata remains JSON-safe and does not send executable AG Grid definitions/functions;
- executable renderers/editors/formatters/validators/action behavior remain frontend implementations;
- only after the isolated path proves the architecture should existing Transaction composition be evaluated for migration;
- migration is not automatic.

---

## Current roadmap sequence

Always inspect `docs/grid-backlog.md` before deciding the next capability.

Current agreed sequence:

```text
1. complete regression hardening for already-implemented Client/Infinite/SSRM capabilities
2. keep manual baseline verification guides current
3. design/implement Import
4. build isolated configurable SSRM-based experiment
5. evaluate reuse/migration only after the experiment proves its boundary
```

When sequencing changes, update this file and `docs/grid-backlog.md` together.

---

## Testing expectations

Use layered testing deliberately:

```text
pure/state tests
→ deterministic algorithms, transforms, validation, selection math, BASE/LOCAL/REMOTE transitions, request races

component/integration tests
→ React wiring, callbacks, request mapping, save guards and feature composition

backend tests
→ serializers, authoritative policy, selected-row resolution, persistence/error contracts

TypeScript Playwright
→ real Django + Vite + Chromium + AG Grid DOM/network/lifecycle/editor integration
```

Meaningful behavior changes should have focused tests at stable boundaries, including as applicable:

- request mapping;
- datasource lifecycle;
- request freshness/cancellation;
- selection transformations;
- selected counts;
- row-model-specific clear behavior;
- selected business-action request/success/failure lifecycle;
- validation engine/state/Save guards;
- backend validation error mapping;
- backend selected-row resolution;
- export semantics;
- row eligibility;
- tracked editing/conflict reconciliation;
- Client native selection scopes;
- capability-marker coverage.

Test Client, Infinite and SSRM independently where lifecycle or selection implementation differs.

For every browser-visible/AG Grid lifecycle change, automated tests and documented manual/browser steps are complementary deliverables. Keep the manual checklist current in `docs/implementation/testing/`; do not treat green CI as a substitute for documenting what a human/browser regression pass should verify.

For material real-browser integration, add/update TypeScript Playwright coverage and follow `docs/implementation/testing/browser-regression.md`. Browser tests must use the repository fixture, deterministic per-test reset, stable row identities/selectors and real readiness conditions. Never make one test rely on a mutation from another test.

Review and update `docs/implementation/testing/coverage-matrix.md` when a capability or its protection changes. Existing capabilities are being brought up to this standard before the next product capability is started.

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

Typical browser verification (with the E2E backend + Vite running as documented):

```bash
cd tests/browser
npx playwright test
```

Inspect GitHub Actions after pushes.

---

## Git and PR workflow

GitHub is the repository-state source of truth.

`grid-foundation` is the continuous working branch.

Do not create another work/feature branch unless the user explicitly asks for one.

After a PR is merged into `main`, inspect actual GitHub state and synchronize `grid-foundation` before continuing when required.

Once `grid-foundation` contains meaningful committed work beyond the last merged state, maintain an open PR by default.

Keep the current open PR accurate as scope changes.

**Never merge a PR unless the user explicitly asks for the merge.**

If the user says a PR was merged, verify GitHub state first.

---

## Key current implementation documentation

- `docs/implementation/README.md`
- `docs/implementation/grid-capabilities.md`
- `docs/implementation/grid-capability-tags.md`
- `docs/implementation/ag-grid-native-usage.md`
- `docs/implementation/ag-grid.md`
- `docs/implementation/api-data-flow.md`
- `docs/implementation/row-models/client.md`
- `docs/implementation/row-models/infinite.md`
- `docs/implementation/row-models/ssrm.md`
- `docs/implementation/selection-counts.md`
- `docs/implementation/selected-action-selection-lifecycle.md`
- `docs/implementation/row-interaction.md`
- `docs/implementation/transaction-editing.md`
- `docs/implementation/grid-validation.md`
- `docs/implementation/edit-conflict-reconciliation.md`
- `docs/implementation/grid-export.md`
- `docs/implementation/testing/browser-regression.md`
- `docs/implementation/testing/coverage-matrix.md`

---

## Key source entry points

### Client

- `frontend/src/features/transactions/grid/TransactionsClientGrid.tsx`
- `frontend/src/features/transactions/api/transactions.queries.ts`
- `frontend/src/shared/grid/selection/client-side/useClientSideSelectionController.ts`

### Infinite

- `frontend/src/features/transactions/grid/TransactionsInfiniteGrid.tsx`
- `frontend/src/shared/grid/selection/infinite/useInfiniteSelectionController.tsx`
- `frontend/src/shared/grid/data/infinite/createInfiniteDatasource.ts`
- `frontend/src/shared/grid/data/infinite/useInfiniteRowLoading.ts`

### SSRM

- `frontend/src/features/transactions/grid/TransactionsSsrmGrid.tsx`
- `frontend/src/shared/grid/selection/server-side/useSsrmSelectionController.ts`
- `frontend/src/shared/grid/data/server-side/createServerSideDatasource.ts`
- `frontend/src/shared/grid/data/server-side/useServerSideRowLoading.ts`

### Editing and validation

- `frontend/src/shared/grid/editing/trackedGridEditing.ts`
- `frontend/src/shared/grid/editing/useTrackedGridEditing.ts`
- `frontend/src/shared/grid/editing/useCurrentPageEditActions.ts`
- `frontend/src/shared/grid/validation/gridValidation.ts`
- `frontend/src/shared/grid/validation/defaultGridValidationRules.ts`
- `frontend/src/features/transactions/grid/transactionEditing.ts`
- `frontend/src/features/transactions/grid/transactionValidation.ts`
- `frontend/src/features/transactions/grid/useTransactionEditPersistence.ts`

### Backend authority

- `backend/apps/transactions/services.py`
- `backend/apps/transactions/api/serializers.py`
- `backend/apps/transactions/api/views.py`

### Browser regression

- `tests/browser/fixtures.ts`
- `tests/browser/gridTestSupport.ts`
- `tests/browser/*.spec.ts`
- `backend/apps/transactions/e2e.py`
- `backend/apps/transactions/api/e2e_views.py`

---

## Required working style

When asked to implement or review something:

1. inspect current GitHub/repository state;
2. read this file and `docs/implementation/README.md`;
3. inspect `docs/implementation/testing/coverage-matrix.md` for the affected capability;
4. choose relevant row-model/capability docs;
5. locate relevant capability markers;
6. inspect implementation/tests/backend contracts;
7. identify architecture issues before coding;
8. implement native-first and row-model-specific where appropriate;
9. preserve useful comments and markers;
10. add/update the appropriate pure/component/backend test layers;
11. add/update TypeScript Playwright for material real-browser/AG Grid integration and use the repository auto-reset fixture;
12. update implementation docs only with implemented behavior;
13. **add/update manual/browser verification steps for every meaningful browser-visible or AG Grid lifecycle change**;
14. update the regression coverage matrix;
15. update relevant row-model guides when ownership/behavior changes;
16. keep planning/proposal material out of implementation docs;
17. update backlog/working contract when roadmap or durable rules change;
18. inspect CI;
19. run browser verification when the active environment can run/access the app;
20. keep the open PR accurate;
21. report manual/browser verification truthfully and distinguish documented steps from actually executed scenarios.

Push back when a requested approach weakens architecture or creates an abstraction without a real responsibility.

Do not overengineer or add unrelated infrastructure/dependencies.

---

## Maintenance rule

Review/update this file when work changes durable architecture/ownership, row-model responsibilities, documentation rules, capability discoverability, selection/count semantics, request freshness, eligibility, export/import behavior, editing/conflict/validation semantics, testing expectations, branch/PR workflow, roadmap sequencing, or source-of-truth paths.

Goal: **a new developer or new chat must be able to resume safely from the repository alone.**
