# Grid Capability Tag Registry

This file is the **authoritative registry for searchable grid capability markers** used in source code and focused tests.

The repository is intentionally a reference implementation that may later be mined for one capability at a time. A developer should be able to decide, for example, "I need Select All Filtered" or "I need safe AG Grid teardown", search one stable marker, and discover the important integration points without remembering every hook, event, API mapper, backend resolver, and test that participates in that capability.

Capability markers are a **discoverability index**, not a replacement for architecture, types, tests, or feature documentation.

## How to use the registry

Example:

```text
I need Select All Filtered.

1. Find GRIDCAP-SEL-FILTERED in this registry.
2. Read its ownership/row-model notes below.
3. Search the repository for the exact marker:

   GRIDCAP-SEL-FILTERED

4. Review every marked integration point before extracting/adapting the capability.
5. Read the linked detailed docs/tests before copying code.
```

A source location can participate in more than one capability:

```ts
// GRIDCAP-SEL-PAGE | GRIDCAP-PAGINATION
```

or:

```py
# GRIDCAP-SEL-TARGET | GRIDCAP-ACTION-SELECTED | GRIDCAP-EXPORT-SELECTED
```

That is intentional. Shared infrastructure is often the hidden dependency a developer could otherwise miss while extracting one feature.

## Marker rules

1. Every marker begins with the exact common prefix `GRIDCAP-`.
2. **Do not invent an ad-hoc tag in code.** Add/define it in this registry first.
3. Tags describe a stable logical capability or a deliberate row-model foundation, not a filename or temporary implementation detail.
4. Use the same logical tag across Client-Side, Infinite, SSRM, frontend, backend, and tests when they implement the same user/business capability differently.
5. Multiple tags are allowed when one boundary supports multiple capabilities.
6. Mark **extraction-relevant boundaries**: row-model roots, controllers, shared algorithms, event/lifecycle boundaries, request/response mapping, backend authority, and focused tests. Do not tag every helper line or obvious UI statement.
7. A tag does **not** mean every marked implementation can be copied unchanged to every row model. Read the registry applicability notes and the row-model-specific docs.
8. Preserve markers during refactors when the capability still exists. If a capability is removed or materially redefined, update this registry and all affected markers in the same PR.
9. Avoid casual tag renames. Searchability across Git history and developer notes is more valuable than naming churn.
10. Tests may carry the same tag as production code so a developer can find the executable contract along with the implementation.
11. Documentation may mention tags, but the registry is the source of truth for tag meaning. Do not scatter competing tag definitions across docs.
12. When a meaningful grid capability is added, removed, or materially changed, review this registry as part of Definition of Done.

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

Row-model foundation tags intentionally use:

```text
GRIDCAP-ROWMODEL-CLIENT
GRIDCAP-ROWMODEL-INFINITE
GRIDCAP-ROWMODEL-SSRM
```

These let a developer search for the important pieces required by one complete row-model implementation in addition to searching for one logical feature.

---

# Registered tags

## A. Row-model foundation and AG Grid setup

### `GRIDCAP-ROWMODEL-CLIENT`

**Meaning:** Client-Side Row Model foundation where the complete bounded working set is local and AG Grid owns local shaping.

**Applies to:** Client-Side only.

**Important touchpoints:**
- `frontend/src/features/transactions/grid/TransactionsClientGrid.tsx`
- `frontend/src/features/transactions/transactionsGrid.config.ts`
- `frontend/src/features/transactions/api/transactions.queries.ts`
- `frontend/src/shared/grid/config/clientSideGridDefaults.ts`
- `frontend/src/shared/grid/selection/client-side/useClientSideSelectionController.ts`
- `backend/apps/transactions/api/client_views.py`
- `backend/apps/transactions/api/urls.py`
- focused Client tests and `docs/client-side-grid.md`

**Extraction note:** do not copy server datasource/include-exclude machinery into Client-Side merely for symmetry.

### `GRIDCAP-ROWMODEL-INFINITE`

**Meaning:** Infinite Row Model foundation including datasource/block-loading lifecycle and Infinite-specific selection gaps.

**Applies to:** Infinite only.

