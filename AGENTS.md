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
7. inspect the current source/tests rather than assuming an old PR description is still true.

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

Documentation must make its purpose clear.

### Canonical current implementation area

`docs/implementation/` is the canonical home for documentation that explains behavior implemented by the repository now.

Start with:

- `docs/implementation/README.md`.

If a current implementation document says a configuration key, API, behavior, hook, option, state transition or capability exists, the current code must actually support it.

Do not put these into current implementation docs merely because they were discussed:

- rejected approaches;
- hypothetical runtime configuration;
- speculative APIs;
- possible future registries;
- conversation history;
- options that current code does not expose;
- proposed solutions for requirements that do not exist yet.

Current limitations are appropriate when they state what the code does **not** implement today. Proposed future solutions belong in backlog/planning or clearly identified architecture proposal material.

### Row-model implementation entry points

A developer must be able to understand one row model without first reading all three.

Canonical row-model guides are:

- `docs/implementation/row-models/client.md`;
- `docs/implementation/row-models/infinite.md`;
- `docs/implementation/row-models/ssrm.md`.

Detailed row-model-specific selection contracts are kept beside the row-model guides where applicable.

Row-model guides should explain the model-specific ownership of:

- loading/data source lifecycle;
- selection;
- counts where they differ;
- refresh/retry;
- editing integration;
- export ownership;
- Grid State/lifecycle;
- main implementation entry points.

### Shared capability docs

When a user-facing capability is shared across Client, Infinite and SSRM, keep one capability document instead of duplicating it three times.

A shared capability document must explicitly call out meaningful row-model differences.

Examples:

- `docs/implementation/selection-counts.md`;
- `docs/implementation/transaction-editing.md`;
- `docs/implementation/edit-conflict-reconciliation.md`;
- `docs/implementation/grid-export.md`;
- `docs/implementation/row-interaction.md`.

Do not make a shared document imply one universal implementation when Client, Infinite and SSRM use different native mechanics.

### Manual verification docs

Current manual verification material lives under:

- `docs/implementation/testing/`.

Manual verification documents describe scenarios to run. Never claim a browser/manual pass was completed unless it actually was.

### Backlog / planning

`docs/grid-backlog.md` may describe unfinished work, design questions, sequencing and future capabilities because it is explicitly a planning/control document.

### Architecture proposals

Clearly identified proposal/target-architecture docs may describe a future architecture that is not implemented yet.

Current configurable-table proposal material includes:

- `docs/configurable-table-architecture-brief.md`;
- `docs/metadata-driven-table-architecture.md`;
- `docs/metadata-driven-ui-overview.md`.

Do not make proposal text sound like current runtime behavior.

### Working contract

`AGENTS.md` may contain durable engineering/workflow rules and agreed roadmap sequencing. It must not pretend an unsupported runtime capability exists.

When code and a current implementation doc disagree, inspect source/tests, determine current intended behavior and fix the inconsistency in the same work.

When moving/renaming current implementation documentation, update `README.md`, this file, capability registry references and important internal links. Compatibility move stubs may remain at old `docs/*.md` paths, but canonical content belongs under `docs/implementation/`.

---

## Definition of done

A meaningful capability is not complete with code alone.

Expected deliverables normally include:

- production-quality implementation;
- focused automated tests;
- useful comments/JSDoc for non-obvious ownership, state or lifecycle logic;
- current implementation documentation;
- explicit current limitations;
- manual verification guidance when browser/AG Grid lifecycle behavior matters;
- capability-tag review when the frontend capability footprint changes;
- backlog/status updates when sequencing/status changes;
- CI validation;
- accurate PR description.

A developer should be able to understand current behavior without reconstructing chat history or Git archaeology.

Never claim manual/browser verification unless it was actually performed.

---

## Capability-tag discoverability

`docs/implementation/grid-capability-tags.md` is the authoritative registry for frontend `GRIDCAP-*` markers.

Working flow:

```text
need a frontend grid capability
→ find its GRIDCAP-* registry entry
→ read applicability / row-model ownership
→ search the exact marker in frontend source/tests
→ inspect every important marked integration point
→ inspect linked implementation docs
→ separately inspect required backend/API contracts
```

