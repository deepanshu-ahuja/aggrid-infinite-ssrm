# AG Grid Native Usage Reference

This document answers a different question from the capability catalog:

> Which parts of our implementation are using AG Grid itself, and what do those native AG Grid pieces mean?

The goal is to make our dependency on AG Grid visible and understandable. A developer should be able to read this document and recognise which behavior belongs to AG Grid, which behavior is our application logic, and where we have intentionally added custom state because AG Grid cannot represent a required server-backed meaning.

This is **not** a copy of AG Grid's complete documentation. It records the native surface our repository currently depends on.

For the product/logical capabilities built on top of these primitives, see `docs/grid-capabilities.md`.

## Maintenance rule

When code starts depending on a meaningful new AG Grid prop, GridApi method, RowNode API, event, datasource callback, Grid State slice, column feature or Enterprise module, update this document in the same change.

Do not list AG Grid types that are merely imported for TypeScript typing unless the type corresponds to an actual runtime contract we depend on.

---

## 1. How much do we depend on AG Grid natively?

Quite a lot — deliberately.

Our architecture rule is:

> Use AG Grid's native behavior/state/API first, then add application code only for the semantic gap AG Grid cannot represent.

Examples:

```text
sorting
-> native AG Grid column/sort model

filters
-> native AG Grid FilterModel

pagination
-> native AG Grid pagination model

loaded-row selection
-> native AG Grid RowNode selection

SSRM All Records selection
-> native SSRM server-side selection state

column/layout preference state
-> native AG Grid GridState

Infinite unloaded Select All
-> application state, because Infinite has no RowNodes for all unloaded rows

unsaved edit draft/conflict state
-> application state, because RowNodes/cache can be destroyed while drafts must survive
```

So the project is not trying to replace AG Grid with a home-grown grid abstraction. It uses AG Grid as the table engine and adds only server/application semantics around it.

---

## 2. `AgGridReact`

Both concrete row-model roots render AG Grid directly with:

```tsx
<AgGridReact ... />
```

We do **not** have a generic wrapper that hides AG Grid props/events behind another invented API.

Why this matters:

- native AG Grid behavior stays visible;
- Infinite and SSRM can use different native props/events where required;
- developers can read AG Grid documentation and map it directly to our code;
- shared utilities support the grid rather than pretending to be the grid.

Current concrete roots:

- `TransactionsInfiniteGrid`
- `TransactionsSsrmGrid`

---

## 3. Application-wide native setup

### `AgGridProvider`

Used once around the application to register the AG Grid modules available to grids.

Easy meaning:

> Tell AG Grid which feature modules this application is allowed to use.

We centralize this rather than registering modules inside each feature grid.

### `provideGlobalGridOptions(...)`

Used for a deliberately small application-wide native configuration:

- shared AG Grid theme;
- shared `defaultColDef`.

Easy meaning:

> These defaults belong to every AG Grid unless a concrete grid/column overrides them.

We do **not** put row-model choice, datasource, selection, lifecycle handlers or business behavior into global options.

### Enterprise `LicenseManager.setLicenseKey(...)`

Used centrally when `VITE_AG_GRID_LICENSE_KEY` is configured.

Easy meaning:

> Enable licensed AG Grid Enterprise behavior without making feature code responsible for license setup.

---

## 4. Registered AG Grid modules

Current module registration includes:

### `AllCommunityModule`

Makes the Community feature set used by the application available.

### `ServerSideRowModelModule`

Enterprise module that enables SSRM itself.

### `ServerSideRowModelApiModule`

Enables SSRM-specific GridApi methods used by this project, especially native server-side selection-state APIs.

Important distinction:

```text
ServerSideRowModelModule
-> allows SSRM rows/model to exist

ServerSideRowModelApiModule
-> enables SSRM-specific API calls we make from code
```

The repository intentionally registers both together.

### `enableDevValidations()`

Enabled in development builds.

Easy meaning:

> Ask AG Grid to perform additional development-time validation and warn us when we misuse its APIs/configuration.

This is useful because lifecycle/module/config mistakes should surface during development rather than be silently ignored.

---

## 5. Global native column defaults

Our global `defaultColDef` currently uses these AG Grid-native column options:

### `sortable: true`

Columns are sortable unless a specific column opts out.

### `resizable: true`

Users can resize columns unless a column overrides the behavior.

### `filter: true`