**Important touchpoints:**
- `frontend/src/features/transactions/grid/TransactionsInfiniteGrid.tsx`
- `frontend/src/features/transactions/transactionsGrid.config.ts`
- `frontend/src/shared/grid/data/infinite/createInfiniteDatasource.ts`
- `frontend/src/shared/grid/data/infinite/useInfiniteRowLoading.ts`
- `frontend/src/shared/grid/selection/infinite/`
- Infinite production tests and `frontend/src/infinite-selection-contract.md`

### `GRIDCAP-ROWMODEL-SSRM`

**Meaning:** flat Enterprise Server-Side Row Model foundation, including SSRM datasource/store lifecycle and native server-side selection state where appropriate.

**Applies to:** SSRM only.

**Important touchpoints:**
- `frontend/src/features/transactions/grid/TransactionsSsrmGrid.tsx`
- `frontend/src/features/transactions/transactionsGrid.config.ts`
- `frontend/src/shared/grid/data/server-side/createServerSideDatasource.ts`
- `frontend/src/shared/grid/data/server-side/useServerSideRowLoading.ts`
- `frontend/src/shared/grid/selection/server-side/useSsrmSelectionController.ts`
- `frontend/src/shared/grid/gridModules.ts`
- SSRM production tests and `frontend/src/ssrm-selection-contract.md`

### `GRIDCAP-SETUP-MODULES`

**Meaning:** application-level AG Grid module registration required before row-model/runtime APIs are usable.

**Applies to:** all row models; SSRM additionally requires Enterprise modules.

**Important touchpoints:**
- `frontend/src/shared/grid/gridModules.ts`
- application AG Grid provider/bootstrap
- `docs/ag-grid-native-usage.md`

### `GRIDCAP-SETUP-ENTERPRISE`

**Meaning:** Enterprise-only setup such as SSRM modules/API modules and license initialization.

**Applies to:** SSRM / other future Enterprise features.

**Important touchpoints:**
- `frontend/src/shared/grid/gridModules.ts`
- `frontend/src/shared/grid/enterpriseLicense.ts`
- application bootstrap/environment configuration

---

## B. Data loading, query shaping, identity, and request lifecycle

### `GRIDCAP-DATA-LOAD`

**Meaning:** getting authoritative row data into a grid, while preserving the correct owner for each row model.

**Applies to:** all row models, with different mechanics.

**Client:** full bounded collection via TanStack Query -> `rowData`.

**Infinite/SSRM:** AG Grid datasource lifecycle -> feature request mapper -> backend query -> rows/counts.

**Important touchpoints:**
- `frontend/src/features/transactions/api/transactions.api.ts`
- `frontend/src/features/transactions/api/transactions.queries.ts`
- `frontend/src/shared/grid/data/`
- `frontend/src/features/transactions/grid/transactionRequest.mapper.ts`
- `backend/apps/transactions/api/client_views.py`
- `backend/apps/transactions/api/views.py`
- `backend/apps/transactions/services.py`

### `GRIDCAP-QUERY-SORT`

**Meaning:** translating/native-owning sort behavior without keeping duplicate sort state.

**Client:** AG Grid sorts local `rowData`.

**Infinite/SSRM:** AG Grid sort model is translated to the allow-listed backend contract.

**Important touchpoints:**
- Transaction column definitions
- `frontend/src/features/transactions/grid/transactionRequest.mapper.ts`
- `frontend/src/shared/grid/query/gridQuery.contracts.ts`
- backend query/serializer logic

### `GRIDCAP-QUERY-FILTER`

**Meaning:** local Client filtering or server filter-model translation, including filter-dependent semantics.

**Important touchpoints:**
- Transaction column definitions
- `frontend/src/shared/grid/config/serverFilterParams.ts`
- `frontend/src/features/transactions/grid/transactionRequest.mapper.ts`
- backend query/serializer logic
- selection controllers where `GRIDCAP-SEL-FILTERED` reacts to filter changes

### `GRIDCAP-PAGINATION`

**Meaning:** native user-facing pagination and the exact current-page boundary; server cache block size is not page size.

**Applies to:** all current row models.

**Important touchpoints:**
- `frontend/src/shared/grid/config/clientSideGridDefaults.ts`
- `frontend/src/shared/grid/config/serverBackedGridDefaults.ts`
- `frontend/src/shared/grid/pagination/getCurrentPageNodes.ts`
- `frontend/src/shared/grid/pagination/useCurrentPageRowTarget.ts`
- Current Page selection/edit/export callers