Rules:

- markers belong in frontend source and focused frontend tests only;
- do not add markers to Python/backend source or backend tests;
- define a genuinely new marker in the registry before adding it to source;
- use one logical marker across row models when the user-facing capability is shared but implementation differs;
- a marker means a location participates in a capability, not that its implementation can be copied unchanged;
- preserve accurate markers during refactors;
- review registry and occurrences when a frontend capability materially changes;
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

Promote code to `shared/grid` only when it is genuinely domain-neutral.

Transaction-specific fields, API mapping, business actions, validation rules/messages and feature UI remain feature/backend-owned.

Do not create an abstraction merely because a few callers repeat lines. Shared abstractions should own a real stable responsibility such as lifecycle, validation, normalization, algorithmic behavior, third-party adaptation, retry/cancellation or another proven shared boundary.

Use TanStack Query at normal application/API boundaries when useful. Do not force it into Infinite/SSRM datasource loading merely for consistency; AG Grid datasource lifecycle is the natural owner there.

---

## Row-model independence

The repository demonstrates three row models:

```text
/client
/infinite
/ssrm
```

A real application may use all three, only one, or a subset.

**Do not create dependencies that require all three row models to exist together.**

The row models implement similar semantics independently when their native mechanics differ.

### Client-Side

Client receives the complete bounded Transaction working set through TanStack Query and passes editable row copies to native `rowData`.

AG Grid owns local sorting, filtering, pagination and selection.

Native Select All scopes:

```text
page      → currentPage
filtered  → filtered
all       → all
```

Selected IDs/count are exact because all rows are local and native selectability is evaluated over the complete working set.

Selected export is native/local.

### Infinite

Infinite has concrete RowNodes only for loaded rows.

Native loaded/manual/current-page selection remains native where possible.

Filtered/all dataset-wide selection uses compact include/exclude application state because unloaded rows do not have RowNodes.

### SSRM

SSRM uses native Enterprise server-side selection state where AG Grid supports the required meaning.

Application-owned state exists only for the current All Filtered semantic gap.

Do not move all SSRM selection into React merely to resemble Infinite.

### Selection controllers remain separate

```text
useClientSideSelectionController()
useInfiniteSelectionController()
useSsrmSelectionController()
```

They may expose similarly named semantic operations such as `clearSelection()`, but each owns different mechanics.

Do not replace them with one row-model switch or universal selection controller.

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

Server `totalCount` / `filteredCount` currently describe query membership rather than exact selected-operation eligibility.

Do not subtract only restricted rows currently loaded in browser; unloaded pages may contain additional restricted rows and that would create false precision.

Detailed current behavior: `docs/implementation/selection-counts.md`.

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

This rule is based on request-start order, not page number.

Retain forward and backward request-order tests.

---

## Filter-dependent selection

Filtered-wide selection is defined by the active filter universe.

```text
Select All Filtered
→ defining filter changes
→ clear/reset that filtered-wide selection

Select All Records
→ visible filter changes
→ remains All Records

explicit/manual IDs
→ do not become a new filtered-wide selection
```

---

## Row interaction and backend authority

Current generic row modes:

```text
enabled
selectionDisabled
readOnly
```

The frontend prevents invalid loaded-row interaction where possible. Backend authority remains required for authoritative operations and unloaded rows.

Do not confuse:

```text
user exception IDs
→ rows explicitly deselected by the user

backend eligibility
→ rows an operation is allowed to affect
```

Restricted rows are not manufactured as logical exclude IDs.

Detailed current behavior: `docs/implementation/row-interaction.md`.

---

## Export contract

### Current Page

All three row models use native AG Grid CSV over the exact fully resolved current pagination page.

If the expected page is not fully materialised, refuse partial export.

Current Page is a page snapshot; displayed restricted rows are included.

### Selected — Client

Use native/local selected-row CSV across pagination pages.

### Selected — Infinite / SSRM

Use backend selected export because the logical selected universe can contain unloaded rows.

The same logical backend resolver semantics are reused for selected mutation and selected export.

Detailed current behavior: `docs/implementation/grid-export.md`.

---

## Current selected business action