Columns are filterable by default. Feature columns can select a concrete filter type or disable filtering.

### `minWidth`

Provides a reasonable default minimum column width.

These are native `ColDef` options. We do not wrap them in a separate application column API.

---

## 6. Row-model props

### `rowModelType="infinite"`

Used by the Infinite root.

Easy meaning:

> AG Grid asks our Infinite datasource for blocks as rows are needed instead of receiving the full dataset at once.

### `rowModelType="serverSide"`

Used by the SSRM root.

Easy meaning:

> AG Grid uses the Enterprise Server-Side Row Model and asks the server-side datasource for blocks/stores.

These remain explicit because Infinite and SSRM have different native behavior.

---

## 7. Datasource props

### `datasource`

Native Infinite Row Model prop.

Our `createInfiniteDatasource()` returns AG Grid's `IDatasource` implementation.

### `serverSideDatasource`

Native SSRM prop.

Our `createServerSideDatasource()` returns AG Grid's `IServerSideDatasource` implementation.

The application owns how AG Grid requests are translated to the backend, but AG Grid owns when another block is required.

---

## 8. Infinite datasource callbacks

AG Grid calls native `IDatasource.getRows(params)`.

Important request values we consume:

### `params.startRow` / `params.endRow`

The block range AG Grid needs.

Easy meaning:

> "Give me rows starting here and stopping before this end index."

### `params.sortModel`

AG Grid's current native server sort model.

We pass it to the feature mapper rather than creating a second sort state.

### `params.filterModel`

AG Grid's current native FilterModel.

Again, the feature translates it to the backend contract.

### `params.successCallback(rows, rowCount)`

Called after successful Infinite data loading.

Important project rule:

> We pass the current **filtered count** as AG Grid's row count, because AG Grid pagination represents the currently visible query, not the complete unfiltered dataset.

### `params.failCallback()`

Tells AG Grid that the Infinite block failed to load.

### datasource `destroy()`

AG Grid calls this when the datasource is replaced/destroyed.

Our adapter aborts outstanding requests so stale async work cannot report into an obsolete datasource/grid instance.

---

## 9. SSRM datasource callbacks

AG Grid calls native `IServerSideDatasource.getRows(params)`.

Important values we currently use:

### `params.request.startRow` / `endRow`

Requested flat block range.

### `params.request.sortModel`

Native SSRM sort model sent to the feature mapper.

### `params.request.filterModel`

Native SSRM filter model sent to the feature mapper.

### `params.success({ rowData, rowCount })`

Reports a successful SSRM load.

We use the filtered query size for `rowCount`.

### `params.fail()`

Reports a failed SSRM load.

### datasource `destroy()`

Used for cancellation/cleanup of outstanding SSRM requests.

Current SSRM adapter intentionally handles flat paging/sort/filter only. Grouping/aggregation/pivot request fields are not yet mapped into the backend contract.

---

## 10. Native server-backed GridOptions

Shared defaults use AG Grid-native options:

### `pagination`

Turns native pagination on.

### `paginationPageSize`

Controls how many rows are visible on one user-facing page.

### `paginationPageSizeSelector`

Controls native page-size choices.

### `cacheBlockSize`

Controls how many rows the row model asks for in a server block.

Important:

```text
paginationPageSize
!=
cacheBlockSize
```

One is a UI page boundary; the other is a server/cache loading boundary.

### `maxBlocksInCache`

Bounds how many Infinite/server blocks remain resident in browser memory.

### `blockLoadDebounceMillis`

Lets AG Grid debounce rapid block-loading demand.

### `maxConcurrentDatasourceRequests`

Limits simultaneous datasource requests.

These options are performance/loading behavior. They never define the business scope of an action.

---

## 11. Stable identity: `getRowId`

Both row-model roots provide native `getRowId` using the backend row ID.

Easy meaning:

> Tell AG Grid that this backend ID is the durable identity of the row, regardless of where the row appears.

Why we depend on it:

- sorting changes position, not identity;
- pagination changes visibility, not identity;
- cache/store refresh can recreate RowNodes;
- selection must still refer to the same business row;
- tracked edits are keyed to the same backend identity.

We do not use row index as durable identity.

---

## 12. Native row selection configuration

Both roots use native `rowSelection` configuration.

Important pieces include:

### `mode: 'multiRow'`

Allows multiple row selection.