### `GRIDCAP-ROW-ID`

**Meaning:** stable backend row identity used instead of displayed row position/index.

**Applies to:** all row models and tracked editing/selection.

**Important touchpoints:**
- concrete Transactions grid roots (`getRowId`)
- selection targets
- tracked editing state
- backend IDs

### `GRIDCAP-REQUEST-FRESHNESS`

**Meaning:** latest-**started** server row request owns renderable count metadata; older responses may finish AG Grid lifecycle but cannot overwrite newer metadata.

**Applies to:** Infinite and SSRM.

**Important touchpoints:**
- `frontend/src/shared/grid/data/infinite/createInfiniteDatasource.ts`
- `frontend/src/shared/grid/data/server-side/createServerSideDatasource.ts`
- row-loading hooks
- `frontend/src/shared/grid/data/datasources.test.ts`

**Critical rule:** request order, not higher/lower page number, decides freshness.

### `GRIDCAP-REQUEST-CANCEL`

**Meaning:** cancel/abort obsolete datasource work when a datasource/grid lifecycle ends.

**Applies to:** Infinite and SSRM server requests.

**Important touchpoints:**
- Infinite/SSRM datasource adapters and their `destroy()` behavior
- root teardown/refresh ownership where relevant

### `GRIDCAP-ERROR-RETRY`

**Meaning:** row-load error presentation and retry using the correct row-model-native lifecycle.

**Applies to:** all current row models, with different retry/refetch owners.

**Important touchpoints:**
- `frontend/src/shared/grid/overlays/`
- Client TanStack Query `refetch`
- Infinite datasource refresh/retry path
- SSRM `retryServerSideLoads()` path
- concrete grid roots

### `GRIDCAP-LIFECYCLE-REFRESH`

**Meaning:** obtaining authoritative data again after a successful mutation or explicit refresh without inventing one fake universal refresh API.

**Client:** update/refetch TanStack Query collection.

**Infinite:** `refreshInfiniteCache()`.

**SSRM:** `refreshServerSide()`.

**Important touchpoints:**
- concrete grid roots
- `useTransactionEditPersistence.ts`
- selected business-action callbacks
- Client collection query ownership

---

## C. Selection and selected business operations

### `GRIDCAP-SEL-MANUAL`

**Meaning:** explicit/manual multi-row selection based on stable row IDs.

**Applies to:** Client, Infinite, SSRM through their native selection mechanisms.

### `GRIDCAP-SEL-PAGE`

**Meaning:** Select Current Page over the exact native pagination page, not a server cache block.

**Applies to:** all current row models.

**Important touchpoints:**
- Client native `selectAll: 'currentPage'`
- Infinite Current Page header/controller
- SSRM current-page command
- `frontend/src/shared/grid/pagination/getCurrentPageNodes.ts`
- `frontend/src/shared/grid/pagination/useCurrentPageRowTarget.ts`

### `GRIDCAP-SEL-FILTERED`

**Meaning:** Select All Filtered and its filter-universe lifecycle.

**Client:** native `selectAll: 'filtered'` plus project filter-change reset semantic.

**Infinite:** application-owned dataset-wide logical selection because unloaded rows have no RowNodes.

**SSRM:** custom filtered-wide semantic layered beside native SSRM selection.

**Critical rule:** if the defining filter changes while filtered-wide selection is active, clear that old filtered-wide selection so it is not silently reinterpreted against a new universe.

### `GRIDCAP-SEL-ALL`

**Meaning:** Select All Records across the row model's complete selection universe.

**Client:** native local `selectAll: 'all'` and exact eligibility-aware selected rows.

**Infinite:** logical dataset-wide include/exclude state for unloaded rows.

**SSRM:** native Enterprise server-side All Records selection state.

### `GRIDCAP-COUNT-SELECTED`

**Meaning:** user-visible selected-row total and its source of truth.

**Client:** exact `api.getSelectedRows().length` because all selectable rows are local.

**Infinite/SSRM dataset-wide:** API `totalCount` / `filteredCount` minus user exceptions under the documented eligibility-count limitation.

**Important touchpoints:**
- selection controllers
- `frontend/src/shared/grid/selection/selectionCount.ts`
- row-loading count metadata
- `docs/selection-counts.md`

