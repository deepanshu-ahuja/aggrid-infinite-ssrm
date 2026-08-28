# Grid Capability Tag Registry

This file is the **authoritative registry for searchable frontend grid capability markers** used in frontend source code and focused frontend tests.

The repository is intentionally a reference implementation that may later be mined for one grid capability at a time. A developer should be able to decide, for example, "I need Select All Filtered" or "I need safe AG Grid teardown", search one stable marker, and discover the important frontend integration points without remembering every hook, event, datasource adapter, feature API adapter, column boundary, and focused frontend test that participates in that capability.

Capability markers are a **frontend discoverability index**, not a replacement for architecture, API contracts, backend tests, feature documentation, or backend authority.

Backend code is deliberately **not** decorated with `GRIDCAP-*` markers. When a frontend capability depends on backend behavior, the registry or detailed docs may point to that backend contract, but the searchable marker remains frontend-only.

## How to use the registry

Example:

```text
I need Select All Filtered.

1. Find GRIDCAP-SEL-FILTERED in this registry.
2. Read its ownership/row-model notes below.
3. Search frontend source/tests for the exact marker:

   GRIDCAP-SEL-FILTERED

4. Review every marked frontend integration point before extracting/adapting the capability.
5. Read the linked detailed docs and any API/backend contract docs needed by that capability.
```

A frontend source location can participate in more than one capability:

```ts
// GRIDCAP-SEL-PAGE | GRIDCAP-PAGINATION
```

That is intentional. Shared frontend infrastructure is often the hidden dependency a developer could otherwise miss while extracting one feature.

## Marker rules

1. Every marker begins with the exact common prefix `GRIDCAP-`.
2. **Do not invent an ad-hoc tag in code.** Add/define it in this registry first.
3. `GRIDCAP-*` comments belong in **frontend source and focused frontend tests only**. Do not add them to Python/backend source or backend tests.
4. Tags describe a stable logical frontend capability or a deliberate row-model frontend foundation, not a filename or temporary implementation detail.
5. Use the same logical tag across Client-Side, Infinite and SSRM frontend implementations when they express the same user/business capability differently.
6. Multiple tags are allowed when one frontend boundary supports multiple capabilities.
7. Mark **extraction-relevant frontend boundaries**: concrete grid roots, controllers, shared algorithms, lifecycle/event boundaries, request/response adapters, feature API integration, column/editor presentation, and focused frontend tests. Do not tag every helper line or obvious UI statement.
8. A tag does **not** mean every marked implementation can be copied unchanged to every row model. Read the applicability notes and row-model-specific docs.
9. Preserve markers during frontend refactors when the capability still exists. If a capability is removed or materially redefined, update this registry and all affected frontend markers in the same PR.
10. Avoid casual tag renames. Searchability across Git history and developer notes is more valuable than naming churn.
11. Focused frontend tests may carry the same tag as production code so a developer can find the executable frontend contract with the implementation.
12. Documentation may mention tags, but this registry is the source of truth for marker meaning.
13. Backend contracts/eligibility/validation remain independently documented and tested; absence of `GRIDCAP-*` comments does not make them less authoritative.
14. When a meaningful grid capability is added, removed, or materially changed, review this registry as part of Definition of Done.

## Naming shape

Current pattern:

```text
GRIDCAP-<AREA>-<CAPABILITY>
```

Examples:

```text
GRIDCAP-SEL-FILTERED
GRIDCAP-EDIT-CONFLICT
GRIDCAP-EXPORT-SELECTED
GRIDCAP-LIFECYCLE-DESTROY
```

Row-model frontend foundation tags intentionally use:

```text
GRIDCAP-ROWMODEL-CLIENT
GRIDCAP-ROWMODEL-INFINITE
GRIDCAP-ROWMODEL-SSRM
```

These let a developer search for the important frontend pieces required by one complete row-model implementation in addition to searching for one logical feature.

---

# Registered tags

## A. Row-model foundation and AG Grid setup

### `GRIDCAP-ROWMODEL-CLIENT`

