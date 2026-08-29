# Grid Capability Tag Registry

`GRIDCAP-*` markers make frontend capability footprints searchable across production source and focused frontend tests.

A marker means:

> This frontend location participates in this capability.

It does not mean the marked implementation can be copied unchanged into another row model.

## Usage

1. Find the capability marker below.
2. Read its meaning and row-model ownership.
3. Search frontend source/tests for the exact marker.
4. Inspect every meaningful occurrence before changing or extracting the capability.
5. Inspect required backend/API behavior separately; backend code intentionally does not carry `GRIDCAP-*` comments.

## Marker rules

- every marker begins with `GRIDCAP-`;
- markers belong in frontend source and focused frontend tests only;
- define a new marker here before adding it to code;
- use one logical marker across row models when the user-facing capability is shared but native mechanics differ;
- multiple markers may appear at one frontend integration point;
- mark extraction-relevant boundaries, not trivial statements;
- preserve accurate markers during refactors;
- avoid casual renames because stable searchability is valuable;
- backend contracts remain authoritative where required even though they are untagged.

# Registered tags

## Row models and setup

### `GRIDCAP-ROWMODEL-CLIENT`

**Meaning:** Client-Side Row Model frontend foundation for a complete bounded working set held in browser memory.

**Ownership:** Client only. AG Grid owns local shaping and native Client selection. TanStack Query owns the authoritative collection boundary.

### `GRIDCAP-ROWMODEL-INFINITE`

**Meaning:** Infinite Row Model frontend foundation including datasource/block-cache lifecycle and Infinite-specific unloaded-row selection semantics.

**Ownership:** Infinite only.

### `GRIDCAP-ROWMODEL-SSRM`

**Meaning:** flat Enterprise SSRM frontend foundation including server-side datasource/store lifecycle and native SSRM selection state where supported.

**Ownership:** SSRM only.

### `GRIDCAP-SETUP-MODULES`

**Meaning:** AG Grid module registration required before configured row-model/runtime APIs are available.

**Ownership:** application/shared frontend setup.

### `GRIDCAP-SETUP-ENTERPRISE`

**Meaning:** Enterprise-only frontend setup such as SSRM modules/API modules and license initialization.

**Ownership:** application/shared frontend setup; currently required by SSRM.

## Data loading, query and lifecycle

### `GRIDCAP-DATA-LOAD`

**Meaning:** obtaining authoritative row data through the correct frontend owner.

**Client:** complete collection through TanStack Query and editable `rowData` projection.

**Infinite/SSRM:** AG Grid datasource lifecycle through feature request mapping and typed API boundaries.

### `GRIDCAP-QUERY-SORT`

**Meaning:** sorting without duplicate application-owned sort state.

**Client:** native local sorting.

**Infinite/SSRM:** native AG Grid sort model translated to the backend query contract.

### `GRIDCAP-QUERY-FILTER`

**Meaning:** filtering without duplicate filter state.

**Client:** native local filtering.

**Infinite/SSRM:** native AG Grid filter model translated to the backend query contract.

### `GRIDCAP-PAGINATION`

**Meaning:** native user-facing pagination and exact current-page boundaries.

**Ownership:** all row models; server cache/store block size is not pagination page size.

### `GRIDCAP-ROW-ID`

**Meaning:** stable backend/business row identity rather than displayed row position.

**Ownership:** all row models; also required by selection and tracked editing.

### `GRIDCAP-REQUEST-FRESHNESS`

**Meaning:** the latest-started server row request owns renderable count metadata.

**Ownership:** Infinite and SSRM.

**Invariant:** request start order, not page number or completion order, decides freshness.

### `GRIDCAP-REQUEST-CANCEL`

**Meaning:** cancel obsolete server datasource work when datasource/grid lifecycle ends.

**Ownership:** Infinite and SSRM datasource lifecycle.

### `GRIDCAP-ERROR-RETRY`

**Meaning:** row-load error presentation and retry/refetch through the correct row-model owner.

**Client:** TanStack Query refetch.

**Infinite:** Infinite refresh/reload lifecycle.

**SSRM:** native `retryServerSideLoads()` lifecycle.

### `GRIDCAP-LIFECYCLE-REFRESH`

**Meaning:** obtain authoritative data after a mutation or explicit refresh without one fake universal refresh API.

**Client:** Query cache update/refetch + `rowData` replacement.

**Infinite:** `refreshInfiniteCache()`.

**SSRM:** `refreshServerSide()`.

### `GRIDCAP-LIFECYCLE-DESTROY`

**Meaning:** safe teardown of GridApi references, listeners and datasource work.

**Ownership:** concrete grid roots plus row-model datasource/listener boundaries.

## Selection and selected operations

### `GRIDCAP-SEL-MANUAL`

**Meaning:** explicit/manual multi-row selection using stable row IDs.

**Ownership:** all row models through their native row-model selection mechanisms.

### `GRIDCAP-SEL-PAGE`

**Meaning:** Select Current Page over the exact AG Grid pagination page.

**Ownership:** all row models.

### `GRIDCAP-SEL-FILTERED`

**Meaning:** Select All Filtered and its filter-universe lifecycle.

**Client:** native filtered Select All.

**Infinite:** application-owned dataset-wide logical state across unloaded rows.

**SSRM:** application-owned filtered-wide semantic beside native SSRM selection.

**Invariant:** changing the defining filter clears the previous filtered-wide selection.

### `GRIDCAP-SEL-ALL`

**Meaning:** Select All Records across the row model's complete selection universe.

**Client:** native local `all` scope.

**Infinite:** compact dataset-wide logical selection.

**SSRM:** native server-side All Records state.

### `GRIDCAP-COUNT-SELECTED`