### `headerCheckbox`

Controls whether AG Grid's native header checkbox is used.

Infinite page/filtered/all meanings need different header handling, so Infinite disables/replaces native behavior where required.

SSRM uses the native header checkbox for All Records.

### `selectAll: 'all'` (SSRM)

Defines the native SSRM header Select All meaning as All Records.

### `groupSelects: 'self'` (SSRM)

The current controller assumes flat server-side selection rather than hierarchical/group cascade semantics.

### `enableClickSelection: false` (Infinite)

Prevents ordinary row clicks from changing selection; checkbox/explicit selection paths remain intentional.

### `isRowSelectable(node)`

Very important native callback.

Easy meaning:

> Ask the feature whether this loaded RowNode is eligible for AG Grid selection.

AG Grid evaluates this and exposes the result as `node.selectable`.

Our custom Current Page / dataset sync code reuses `node.selectable`; it does not duplicate the business condition.

---

## 13. `selectionColumnDef`

Used to configure AG Grid's native selection column.

Current uses include:

- width/min/max width;
- no resizing/sorting for this utility column;
- custom header component for Infinite Current Page;
- custom logical header component for Infinite All Filtered / All Records semantics.

The row checkboxes are still AG Grid selection controls; only the header meaning changes where Infinite lacks a native equivalent.

---

## 14. Native SSRM server-side selection state

This is one of the most important Enterprise-native features we use.

### `api.getServerSideSelectionState()`

Reads SSRM's native compact selection model.

For flat selection it can represent both explicit IDs and Select All without loading every selected row.

Conceptually:

```text
selectAll = false + toggled IDs
-> explicit selected rows

selectAll = true + toggled IDs
-> All Records except those user exceptions
```

Why we do **not** use `getSelectedRows()` for this:

> `getSelectedRows()` can only return row objects AG Grid currently has loaded. Native SSRM selection can represent unloaded rows too.

### `api.setServerSideSelectionState(...)`

Writes/clears native SSRM selection state.

Used when switching between meanings such as native All Records, Current Page and custom All Filtered.

---

## 15. General selection GridApi / RowNode APIs

### `api.setNodesSelected({ nodes, newValue })`

Native bulk operation over concrete RowNodes.

Used for Current Page behavior after first filtering to selectable RowNodes.

We never intentionally pass disabled RowNodes and then try to repair them afterward.

### `node.isSelected()`

Reads one loaded RowNode's native selection state.

Used for header state and reconciliation.

### `node.setSelected(selected, clearSelection, source)`

Writes one loaded RowNode's native selection state.

We use `source: 'api'` for programmatic reconciliation.

Easy meaning of the source distinction:

> "This checkbox change came from our sync code, not from the user."

Our row-selected handlers ignore those programmatic events so they do not feed back into logical exception state.

### `node.selectable`

AG Grid's evaluated result of `rowSelection.isRowSelectable` for that loaded node.

This is the native source used by shared selection mechanics to stay domain-neutral.

### `api.forEachNode(...)`

Iterates RowNodes currently known/loaded by the row model.

Used for:

- syncing logical dataset selection onto loaded rows;
- restoring/reconciling tracked edits;
- restoring authoritative values on Discard/Use server.

Important limitation:

> Iterating loaded RowNodes is not used to define a dataset-wide backend action target.

Unloaded rows are represented logically and resolved by the backend.

---

## 16. Infinite native selection from Grid State

### `api.getState().rowSelection`

For Infinite page/manual selection, native AG Grid Grid State is the source of selected IDs.

Easy meaning:

> AG Grid already knows the explicit selected row IDs, so we read them instead of maintaining a duplicate React array.

This is used only where native explicit Infinite selection is authoritative. Dataset-wide Infinite selection still needs compact application state for unloaded rows.

---

## 17. Pagination GridApi methods

The shared Current Page resolver uses only AG Grid's native pagination model:

### `api.paginationGetPageSize()`

Returns the current visible page size.

### `api.paginationGetCurrentPage()`

Returns the zero-based current page index.

Example:

```text
UI page 1 -> AG Grid value 0
UI page 2 -> AG Grid value 1
```

### `api.paginationGetRowCount()`

Returns AG Grid's current pagination row count.

### `api.getDisplayedRowAtIndex(index)`

Returns the RowNode at a displayed row position.

We use these APIs together to obtain the exact concrete RowNodes belonging to the current page.