**Meaning:** Client-Side Row Model frontend foundation where the complete bounded working set is local and AG Grid owns local shaping.

**Applies to:** Client-Side only.

**Important frontend touchpoints:**
- `frontend/src/features/transactions/grid/TransactionsClientGrid.tsx`
- `frontend/src/features/transactions/transactionsGrid.config.ts`
- `frontend/src/features/transactions/api/transactions.queries.ts`
- `frontend/src/shared/grid/config/clientSideGridDefaults.ts`
- `frontend/src/shared/grid/selection/client-side/useClientSideSelectionController.ts`
- `frontend/src/shared/grid/export/exportSelectedRowsCsv.ts`
- focused Client frontend tests

**Related docs/contracts:** `docs/client-side-grid.md` and the Transaction collection API contract.

**Extraction note:** do not copy server datasource/include-exclude machinery into Client-Side merely for symmetry.

### `GRIDCAP-ROWMODEL-INFINITE`

**Meaning:** Infinite Row Model frontend foundation including datasource/block-loading lifecycle and Infinite-specific selection gaps.

**Applies to:** Infinite only.

**Important frontend touchpoints:**
- `frontend/src/features/transactions/grid/TransactionsInfiniteGrid.tsx`
- `frontend/src/features/transactions/transactionsGrid.config.ts`
- `frontend/src/shared/grid/data/infinite/createInfiniteDatasource.ts`
- `frontend/src/shared/grid/data/infinite/useInfiniteRowLoading.ts`
- `frontend/src/shared/grid/selection/infinite/`
- Infinite frontend tests

**Related docs/contracts:** `frontend/src/infinite-selection-contract.md` and server query/API docs.

### `GRIDCAP-ROWMODEL-SSRM`

**Meaning:** flat Enterprise Server-Side Row Model frontend foundation, including SSRM datasource/store lifecycle and native server-side selection state where appropriate.

**Applies to:** SSRM only.

**Important frontend touchpoints:**
- `frontend/src/features/transactions/grid/TransactionsSsrmGrid.tsx`
- `frontend/src/features/transactions/transactionsGrid.config.ts`
- `frontend/src/shared/grid/data/server-side/createServerSideDatasource.ts`
- `frontend/src/shared/grid/data/server-side/useServerSideRowLoading.ts`
- `frontend/src/shared/grid/selection/server-side/useSsrmSelectionController.ts`
- `frontend/src/shared/grid/gridModules.ts`
- SSRM frontend tests

**Related docs/contracts:** `frontend/src/ssrm-selection-contract.md` and server query/API docs.

### `GRIDCAP-SETUP-MODULES`

**Meaning:** frontend AG Grid module registration required before row-model/runtime APIs are usable.

**Applies to:** all row models; SSRM additionally requires Enterprise modules.

**Important frontend touchpoints:**
- `frontend/src/shared/grid/gridModules.ts`
- application AG Grid bootstrap/provider

**Related docs:** `docs/ag-grid-native-usage.md`.

### `GRIDCAP-SETUP-ENTERPRISE`

**Meaning:** Enterprise-only frontend setup such as SSRM modules/API modules and license initialization.

**Applies to:** SSRM / other future Enterprise features.

**Important frontend touchpoints:**
- `frontend/src/shared/grid/gridModules.ts`
- `frontend/src/shared/grid/enterpriseLicense.ts`
- application bootstrap/environment configuration

---

## B. Data loading, query shaping, identity, and request lifecycle

### `GRIDCAP-DATA-LOAD`

**Meaning:** getting authoritative row data into a grid while preserving the correct frontend owner for each row model.

**Client:** full bounded collection through TanStack Query -> editable `rowData` projection.

**Infinite/SSRM:** AG Grid datasource lifecycle -> feature request mapper -> typed API adapter -> rows/counts -> row model/cache/store.

**Important frontend touchpoints:**
- `frontend/src/features/transactions/api/transactions.api.ts`
- `frontend/src/features/transactions/api/transactions.queries.ts`
- `frontend/src/shared/grid/data/`
- `frontend/src/features/transactions/grid/transactionRequest.mapper.ts`
- concrete grid roots