### `GRIDCAP-SEL-TARGET`

**Meaning:** operation-neutral logical selection target that answers **which rows** a selected backend operation should resolve.

**Important touchpoints:**
- `frontend/src/shared/grid/selection/serverSelection.ts`
- `frontend/src/shared/grid/selection/gridSelectionActionTarget.ts`
- `frontend/src/features/transactions/grid/transactionSelectionAction.ts`
- Transaction API contracts/serializers
- `backend/apps/transactions/services.py::resolve_transactions_by_selection`

**Cross-capability dependency:** selected business actions and selected server export must share this meaning.

### `GRIDCAP-ACTION-SELECTED`

**Meaning:** apply a feature business mutation to the current logical selection while backend eligibility remains authoritative.

**Important touchpoints:**
- `TransactionSelectionActions.tsx`
- `useTransactionSelectionAction.ts`
- `transactionSelectionAction.ts`
- Transaction API client/contracts
- backend serializer/view/resolver/update service
- row-model-specific refresh after success

### `GRIDCAP-ROW-ELIGIBILITY`

**Meaning:** generic `enabled` / `selectionDisabled` / `readOnly` interaction semantics and authoritative backend enforcement.

**Important touchpoints:**
- `frontend/src/shared/grid/rows/`
- `frontend/src/features/transactions/grid/transactionRowInteraction.ts`
- Transaction columns/cell presentation
- `backend/apps/transactions/services.py`
- backend mutation/selection resolution
- `docs/row-interaction.md`

**Critical distinction:** business-ineligible rows are not manufactured as user deselection exception IDs.

---

## D. Editing, save/discard, and conflicts

### `GRIDCAP-EDIT-TRACKED`

**Meaning:** stable-ID unsaved draft state outside transient RowNodes, including safe programmatic overlay bookkeeping.

**Important touchpoints:**
- `frontend/src/shared/grid/editing/trackedGridEditing.ts`
- `frontend/src/shared/grid/editing/useTrackedGridEditing.ts`
- concrete grid roots' `onCellValueChanged` and restore/reconcile events

### `GRIDCAP-EDIT-PAGE-APPLY`

**Meaning:** programmatically apply the last edit or explicit edit changes to eligible rows on the exact current page.

**Important touchpoints:**
- `frontend/src/shared/grid/editing/useCurrentPageEditActions.ts`
- current-page resolver
- editing controls
- row eligibility

### `GRIDCAP-EDIT-SAVE-ROW`

**Meaning:** persist one explicit dirty row independently of checkbox selection.

**Important touchpoints:**
- row edit action renderer/context
- `useTransactionEditPersistence.ts`
- single-row API/backend endpoint
- tracked-edit acknowledgement

### `GRIDCAP-EDIT-SAVE-SELECTED`

**Meaning:** persist `dirty rows ∩ current selection` as explicit dirty row patches; do not transform Select All into edits for untouched rows.

**Important touchpoints:**
- concrete grid roots
- editing controls
- tracked editing selection intersection
- `useTransactionEditPersistence.ts`
- bulk update backend endpoint

### `GRIDCAP-EDIT-DISCARD`

**Meaning:** restore the latest authoritative value and remove the relevant tracked draft for one row or selected dirty rows.

**Important touchpoints:**
- tracked editing state/hook
- row action renderer
- editing controls
- concrete roots

### `GRIDCAP-EDIT-CONFLICT`

**Meaning:** BASE / LOCAL / REMOTE reconciliation, field-level conflicts, Use server / Keep my edit, and conflict-aware mutation guards.

**Important touchpoints:**
- `trackedGridEditing.ts`
- `useTrackedGridEditing.ts`
- Transaction conflict cell/popover presentation
- save/selected-action conflict guards in concrete roots
- refresh/reconciliation lifecycle
- `docs/edit-conflict-reconciliation.md`

### `GRIDCAP-COUNT-EDITED`

**Meaning:** exact count of dirty **rows**, not dirty fields/cells.

**Important touchpoints:**
- tracked editing payload derivation
- `useTrackedGridEditing.ts`
- `TransactionEditingControls.tsx`
- `docs/edited-row-count.md`

---

## E. Export

### `GRIDCAP-EXPORT-PAGE`