Safety rule:

> If the expected page is not fully materialised, Current Page operations return/abort rather than silently acting on only the subset that happened to load.

---

## 18. Infinite completion/count APIs

### `api.isLastRowIndexKnown()`

Used to know whether Infinite has learned the final row count for the current filtered query.

### `api.getDisplayedRowCount()`

Once the last row is known, used to obtain the final displayed/filtered result size for filtered-wide header state.

We do not treat an unfinished Infinite row count as a final filtered total.

---

## 19. Native filter API

### `api.getFilterModel()`

Reads the currently applied AG Grid FilterModel.

Used when constructing filtered server-side business actions.

Important architecture rule:

> We do not keep a second React ref/state copy of the active filter model.

The feature mapper translates this native model into the backend filter contract.

This same translation is reused for normal row queries and filtered selection actions.

---

## 20. Native refresh APIs

### `api.refreshInfiniteCache()`

Infinite-native refresh after successful writes.

Easy meaning:

> Ask AG Grid to re-request currently resident Infinite cache blocks from the datasource.

It does not load the entire backend dataset.

### `api.refreshServerSide()`

SSRM-native refresh after successful writes.

Easy meaning:

> Ask the SSRM store to reload authoritative server data.

We deliberately do not create one fake shared refresh method that hides the row-model difference.

### `api.retryServerSideLoads()`

SSRM-native retry for failed server-side loads.

---

## 21. Native rendering refresh APIs

### `api.refreshHeader()`

Used when application-owned Infinite dataset selection changes and the custom selection header needs to re-read checked/indeterminate state.

### `api.refreshCells(...)`

Used when external React state (such as editing/conflict/action context) changes and loaded AG Grid cells need to redraw against the new context.

### `api.setGridOption('context', value)`

Used to update AG Grid's runtime `context` object consumed by feature cell callbacks/renderers.

This lets cell presentation query shared editing/conflict behavior without making the generic edit state import Transactions UI components.

---

## 22. Native `context`

`context` is an AG Grid-provided object passed to grid callbacks/renderers.

Current use:

- ask whether a row is dirty/conflicted;
- ask whether a particular editable field is conflicted;
- obtain local/remote conflict values for cell presentation;
- invoke row Save/Discard behavior from a cell renderer.

Important boundary:

> Context is used for AG Grid cell/event integration. React presentation outside the grid should derive render values directly from React state rather than calling ref-backed context during render.

That distinction is part of the recent lifecycle/lint hardening.

---

## 23. Editing native APIs/events

### `onCellValueChanged`

Native AG Grid event fired when an edit is committed.

Our shared tracked-edit hook uses this as the boundary for recording a user edit.

It reads:

- `event.data`;
- `event.node`;
- `event.colDef.field`;
- `event.oldValue`;
- `event.newValue`;
- `event.source`.

Programmatic writes made by our editing code use source `data` and/or a local programmatic-write guard so they do not become fake user drafts.

### `node.setDataValue(field, value, source)`

Native RowNode write API.

Used to:

- apply programmatic edits to loaded rows;
- restore LOCAL drafts after a server-backed row reload;
- restore BASE/REMOTE on Discard;
- apply REMOTE on `Use server`.

Important:

> RowNode value mutation is presentation/runtime state. Durable unsaved draft state remains in our stable-ID tracked editing state because RowNodes can disappear.

### `editable` column callback

Native `ColDef.editable` callback.

Used to combine:

- backend row editability (`readOnly` vs editable);
- unresolved conflict restriction for that specific field.

This lets AG Grid itself decide whether the editor may open.

### native/custom cell editors

Current examples:

- native `agNumberCellEditor` for amount;
- custom Transaction status editor.

The tracked-edit mechanism does not care which UI editor produced the committed value.

---

## 24. Column definition features we currently use

Our feature columns use native `ColDef` capabilities rather than a custom column abstraction.

### `field`

Binds a column to a row property.

### `colId`

Stable identifier for utility/action columns that are not direct data fields.

### `headerName`

Visible column label.

### `minWidth` / `maxWidth`

Column sizing constraints.

### `type: 'numericColumn'`

Native numeric-column behavior/style hint.

### `filter`

Selects a concrete AG Grid filter such as:

- `agTextColumnFilter`;
- `agNumberColumnFilter`;
- `agDateColumnFilter`.