**Related backend contract:** collection/query endpoints remain documented normally and are not tagged.

### `GRIDCAP-QUERY-SORT`

**Meaning:** frontend/native ownership of sort behavior without duplicate sort state.

**Client:** AG Grid sorts local `rowData`.

**Infinite/SSRM:** AG Grid sort model is translated into the feature/API contract.

**Important frontend touchpoints:**
- `frontend/src/features/transactions/grid/transactionColumns.tsx`
- `frontend/src/features/transactions/grid/transactionRequest.mapper.ts`
- `frontend/src/shared/grid/query/gridQuery.contracts.ts`

### `GRIDCAP-QUERY-FILTER`

**Meaning:** local Client filtering or frontend server-filter-model translation, including filter-dependent semantics.

**Important frontend touchpoints:**
- `frontend/src/features/transactions/grid/transactionColumns.tsx`
- `frontend/src/shared/grid/config/serverFilterParams.ts`
- `frontend/src/features/transactions/grid/transactionRequest.mapper.ts`
- selection controllers where `GRIDCAP-SEL-FILTERED` reacts to filter changes

**Related backend contract:** server filter allow-list/semantics are documented and tested separately.

### `GRIDCAP-PAGINATION`

**Meaning:** native user-facing pagination and the exact current-page frontend boundary; server cache block size is not page size.

**Applies to:** all current row models.

**Important frontend touchpoints:**
- `frontend/src/shared/grid/config/clientSideGridDefaults.ts`
- `frontend/src/shared/grid/config/serverBackedGridDefaults.ts`
- `frontend/src/shared/grid/pagination/getCurrentPageNodes.ts`
- `frontend/src/shared/grid/pagination/useCurrentPageRowTarget.ts`
- Current Page selection/edit/export callers

### `GRIDCAP-ROW-ID`

**Meaning:** stable business/backend row identity used by frontend grid state instead of displayed row position/index.

**Applies to:** all row models and tracked editing/selection.

**Important frontend touchpoints:**
- concrete grid roots (`getRowId`)
- selection targets
- tracked editing state

### `GRIDCAP-REQUEST-FRESHNESS`

**Meaning:** latest-**started** server row request owns renderable frontend count metadata; older responses may finish AG Grid lifecycle but cannot overwrite newer metadata.

**Applies to:** Infinite and SSRM.

**Important frontend touchpoints:**
- `frontend/src/shared/grid/data/infinite/createInfiniteDatasource.ts`
- `frontend/src/shared/grid/data/server-side/createServerSideDatasource.ts`
- row-loading hooks
- `frontend/src/shared/grid/data/datasources.test.ts`

**Critical rule:** request order, not higher/lower page number, decides freshness.

### `GRIDCAP-REQUEST-CANCEL`

**Meaning:** cancel/abort obsolete frontend datasource work when a datasource/grid lifecycle ends.

**Applies to:** Infinite and SSRM server requests.

**Important frontend touchpoints:**
- Infinite/SSRM datasource adapters and their `destroy()` behavior
- datasource tests
- root teardown/refresh ownership where relevant

### `GRIDCAP-ERROR-RETRY`

**Meaning:** row-load error presentation and retry/refetch using the correct row-model frontend lifecycle.

**Applies to:** all current row models, with different retry/refetch owners.

**Important frontend touchpoints:**
- `frontend/src/shared/grid/overlays/`
- Client TanStack Query `refetch`
- Infinite datasource refresh/retry path
- SSRM `retryServerSideLoads()` path
- concrete grid roots

### `GRIDCAP-LIFECYCLE-REFRESH`

**Meaning:** obtaining authoritative data again after a successful mutation or explicit refresh without inventing one fake universal frontend refresh API.

**Client:** update/refetch TanStack Query collection.

**Infinite:** `refreshInfiniteCache()`.

**SSRM:** `refreshServerSide()`.

**Important frontend touchpoints:**
- concrete grid roots
- `frontend/src/features/transactions/grid/useTransactionEditPersistence.ts`
- selected business-action callbacks
- Client collection query ownership