Transactions currently implements one selected **Change Status** mutation family:

```text
Mark Completed
Mark Pending
Mark Failed
```

Those controls differ by status value and use the same selected-update request path.

Current lifecycle:

```text
current selection target
→ Change Status request
→ backend succeeds
→ concrete grid root calls its existing row-model clearSelection()
→ concrete grid root refreshes authoritative data
```

If the backend request fails, the success callback does not run and selection remains available.

The implemented request does not carry a selection-lifecycle configuration value.

Different row models clear through their own existing controllers; there is no universal clear implementation.

Detailed current behavior: `docs/implementation/selected-action-selection-lifecycle.md`.

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
- local-overlay protection so programmatic values are not mistaken for fresh REMOTE data.

Conflict state and editing behavior are documented in:

- `docs/implementation/transaction-editing.md`;
- `docs/implementation/edit-conflict-reconciliation.md`.

---

## Validation — next implementation

Validation is a first-class capability independent of configurable-table metadata.

Static Transaction configuration must be able to use it directly.

The validation engine should consume resolved rule arrays using stable registered rule keys plus JSON-safe params/messages, conceptually:

```text
rules: [
  { key: required },
  { key: maxLength, params: { max: 100 } },
  { key: numberRange, params: { min: 0, max: 1000000 } }
]
```

Frontend owns executable validator functions through a registry.

Do not accept arbitrary executable JavaScript/expressions from backend/configuration.

A reusable rule-profile key may be considered only when repeated real rule combinations justify it; the validation engine itself should still operate on resolved rules.

### Validation state

Required behavior:

```text
user commits invalid LOCAL value
→ keep LOCAL visible
→ keep row dirty
→ record field error outside transient RowNodes by row ID + field
→ block relevant Save
→ correction/revert revalidates and clears stale errors
```

Backend structured field errors should map into the same validation state while rejected LOCAL input remains visible.

### Validation and conflict remain separate

```text
Validation
→ is LOCAL acceptable?

Conflict
→ did REMOTE diverge from BASE while LOCAL exists?
```

A field may be invalid, conflicted, or both.

Do not collapse validation into the tracked conflict state merely because Save/presentation need to coordinate both.

Validation implementation should cover direct edits, current-page programmatic edits, row Save, selected Save, backend field errors, correction/revert, Discard, conflict-resolution interaction, presentation and focused Client/Infinite/SSRM integration tests.

Review `docs/implementation/grid-capability-tags.md` before adding/reusing a validation marker.

---

## Import — after validation

Import is a separate workflow, not normal grid editing.

The implementation/design phase should cover as required:

- file/template formats;
- create/update/upsert semantics;
- stable identifiers;
- field mapping;
- preview/dry-run;
- validation reuse;
- duplicate handling;
- atomic versus partial success;
- row/field error reporting;
- downloadable error output when useful;
- progress/cancellation for large jobs when required;
- authoritative post-import refresh.

---

## Configurable-table experiment — after Import

Build the configurable-table runtime first as an **isolated fourth SSRM-based grid path**.

Purpose: prove the metadata compiler/resolver/registry composition boundary without risking the three proven Transaction grids.

Rules:

- do not refactor `/client`, `/infinite` or `/ssrm` merely to make the experiment work;
- do not rewrite proven shared loading, selection, tracked editing, conflict, freshness, lifecycle or Grid State algorithms while the composition boundary is still being proven;
- temporary feature-level duplication is acceptable when it protects proven behavior;
- frontend/application chooses which AG Grid row model(s) the product supports;
- backend metadata does not dynamically choose Client/Infinite/SSRM;
- backend metadata remains JSON-safe and does not send executable AG Grid definitions/functions;
- executable renderers/editors/formatters/validators/action behavior remain frontend implementations resolved through supported registries;
- only after the isolated path proves the architecture should existing Transaction composition be evaluated for migration;
- migration is not automatic.

---

## Current roadmap sequence

Always read `docs/grid-backlog.md` before deciding the next capability.

Current agreed sequence:

```text
1. maintain existing Client/Infinite/SSRM baseline verification
2. implement validation
3. design/implement Import
4. build isolated configurable SSRM-based experiment
5. evaluate reuse/migration only after the experiment proves its boundary
```