### `filterParams`

Configures the native filter behavior to match the server-supported operators/UX.

### `editable`

Boolean/callback deciding whether AG Grid may edit the cell.

### `cellEditor`

Selects native or custom editor.

### `cellRenderer`

Provides feature presentation while still using native AG Grid rendering lifecycle.

Current examples include status, interaction/access, and row action cells.

### `valueFormatter`

Formats a raw value for display without changing the backend value.

Current examples include currency and date formatting.

### `cellClassRules`

Native conditional cell-class mechanism.

Used for conflict styling based on feature context.

### `tooltipValueGetter`

Native tooltip content callback.

Used to describe conflict values on a conflicted cell.

---

## 25. Native lifecycle events supplied as React props

The concrete roots use AG Grid lifecycle/event props.

### `onGridReady`

Runs when GridApi is ready.

Current responsibility:

- store the root-owned authoritative `GridApi` reference;
- perform initial selection synchronization where needed.

### `onGridPreDestroyed`

Runs immediately before AG Grid destroys the grid.

Current responsibility:

```text
clear gridApi.current
```

Why:

> Asynchronous callbacks/effects must not continue to hold/use an API after the grid instance is dead.

This is part of the fix for the lifecycle class of issues exposed by AG Grid warning #26.

### `onModelUpdated`

Runs when AG Grid's displayed/model rows have changed.

Current uses:

- restore/sync selection as rows materialise;
- reconcile/restore tracked edits against refreshed server rows.

### `onPaginationChanged`

Infinite uses this to resync page/model-dependent behavior, including edit restoration.

### `onRowSelected`

Runs for individual RowNode selection changes.

Used especially to update custom filtered/all logical exception state.

Programmatic source `api` events are ignored where they are only reconciliation.

### `onSelectionChanged`

Runs when overall selection changes.

Used to:

- publish native Infinite page/manual selection;
- inspect SSRM server-side state and hand ownership back to native All Records when appropriate.

### `onFilterChanged`

Used to clear only selection state whose meaning depended on the previous filter.

It also clears load-error state as a new query is attempted.

### `onCellClicked`

Used by Transactions to detect a click on a conflicted editable field and anchor the conflict resolver presentation.

### `onCellValueChanged`

Used by shared tracked editing, described above.

### `onStateUpdated`

Receives native AG Grid Grid State after state changes and sends it to our persistence boundary.

---

## 26. Custom native event listeners in the Infinite header

The custom Infinite Current Page header receives AG Grid's native `api` and registers listeners directly with:

```ts
api.addEventListener(...)
```

Current listeners:

- `selectionChanged`;
- `paginationChanged`;
- `modelUpdated`.

Why all three?

The meaning of "is the current page fully selected?" can change when:

```text
selection changes
-> checkbox state changes

pagination changes
-> a different page is now the target

model updates
-> server rows on that page were loaded/replaced
```

The component removes the listeners in React cleanup with `removeEventListener(...)` **only if the GridApi is still alive**.

---

## 27. `api.isDestroyed()` and warning #26

We explicitly use native:

```ts
api.isDestroyed()
```

in the custom Infinite selection header.

Easy meaning:

> "Has AG Grid already destroyed this GridApi instance?"

Why it exists in our code:

AG Grid can destroy its grid instance before React finishes unmounting a custom header. If React cleanup then calls:

```text
api.removeEventListener(...)
```

on the destroyed API, AG Grid warns with error/warning #26.

Our rule is now:

```text
if API already destroyed
-> do not call cleanup/click API methods on it
```

And the owning roots also clear their API refs in `gridPreDestroy`.

This is a good example of why the native lifecycle matters even when an issue appears only intermittently.

---

## 28. Native Grid State

We use AG Grid's native `GridState` as the preference representation.

### `initialState`

Passed to `AgGridReact` during creation to restore saved user grid preferences.

### `onStateUpdated`

Receives updated native `GridState`.

### Native state slices we persist

- `columnOrder`;
- `columnPinning`;
- `columnSizing`;
- `columnVisibility`;
- `filter`;
- `sort`.

### Native state we deliberately do not persist

- pagination;
- selection.

Why this is important:

> We do not translate AG Grid preferences into a second home-grown state schema. The stored shape remains AG Grid `GridState` behind a replaceable storage boundary.

---

## 29. Native active overlay props

The concrete roots use AG Grid's overlay integration:

### `activeOverlay`

Supplies the application error overlay component when row loading fails.

### `activeOverlayParams`

Supplies the error message/retry callback to that overlay.

This keeps the overlay hosted by AG Grid while the application owns wording/action behavior.

---

## 30. Native row class callback

### `getRowClass`

AG Grid-native callback used to apply row presentation based on feature interaction state.

This is presentation only. Selection/edit eligibility still uses the appropriate native callbacks/guards; CSS is not used as a security/business rule.

---

## 31. What AG Grid does **not** own in our project

This is equally important.

### Infinite dataset-wide logical selection

Application-owned because Infinite has no native representation for every unloaded selected row plus user exceptions.

### Custom SSRM All Filtered selection

Application-owned because the current product meaning is not represented by the configured native SSRM selection mode.

### Backend request contract

Application/feature-owned. Raw AG Grid models are translated before HTTP.

### Backend row eligibility

Feature/backend-owned. AG Grid receives the result for loaded rows via `isRowSelectable` / `editable`, but it does not decide business eligibility.

### Unsaved draft state

Application-owned because RowNodes can be evicted/recreated.

### BASE / LOCAL / REMOTE edit conflict state

Application-owned because this is a business/application reconciliation rule across server refresh and unsaved work.

### Mutation endpoints/business actions

Feature/backend-owned.

AG Grid provides the selection/editing events and runtime RowNodes; it does not know what `Mark Failed`, `/bulk/`, or our conflict policy means.

---

## 32. Dependency map by concern

| Concern | AG Grid native dependency | Application addition |
| --- | --- | --- |
| Render table | `AgGridReact` | Feature root composition |
| Infinite loading | `rowModelType`, `datasource`, `IDatasource` | Typed loader + API mapper |
| SSRM loading | `rowModelType`, `serverSideDatasource`, SSRM modules | Flat typed loader + API mapper |
| Sort | `ColDef.sortable`, native sort model | Backend translation |
| Filter | native column filters / FilterModel | Backend translation/operator allow-list |
| Pagination | native pagination options/API | Safe Current Page helper |
| Loaded row identity | `getRowId` | Backend ID choice |
| Loaded row selection | native selection / RowNode APIs | Eligibility adapter |
| Infinite All Filtered/All | loaded RowNode sync | Compact include/exclude state |
| SSRM All Records | native server-side selection state | Mapping to backend logical selection |
| SSRM All Filtered | loaded RowNode sync | Compact custom filtered selection |
| Row eligibility | `isRowSelectable`, `node.selectable`, `editable` | Feature/backend policy |
| Edit commit | `cellValueChanged` | Stable-ID draft tracking |
| Programmatic value write | `RowNode.setDataValue` | Programmatic-write guard + draft/conflict state |
| Refresh | Infinite/SSRM native refresh APIs | Reconcile drafts after fresh data |
| Preferences | native `GridState`, `initialState`, `stateUpdated` | Storage boundary |
| Teardown | `gridPreDestroy`, `isDestroyed` | Root-ref cleanup / safe React cleanup |
| Error display | AG Grid overlay host | App overlay component + retry wording |

---

## 33. Practical rule for future development

Before writing new grid state or a new hook, ask:

```text
Does AG Grid already expose this as a prop, API, RowNode property, event or Grid State?
        |
        | yes
        v
Use the native source first.

        | no
        v
Does this specific row model already support it natively?
        |
        | yes
        v
Use that row-model-native capability.

        | no
        v
Add the smallest application state/mechanic needed for the actual product semantic.
```

And when adding that new native dependency, add it to this document so future developers know exactly how much behavior comes from AG Grid itself.

---

## 34. Related documentation

- `docs/grid-capabilities.md` — what the grid foundation can do logically;
- `docs/ag-grid.md` — architecture and ownership;
- `docs/ag-grid-foundation-status.md` — current foundation status;
- `docs/server-backed-grid-reuse.md` — adding another table;
- `frontend/src/infinite-selection-contract.md` — Infinite selection source of truth;
- `frontend/src/ssrm-selection-contract.md` — SSRM selection source of truth;
- `docs/row-interaction.md` — interaction eligibility;
- `docs/transaction-editing.md` — editing;
- `docs/edit-conflict-reconciliation.md` — edit/refresh conflicts;
- `docs/api-data-flow.md` — backend request/action flow.