---

## C. Selection and selected business operations

### `GRIDCAP-SEL-MANUAL`

**Meaning:** explicit/manual multi-row selection based on stable row IDs.

**Applies to:** Client, Infinite and SSRM through their native frontend selection mechanisms.

### `GRIDCAP-SEL-PAGE`

**Meaning:** Select Current Page over the exact native pagination page, not a server cache block.

**Applies to:** all current row models.

**Important frontend touchpoints:**
- Client native `selectAll: 'currentPage'`
- Infinite Current Page header/controller
- SSRM current-page command
- `frontend/src/shared/grid/pagination/getCurrentPageNodes.ts`
- `frontend/src/shared/grid/pagination/useCurrentPageRowTarget.ts`

### `GRIDCAP-SEL-FILTERED`

**Meaning:** Select All Filtered and its frontend filter-universe lifecycle.

**Client:** native `selectAll: 'filtered'` plus project filter-change reset semantic.

**Infinite:** application-owned dataset-wide logical selection because unloaded rows have no RowNodes.

**SSRM:** custom filtered-wide semantic layered beside native SSRM selection.

**Critical rule:** if the defining filter changes while filtered-wide selection is active, clear that old filtered-wide selection so it is not silently reinterpreted against a new universe.

### `GRIDCAP-SEL-ALL`

**Meaning:** Select All Records across the row model's complete selection universe.

**Client:** native local `selectAll: 'all'` and exact eligibility-aware selected rows.

**Infinite:** logical dataset-wide include/exclude frontend state for unloaded rows.

**SSRM:** native Enterprise server-side All Records selection state.

### `GRIDCAP-COUNT-SELECTED`

**Meaning:** user-visible selected-row total and its frontend source of truth.

**Client:** exact `api.getSelectedRows().length` because all selectable rows are local.

**Infinite/SSRM dataset-wide:** API `totalCount` / `filteredCount` minus user exceptions under the documented eligibility-count limitation.

**Important frontend touchpoints:**
- row-model selection controllers
- `frontend/src/shared/grid/selection/selectionCount.ts`
- row-loading count metadata

**Related docs:** `docs/selection-counts.md`.

### `GRIDCAP-SEL-TARGET`

**Meaning:** frontend operation-neutral logical selection target that answers **which rows** a selected backend operation should address.

**Important frontend touchpoints:**
- `frontend/src/shared/grid/selection/serverSelection.ts`
- `frontend/src/shared/grid/selection/gridSelectionActionTarget.ts`
- `frontend/src/features/transactions/grid/transactionSelectionAction.ts`
- Transaction frontend API contracts/adapters

**Cross-capability dependency:** selected business actions and server-backed Selected export must construct the same frontend target meaning.

**Related backend contract:** backend resolution remains authoritative but is intentionally untagged.

### `GRIDCAP-ACTION-SELECTED`

**Meaning:** apply a feature business mutation to the current frontend selection target while backend eligibility remains authoritative.

**Important frontend touchpoints:**
- `frontend/src/features/transactions/grid/TransactionSelectionActions.tsx`
- `frontend/src/features/transactions/grid/useTransactionSelectionAction.ts`
- `frontend/src/features/transactions/grid/transactionSelectionAction.ts`
- Transaction frontend API client/contracts
- row-model-specific refresh after success

### `GRIDCAP-ROW-ELIGIBILITY`

**Meaning:** frontend handling of generic `enabled` / `selectionDisabled` / `readOnly` interaction semantics.

**Important frontend touchpoints:**
- `frontend/src/shared/grid/rows/`
- `frontend/src/features/transactions/grid/transactionRowInteraction.ts`
- Transaction columns/cell presentation
- row-model selection/editing guards

**Critical distinction:** business-ineligible rows are not manufactured as user deselection exception IDs.

**Related backend contract:** the backend still enforces authoritative eligibility without `GRIDCAP-*` comments.

---

## D. Editing, save/discard, and conflicts

### `GRIDCAP-EDIT-TRACKED`