**Meaning:** user-visible selected-row total.

**Client:** exact native selected rows.

**Infinite/SSRM explicit/current-page:** exact included IDs.

**Infinite/SSRM All Filtered:** `filteredCount - user exceptions`.

**Infinite/SSRM All Records:** `totalCount - user exceptions`.

### `GRIDCAP-SEL-TARGET`

**Meaning:** operation-neutral logical target answering which rows a selected backend operation addresses.

**Ownership:** shared frontend selection-target mechanics plus feature request mapping.

**Invariant:** selection meaning is reused by selected mutation and server-backed Selected export.

### `GRIDCAP-ACTION-SELECTED`

**Meaning:** execute a feature business mutation against the current selection target.

**Ownership:** feature mutation/API lifecycle; concrete roots own row-model-specific selection clearing and refresh after success.

### `GRIDCAP-ROW-ELIGIBILITY`

**Meaning:** frontend application of generic `enabled`, `selectionDisabled`, and `readOnly` row interaction modes.

**Ownership:** shared generic predicates/native callbacks plus feature presentation.

**Invariant:** backend-ineligible rows are not manufactured as user deselection exception IDs.

## Editing, validation and conflicts

### `GRIDCAP-EDIT-TRACKED`

**Meaning:** stable-ID unsaved draft tracking outside transient RowNodes, including LOCAL overlay bookkeeping.

**Ownership:** shared tracked-editing state/hooks plus concrete grid edit events.

### `GRIDCAP-EDIT-PAGE-APPLY`

**Meaning:** programmatically apply edit changes to eligible rows on the exact current page.

**Ownership:** shared current-page editing mechanics plus feature editable-field configuration.

### `GRIDCAP-EDIT-SAVE-ROW`

**Meaning:** persist one explicit dirty row independently of checkbox selection.

**Ownership:** feature persistence lifecycle plus shared draft acknowledgement.

### `GRIDCAP-EDIT-SAVE-SELECTED`

**Meaning:** persist `dirty rows ∩ current selection` as explicit dirty-row patches.

**Invariant:** Select All never manufactures edits for untouched/unloaded rows.

### `GRIDCAP-EDIT-DISCARD`

**Meaning:** discard LOCAL unsaved work and restore the latest authoritative value represented by tracked state.

**Ownership:** shared tracked-editing state plus concrete RowNode value restoration.

### `GRIDCAP-EDIT-VALIDATION`

**Meaning:** field validation for LOCAL tracked edits using resolved JSON-safe rule definitions, frontend-registered executable validators, stable row-ID + field error state, Save guards, and backend field-error reconciliation.

**Ownership:** shared validation engine/state plus feature-owned rule configuration/messages and persistence error mapping.

**Invariant:** invalid LOCAL input stays visible and dirty; validation state is separate from BASE/LOCAL/REMOTE conflict state and a field may be both invalid and conflicted.

### `GRIDCAP-EDIT-CONFLICT`

**Meaning:** BASE/LOCAL/REMOTE reconciliation and field-level conflict resolution.

**Ownership:** shared pure reconciliation/state plus feature conflict presentation and mutation guards.

### `GRIDCAP-COUNT-EDITED`

**Meaning:** exact count of dirty rows, not dirty fields/cells.

**Ownership:** tracked editing payload derivation and editing-controls presentation.

## Import

### `GRIDCAP-IMPORT`

**Meaning:** Transaction file import as a separate preview/apply workflow, distinct from tracked cell editing.

**Ownership:** feature-owned file selection/presentation and typed Import API integration; backend parsing, persisted-field validation, target validation and atomic application remain authoritative.

**Row-model integration:** after successful Apply, each concrete grid root obtains authoritative data through its existing lifecycle: Client refetches the collection, Infinite refreshes its cache, and SSRM refreshes its server-side store.

**Invariant:** Import does not manufacture LOCAL drafts. Existing LOCAL work is reconciled normally when the authoritative post-import refresh arrives, so a divergent imported value can become an ordinary BASE/LOCAL/REMOTE conflict.

## Export

### `GRIDCAP-EXPORT-PAGE`

**Meaning:** export the exact current pagination page through native AG Grid CSV serialization.

**Ownership:** shared page-boundary/export helper plus concrete grid action wiring.

### `GRIDCAP-EXPORT-SELECTED`

**Meaning:** export the current selected universe through the authoritative owner.

**Client:** native/local selected CSV across pagination pages.

**Infinite/SSRM:** backend selected export using the logical selection target.

## State and presentation

### `GRIDCAP-STATE-PERSISTENCE`

**Meaning:** native AG Grid Grid State persistence for supported durable view preferences.

**Current persisted slices:** column order/pinning/sizing/visibility, filters and sort.

**Transient:** pagination position and row selection.

### `GRIDCAP-COLUMNS`

**Meaning:** feature-owned native `ColDef` composition for sorting, filtering, editing, formatting, renderers and utility columns.

**Ownership:** feature grid/column composition; shared helpers only where genuinely domain-neutral.

### `GRIDCAP-THEME`

**Meaning:** application design-token integration with the AG Grid theme and shared visual defaults.

**Ownership:** theme/application setup, not feature business logic.

## Configurable table composition

### `GRIDCAP-CONFIGURABLE-TABLE`

**Meaning:** JSON-safe configurable-table provider, runtime validation, compiler and allowlisted registry boundary that turns supported application metadata into normal frontend-owned AG Grid inputs.

**Ownership:** shared frontend configuration contracts/validation/compiler plus feature-local definitions, registries/providers and isolated composition roots.

**Invariant:** metadata never carries executable code and does not dynamically choose Client, Infinite or SSRM. The concrete frontend composition owns the row model and its native lifecycle.