**Meaning:** native AG Grid CSV export over exactly the fully resolved current pagination page.

**Applies to:** Client, Infinite, SSRM.

**Important touchpoints:**
- `frontend/src/shared/grid/export/exportCurrentPageCsv.ts`
- `frontend/src/shared/grid/pagination/getCurrentPageNodes.ts`
- concrete grid export handlers
- export UI

**Eligibility semantic:** page snapshot includes `selectionDisabled` / `readOnly` rows if displayed.

### `GRIDCAP-EXPORT-SELECTED`

**Meaning:** export the complete selected universe using the data owner that can enumerate it authoritatively.

**Client:** native/local AG Grid selected CSV across pagination pages.

**Infinite/SSRM:** backend selected export using the shared logical selection target/resolver because selected rows may be unloaded.

**Important touchpoints:**
- `frontend/src/shared/grid/export/exportSelectedRowsCsv.ts` (local exact/native mechanic)
- `frontend/src/features/transactions/grid/useTransactionExport.ts` (server-backed selected export)
- concrete grid roots
- Transaction API client/contracts
- backend selected export view
- `backend/apps/transactions/services.py` shared selection resolver
- `backend/apps/transactions/tests/test_selection_export_api.py`
- `docs/grid-export.md`

---

## F. State, presentation, and lifecycle safety

### `GRIDCAP-STATE-PERSISTENCE`

**Meaning:** persist intentional native AG Grid user preference state while keeping transient business state such as row selection/pagination out of the current durable contract.

**Important touchpoints:**
- `frontend/src/shared/grid/state/gridStatePersistence.ts`
- `frontend/src/shared/grid/state/useGridStatePersistence.ts`
- concrete grid roots and their distinct storage keys
- state persistence tests

### `GRIDCAP-LIFECYCLE-DESTROY`

**Meaning:** safe AG Grid teardown: clear root-owned `GridApi` refs, stop obsolete async/listener work, and avoid calling destroyed APIs.

**Important touchpoints:**
- concrete Client/Infinite/SSRM grid roots (`onGridPreDestroyed`)
- listener cleanup with `api.isDestroyed()` guards
- datasource `destroy()` / cancellation
- warning #26 regression coverage

### `GRIDCAP-COLUMNS`

**Meaning:** feature-owned native `ColDef` composition, including row-model-specific filter parameters, editors, renderers, editability, utility columns, formatting, and conflict/interaction presentation.

**Important touchpoints:**
- `frontend/src/features/transactions/grid/transactionColumns.tsx`
- status editor/renderer
- row interaction cell/action renderer
- shared default column definition

**Rule:** this tag identifies column composition; it does not justify building a custom column abstraction over native `ColDef`.

### `GRIDCAP-THEME`

**Meaning:** shared AG Grid visual theme/global default setup without hiding concrete grid behavior.

**Important touchpoints:**
- shared AG Grid theme/default-column setup
- application grid provider/global options
- `docs/theming.md`

---

# Cross-capability examples

These examples show why more than one marker may appear at one boundary.

## Current Page resolver

Expected relationship:

```text
GRIDCAP-PAGINATION
GRIDCAP-SEL-PAGE
GRIDCAP-EDIT-PAGE-APPLY
GRIDCAP-EXPORT-PAGE
```

The exact page boundary is shared; the operations performed on that page are different.

## Backend logical selection resolver

Expected relationship:

```text
GRIDCAP-SEL-TARGET
GRIDCAP-ACTION-SELECTED
GRIDCAP-EXPORT-SELECTED
GRIDCAP-ROW-ELIGIBILITY
```

The resolver answers which eligible rows the user targeted; mutation/export decide what to do with them.

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
2. reuse the existing tag if the meaning is the same even when implementation differs by row model;
3. if a genuinely new capability exists, define a stable tag here first;
4. mark important production integration points;
5. mark focused executable tests where useful;
6. allow multiple tags on shared boundaries;
7. update relevant feature/native/API/manual docs;
8. verify a repository search for the tag gives a useful extraction map rather than dozens of meaningless comments;
9. preserve existing useful markers during refactors;
10. update `AGENTS.md` if the tagging/maintenance contract itself changes.

> **The goal is not to decorate the code. The goal is to make capability extraction and dependency discovery reliable.**