**Meaning:** stable-ID unsaved frontend draft state outside transient RowNodes, including safe programmatic overlay bookkeeping.

**Important frontend touchpoints:**
- `frontend/src/shared/grid/editing/trackedGridEditing.ts`
- `frontend/src/shared/grid/editing/useTrackedGridEditing.ts`
- concrete grid roots' `onCellValueChanged` and restore/reconcile events

### `GRIDCAP-EDIT-PAGE-APPLY`

**Meaning:** programmatically apply the last edit or explicit edit changes to eligible rows on the exact current page.

**Important frontend touchpoints:**
- `frontend/src/shared/grid/editing/useCurrentPageEditActions.ts`
- current-page resolver
- editing controls
- row eligibility

### `GRIDCAP-EDIT-SAVE-ROW`

**Meaning:** persist one explicit dirty row independently of checkbox selection.

**Important frontend touchpoints:**
- row edit action renderer/context
- `frontend/src/features/transactions/grid/useTransactionEditPersistence.ts`
- frontend single-row API adapter
- tracked-edit acknowledgement

### `GRIDCAP-EDIT-SAVE-SELECTED`

**Meaning:** persist `dirty rows ∩ current selection` as explicit dirty row patches; do not transform Select All into edits for untouched rows.

**Important frontend touchpoints:**
- concrete grid roots
- editing controls
- tracked editing selection intersection
- `frontend/src/features/transactions/grid/useTransactionEditPersistence.ts`
- frontend bulk API adapter

### `GRIDCAP-EDIT-DISCARD`

**Meaning:** restore the latest authoritative value and remove the relevant tracked frontend draft for one row or selected dirty rows.

**Important frontend touchpoints:**
- tracked editing state/hook
- row action renderer
- editing controls
- concrete roots

### `GRIDCAP-EDIT-CONFLICT`

**Meaning:** frontend BASE / LOCAL / REMOTE reconciliation, field-level conflicts, Use server / Keep my edit, and conflict-aware mutation guards.

**Important frontend touchpoints:**
- `frontend/src/shared/grid/editing/trackedGridEditing.ts`
- `frontend/src/shared/grid/editing/useTrackedGridEditing.ts`
- Transaction conflict cell/popover presentation
- save/selected-action conflict guards in concrete roots
- refresh/reconciliation lifecycle

**Related docs:** `docs/edit-conflict-reconciliation.md`.

### `GRIDCAP-COUNT-EDITED`

**Meaning:** exact frontend count of dirty **rows**, not dirty fields/cells.

**Important frontend touchpoints:**
- tracked editing payload derivation
- `frontend/src/shared/grid/editing/useTrackedGridEditing.ts`
- `frontend/src/features/transactions/grid/TransactionEditingControls.tsx`

**Related docs:** `docs/edited-row-count.md`.

---

## E. Export

### `GRIDCAP-EXPORT-PAGE`

**Meaning:** native AG Grid CSV export over exactly the fully resolved current pagination page.

**Applies to:** Client, Infinite and SSRM.

**Important frontend touchpoints:**
- `frontend/src/shared/grid/export/exportCurrentPageCsv.ts`
- `frontend/src/shared/grid/pagination/getCurrentPageNodes.ts`
- concrete grid export handlers
- export UI

**Eligibility semantic:** page snapshot includes `selectionDisabled` / `readOnly` rows if displayed.

### `GRIDCAP-EXPORT-SELECTED`

**Meaning:** frontend Selected export integration using the data owner that can enumerate the selected universe authoritatively.

**Client:** native/local AG Grid selected CSV across pagination pages.

**Infinite/SSRM:** frontend sends the shared logical selection target to the backend selected-export API because selected rows may be unloaded.

**Important frontend touchpoints:**
- `frontend/src/shared/grid/export/exportSelectedRowsCsv.ts` (Client local/native mechanic)
- `frontend/src/features/transactions/grid/useTransactionExport.ts` (server-backed selected export integration)
- concrete grid roots
- Transaction frontend API client/contracts
- focused frontend export tests