Manual browser verification remains important but can be consolidated later unless a genuine correctness defect requires immediate interruption.

When sequencing changes, update this file and `docs/grid-backlog.md` together.

---

## Testing expectations

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

Test Client, Infinite and SSRM independently where their lifecycle or selection implementation differs.

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

Inspect GitHub Actions after pushes.

---

## Git and PR workflow

GitHub is the repository-state source of truth.

### Continuous branch

`grid-foundation` is the continuous working branch.

Do not create another work/feature branch unless the user explicitly asks for one.

After a PR is merged into `main`, inspect actual GitHub state and synchronize `grid-foundation` before continuing when required.

Do not write blindly onto a stale branch.

### Open PR expectation

Once `grid-foundation` contains meaningful committed work beyond the last merged state, maintain an open PR by default.

Do not leave meaningful ongoing branch work without a PR merely because the user did not explicitly ask for one.

Keep the existing open PR updated as more work is added to the same continuous branch.

### Merge rule

**Never merge a PR unless the user explicitly asks for the merge.**

If the user says a PR was merged, verify GitHub state first before continuing.

PR descriptions must stay accurate as scope changes, including:

- behavior delivered;
- architecture/ownership decisions;
- documentation changes;
- limitations;
- automated validation;
- manual verification status;
- capability-marker changes when relevant.

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
- `docs/implementation/edit-conflict-reconciliation.md`
- `docs/implementation/grid-export.md`

---

## Key source entry points

### Client

- `frontend/src/features/transactions/grid/TransactionsClientGrid.tsx`
- `frontend/src/features/transactions/api/transactions.queries.ts`
- `frontend/src/shared/grid/selection/client-side/useClientSideSelectionController.ts`
- `frontend/src/shared/grid/config/clientSideGridDefaults.ts`
- `frontend/src/shared/grid/export/exportSelectedRowsCsv.ts`

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

### Selection / selected action / export

- `frontend/src/shared/grid/selection/gridSelectionActionTarget.ts`
- `frontend/src/features/transactions/grid/TransactionSelectionActions.tsx`
- `frontend/src/features/transactions/grid/transactionSelectionAction.ts`
- `frontend/src/features/transactions/grid/useTransactionSelectionAction.ts`
- `frontend/src/features/transactions/grid/useTransactionExport.ts`
- `frontend/src/features/transactions/api/transactions.contracts.ts`

### Editing

- `frontend/src/shared/grid/editing/trackedGridEditing.ts`
- `frontend/src/shared/grid/editing/useTrackedGridEditing.ts`
- `frontend/src/shared/grid/editing/useCurrentPageEditActions.ts`
- `frontend/src/features/transactions/grid/transactionEditing.ts`
- `frontend/src/features/transactions/grid/transactionColumns.tsx`
- `frontend/src/features/transactions/grid/useTransactionEditPersistence.ts`

### Backend authoritative behavior

- `backend/apps/transactions/services.py`
- `backend/apps/transactions/api/serializers.py`
- `backend/apps/transactions/api/views.py`

---

## Required working style

When asked to implement or review something:

1. inspect current GitHub/repository state;
2. read this file and `docs/implementation/README.md`;
3. choose the relevant row-model guide(s);
4. locate relevant capability markers;
5. inspect current implementation/tests and backend contracts;
6. identify architecture issues before coding;
7. implement native-first and row-model-specific where appropriate;
8. preserve useful comments and markers;
9. add comments for new non-obvious logic;
10. add/update focused tests;
11. update current implementation docs only with implemented behavior;
12. update the relevant row-model guide when row-model ownership/behavior changes;
13. put planned/future material only in backlog/proposal docs;
14. update backlog/working contract when roadmap or durable rules change;
15. inspect CI;
16. keep the open PR accurate;
17. report manual verification truthfully.

Push back when a requested approach weakens architecture or introduces an abstraction without a real responsibility.

Do not overengineer or add unrelated infrastructure/dependencies.

---

## Maintenance rule

Review/update this file when work changes durable:

- architecture/ownership;
- row-model responsibilities;
- documentation structure/scope rules;
- capability discoverability;
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