**Related backend contract:** selected-export endpoint/resolver is documented/tested normally and intentionally untagged.

**Related docs:** `docs/grid-export.md`.

---

## F. State, presentation, and lifecycle safety

### `GRIDCAP-STATE-PERSISTENCE`

**Meaning:** persist intentional native AG Grid user preference state while keeping transient business state such as row selection/pagination out of the current durable contract.

**Important frontend touchpoints:**
- `frontend/src/shared/grid/state/gridStatePersistence.ts`
- `frontend/src/shared/grid/state/useGridStatePersistence.ts`
- concrete grid roots and their distinct storage keys
- frontend state persistence tests

### `GRIDCAP-LIFECYCLE-DESTROY`

**Meaning:** safe frontend AG Grid teardown: clear root-owned `GridApi` refs, stop obsolete async/listener work, and avoid calling destroyed APIs.

**Important frontend touchpoints:**
- concrete Client/Infinite/SSRM grid roots (`onGridPreDestroyed`)
- listener cleanup with `api.isDestroyed()` guards
- datasource `destroy()` / cancellation
- warning #26 frontend regression coverage

### `GRIDCAP-COLUMNS`

**Meaning:** feature-owned native `ColDef` composition, including row-model-specific filter parameters, editors, renderers, editability, utility columns, formatting, and conflict/interaction presentation.

**Important frontend touchpoints:**
- `frontend/src/features/transactions/grid/transactionColumns.tsx`
- status editor/renderer
- row interaction cell/action renderer
- shared default column definition

**Rule:** this tag identifies frontend column composition; it does not justify building a custom column abstraction over native `ColDef`.

### `GRIDCAP-THEME`

**Meaning:** shared frontend AG Grid visual theme/global default setup without hiding concrete grid behavior.

**Important frontend touchpoints:**
- `frontend/src/theme/ag-grid/agGridTheme.ts`
- shared/global default-column setup
- application grid provider/global options

**Related docs:** `docs/theming.md`.

---

# Cross-capability examples

These examples show why more than one marker may appear at one frontend boundary.

## Current Page resolver

Expected relationship:

```text
GRIDCAP-PAGINATION
GRIDCAP-SEL-PAGE
GRIDCAP-EDIT-PAGE-APPLY
GRIDCAP-EXPORT-PAGE
```

The exact page boundary is shared; the operations performed on that page are different.

## Frontend selected-operation target

Expected relationship:

```text
GRIDCAP-SEL-TARGET
GRIDCAP-ACTION-SELECTED
GRIDCAP-EXPORT-SELECTED
```

The frontend target answers which rows the user intended to address. Mutation/export then send that target to their respective API operations. Backend resolution remains a separate authoritative contract and is intentionally not tagged.

## Server datasource freshness boundary

Expected relationship:

```text
GRIDCAP-ROWMODEL-INFINITE or GRIDCAP-ROWMODEL-SSRM
GRIDCAP-DATA-LOAD
GRIDCAP-REQUEST-FRESHNESS
GRIDCAP-REQUEST-CANCEL
```

## Concrete grid roots

Concrete roots legitimately carry many tags because they are composition/integration boundaries. That is preferable to hiding the integration inside one giant wrapper solely to make extraction look simpler.

---

# Maintenance checklist for future capabilities

When adding/changing a grid capability:

1. search this registry for an existing logical tag;
2. reuse the existing tag if the meaning is the same even when frontend implementation differs by row model;
3. if a genuinely new frontend capability exists, define a stable tag here first;
4. mark important frontend production integration points;
5. mark focused frontend executable tests where useful;
6. do **not** add `GRIDCAP-*` markers to Python/backend files or backend tests;
7. allow multiple tags on shared frontend boundaries;
8. update relevant feature/native/API/manual docs;
9. verify a frontend repository search for the tag gives a useful extraction map rather than dozens of meaningless comments;
10. preserve existing useful frontend markers during refactors;
11. update `AGENTS.md` if the tagging/maintenance contract itself changes.

> **The goal is not to decorate the code. The goal is to make frontend capability extraction and dependency discovery reliable.**
