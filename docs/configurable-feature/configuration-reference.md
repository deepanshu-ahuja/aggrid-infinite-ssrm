# Configurable Feature Configuration Reference

Public reference for `frontend/src/shared/grid/configurable/configuration.types.ts` and the first implemented configurable SSRM runtime.

The normalized public configuration contract remains native-first. Raw backend/storage JSON is never passed directly to AG Grid.

Quick visual reference: [`type-hierarchy.md`](type-hierarchy.md). Current implemented runtime behavior: [`../implementation/configurable-ssrm.md`](../implementation/configurable-ssrm.md).

## Core boundary

```text
frontend-supported configuration design
        ↓
may be stored/managed using backend/database shape
        ↓
backend returns runtime JSON (`unknown`)
        ↓
validate + normalize/adapt ALWAYS
        ↓
normalized frontend configuration
        ↓
application configurable-SSRM defaults + entity.gridOptions
        ↓
deterministic merge
        ↓
resolve registries + runtime policy + compile
        ↓
AG Grid GridOptions / ColDef / callbacks / components
```

Normalization remains mandatory even when backend/storage names already equal normalized frontend names. TypeScript/AG Grid typing does not validate runtime JSON.

The current runtime implements this boundary in:

```text
configuration.defaults.ts
configuration.normalizer.ts
configuration.registries.ts
configuration.compiler.ts
```

The first real consumer is the isolated Transaction `/configurable-ssrm` route. Existing `/client`, `/infinite`, `/ssrm`, and `/ssrm-native-editing` remain independent.

## AG Grid naming and type rule

```text
same AG Grid concept + same persisted semantics
→ keep AG Grid property name

precise exported AG Grid type exists
→ use it directly

reviewed group of native properties
→ Pick<AGGridType, ReviewedKeys>

native member mixes data + callback/function
→ Extract/Omit/narrow only that member

single indexed-access type is clearest
→ Type['key'] is fine
```

Use explicit positive `Pick` allowlists at the top level. Do not define persisted configuration as a broad `Omit<ColDef, UnsafeKeys>` / `Omit<GridOptions, UnsafeKeys>` because a future AG Grid upgrade could otherwise expose new members accidentally.

## Configuration categories

### Native declarative values

Examples:

```text
gridOptions.pagination
gridOptions.rowSelection
gridOptions.cellSelection
gridOptions.invalidEditValueMode
gridOptions.defaultColDef
field.type
field.filter
field.filterParams
field.editable
field.cellEditor
field.cellEditorParams
field.cellRenderer
field.suppressPaste
```

### Native registered component names

AG Grid already supports named filters/editors/renderers, so keep native names:

```ts
filter: 'agTextColumnFilter'
cellEditor: 'agNumberCellEditor'
cellEditor: 'transactionAccountEditor'
cellRenderer: 'statusChip'
```

Frontend runtime owns and validates actual registrations. The implemented compiler checks configured filter/editor/renderer names against explicit frontend allowlists before passing them to AG Grid.

### Executable behavior selected by configuration

Raw functions and AG Grid expression strings are not accepted from backend JSON.

```text
valueFormatterKey → frontend registry → ColDef.valueFormatter
valueParserKey    → frontend registry → ColDef.valueParser
validationRules[].key → frontend validator registry → native editor validation callback
```

`RegisteredValueFormatter<TData, TValue>` and `RegisteredValueParser<TData, TValue>` are derived from the real function branches of AG Grid `ColDef`, so registries do not invent parallel callback signatures.

### Application declarations

These are not AG Grid properties because their persisted meaning is application-owned:

```text
featureKey
dataAdapterKey
rowId.path
labelKey
validationRules
valueFormatterKey/valueParserKey
```

### Runtime-owned values

Do not persist merely because `AgGridReact` accepts them:

```text
modules
rowModelType
serverSideDatasource
columnDefs
context
getRowId callback
GridApi refs
events/lifecycle callbacks
validation callbacks
business callbacks such as isRowSelectable/getRowClass
```

The current compiler deliberately does not own datasource creation, query mapping, GridApi refs, modules or lifecycle callbacks. The concrete configurable SSRM root keeps those relationships visible.

## Feature and entity

```ts
interface FeatureDefinition<...> {
  featureKey: TFeatureKey;
  entities: Record<TEntityKey, TEntityDefinition>;
}

interface EntityDefinition<...> {
  labelKey: TLabelKey;
  dataAdapterKey: string;
  rowId: RowIdDefinition;
  gridOptions?: ConfigurableSsrmGridOptions;
  fields: readonly TFieldDefinition[];
}
```

The `entities` record key is the business/config identity such as `transaction` or `loan`. `EntityDefinition` itself does not know those names.

`dataAdapterKey` identifies frontend loading/saving/request-response mapping. It is not an AG Grid datasource object.

The first Transaction consumer resolves `dataAdapterKey='transactions'` to the existing `listTransactions(mapTransactionGridRequest(...))` loader. The shared configurable compiler does not infer backend query fields/operators from configured columns.

## Grid-level native surface

`ConfigurableSsrmGridOptions` is based on a reviewed `Pick<GridOptions, ...>` plus narrowed nested replacements:

```text
pagination
paginationAutoPageSize
paginationPageSize
paginationPageSizeSelector
suppressPaginationPanel

cacheBlockSize
maxBlocksInCache
blockLoadDebounceMillis
maxConcurrentDatasourceRequests
serverSideInitialRowCount
suppressServerSideFullWidthLoadingRow

invalidEditValueMode
singleClickEdit
suppressClickEdit
enterNavigatesVertically
enterNavigatesVerticallyAfterEdit
stopEditingWhenCellsLoseFocus
undoRedoCellEditing
undoRedoCellEditingLimit
suppressClipboardPaste

suppressMovableColumns
suppressMoveWhenColumnDragging
suppressColumnMoveAnimation
suppressDragLeaveHidesColumns

rowHeight
rowBuffer
headerHeight
animateRows
enableRtl

enableBrowserTooltips
tooltipShowDelay
tooltipSwitchShowDelay
tooltipHideDelay
tooltipMouseTrack
tooltipInteraction

suppressCellFocus
suppressHeaderFocus
enableCellTextSelection
ensureDomOrder
```

Nested reviewed values:

```text
defaultColDef → ConfigurableDefaultColDef
rowSelection  → ConfigurableSsrmRowSelectionOptions
cellSelection → boolean | ConfigurableCellSelectionOptions
```

`rowModelType` stays architecture-owned. `readOnlyEdit` stays excluded because the native-first draft architecture observes normal `cellValueChanged`; `readOnlyEdit` changes ownership to `cellEditRequest`.

Grouping/tree/pivot/aggregation remain separate capabilities until the configurable SSRM runtime and server request semantics actually support them.

## Application configurable-SSRM defaults

`configuration.defaults.ts` owns frontend application defaults. They are not persisted metadata.

The current baseline:

```text
existing server-backed pagination/cache defaults
invalidEditValueMode = block
native multi-row selection / selectAll = all
native Cell Selection with fill handle
common Simple Filter Apply/Reset params
```

The configurable defaults explicitly set:

```text
defaultColDef.sortable = false
defaultColDef.filter = false
```

This is deliberate. The application-wide AG Grid default column definition enables sorting/filtering, but a configurable server-backed table must not silently inherit an operation unless the configured field opts in and the active server adapter can execute the same meaning.

## Exact merge semantics

`entity.gridOptions` overrides application defaults.

```text
top-level scalar / array
→ entity value replaces application default

defaultColDef
→ merge
→ nested filterParams / cellEditorParams / cellRendererParams merge

rowSelection
→ merge while native mode is unchanged
→ singleRow ↔ multiRow replaces the entire branch

cellSelection boolean
→ complete replacement

cellSelection object
→ merge
→ handle merges only when mode remains the same
→ range ↔ fill replaces the handle branch

resolved defaultColDef + field
→ field wins
→ field filter/editor/renderer params merge with inherited static params
```

Arrays are replacement values, not concatenated metadata.

The mode-sensitive behavior is important because native selection/handle objects are discriminated unions; a blind deep merge can produce an impossible AG Grid shape.

## Runtime validation and normalization

The runtime boundary accepts `unknown`, not `FeatureDefinition`.

The normalizer validates the reviewed positive surface before returning a deep JSON clone typed as the normalized frontend contract. It rejects:

```text
unknown/unreviewed properties
functions, bigint, undefined, class instances and other non-JSON values
unsupported cell data types
invalid native enum/union branches that are explicitly exposed
duplicate colIds
filter option / cell-data-type mismatches
Simple Filter maxNumConditions other than 1
unsupported flat-SSRM rowSelection branches
unsupported Cell Selection handle values
non-object registry config/params shapes
```

Validation of runtime JSON is distinct from compile-time type derivation. Both are required.

## Column-level native surface

`ConfigurableNativeColDefOptions` derives the reviewed native column surface with `Pick<ColDef, ...>`.

Current direct-native members include:

```text
type
sortable
initialSort
initialSortIndex
sortingOrder
initialHide
lockVisible
initialPinned
initialWidth
initialFlex
minWidth
maxWidth
resizable
suppressSizeToFit
suppressAutoSize
suppressMovable
lockPosition
lockPinned
wrapText
autoHeight
wrapHeaderText
autoHeaderHeight
headerTooltip
tooltipField
floatingFilter
suppressHeaderMenuButton
suppressHeaderFilterButton
suppressHeaderContextMenu
suppressFloatingFilterButton
cellEditorPopup
cellEditorPopupPosition
singleClickEdit
useValueParserForImport
useValueFormatterForExport
suppressFillHandle
```

`type` intentionally supports native definitions such as the `/ssrm-native-editing` spike's `type: 'numericColumn'`.

Callback-capable properties are narrowed to their static branch:

```ts
editable?: Extract<NonNullable<ColDef['editable']>, boolean>;
suppressNavigable?: Extract<NonNullable<ColDef['suppressNavigable']>, boolean>;
suppressPaste?: Extract<NonNullable<ColDef['suppressPaste']>, boolean>;
```

Filter/editor/renderer properties retain native AG Grid names:

```ts
filter?: boolean | TFilterName;
filterParams?: TFilterParams;
cellEditor?: TCellEditorName;
cellEditorParams?: ConfigurationJsonObject;
cellRenderer?: TCellRendererName;
cellRendererParams?: ConfigurationJsonObject;
```

`cellEditorParams` / `cellRendererParams` remain JSON-safe because custom registered components can define arbitrary params. Runtime-owned callback params are merged later.

## Default column definition

`ConfigurableDefaultColDef` uses the same reviewed native surface, with common server-backed Simple Filter params rather than a Text/Number/Date-specific operator list.

This lets application defaults express the proven server-backed behavior:

```ts
filterParams: {
  buttons: ['reset', 'apply'],
  maxNumConditions: 1,
  closeOnApply: true,
}
```

while individual fields own their actual `filterOptions`.

## Cell data type

```ts
export type FieldCellDataType = BaseCellDataType;
```

AG Grid remains the source of truth for predefined values:

```text
text
number
bigint
boolean
date
dateString
dateTime
dateTimeString
object
```

SSRM does not infer these from loaded data, so configurable fields supply them explicitly.

## Native server-backed filtering

There is **no `field.filtering` wrapper anymore**.

The normalized field follows the same shape as `/ssrm-native-editing`:

```ts
filter: 'agTextColumnFilter',
filterParams: {
  buttons: ['reset', 'apply'],
  maxNumConditions: 1,
  closeOnApply: true,
  filterOptions: ['contains', 'equals'],
}
```

The application/server constraint is enforced through the native `filterParams.filterOptions` values plus runtime normalization/adapter validation.

### Operator types

All operator keys derive from AG Grid `ISimpleFilterModelType` using `Extract`.

Current common server contract:

```text
text
→ contains / equals / notEqual / startsWith / endsWith

number + bigint
→ equals / notEqual / greaterThan / greaterThanOrEqual / lessThan / lessThanOrEqual

date/dateString/dateTime/dateTimeString
→ equals / notEqual / lessThan / greaterThan

boolean
→ equals / notEqual
```

A feature-specific adapter may extend this through the `TAdditionalFilterOption` generic only when it actually implements the corresponding native filter-model semantics.

### Common Simple Filter params

`ConfigurableSimpleFilterCommonParams` derives these safe native members:

```text
buttons
closeOnApply
debounceMs
readOnly
filterPlaceholder → string branch only
maxNumConditions  → narrowed to 1
```

`maxNumConditions` is intentionally `1`, not general `number`, because the current server query model cannot represent AG Grid's combined condition model.

### Text Filter

`ConfigurableTextFilterParams` adds:

```text
filterOptions
defaultOption
trimInput
```

`caseSensitive` is not exposed yet because it changes filtering semantics without being carried as a server-understandable flag in the current filter model. `textMatcher` / `textFormatter` are executable and also remain frontend-owned.

### Number / BigInt Filter

`ConfigurableNumberFilterParams` and `ConfigurableBigIntFilterParams` add native:

```text
filterOptions
defaultOption
allowedCharPattern
```

Native `numberParser` / `numberFormatter` / bigint parser/formatter are executable. Blank handling and range-inclusion flags also stay out until the server-query contract owns those meanings.

### Date Filter

`ConfigurableDateFilterParams` adds:

```text
filterOptions
defaultOption
browserDatePicker
minValidYear
maxValidYear
minValidDate  → string branch
maxValidDate  → string branch
```

`comparator` / `isValidDate` are callbacks. Time/range semantic toggles are not exposed until backend mapping supports them explicitly.

### Set Filter / Multi Filter

They are separate native filter families with different filter-model semantics. They are not included in the current flat Simple Filter SSRM contract merely because Enterprise AG Grid can render them.

## Cell Selection

The type is derived from `GridOptions['cellSelection']`.

```text
native top-level options
→ suppressMultiRanges
→ enableHeaderHighlight
→ enableColumnSelection

native handle union
→ range branch unchanged
→ fill branch with only setFillValue omitted
```

`setFillValue` is executable. The rest remains AG Grid-native.

This is the configuration surface behind the spike's native Cell Selection, Ctrl/Cmd+D, Ctrl/Cmd+Enter and Fill Handle interaction.

The implemented merge follows that discriminated native shape: boolean selection replaces the object form, and range/fill handle branches are replaced rather than cross-merged when `mode` changes.

## Row selection

The type derives `singleRow` and `multiRow` branches from `GridOptions['rowSelection']`.

Safe common members include:

```text
enableClickSelection
checkboxLocation
hideDisabledCheckboxes
copySelectedRows
enableSelectionWithoutKeys
checkboxes → boolean branch only
```

Multi-row also supports:

```text
headerCheckbox
ctrlASelectsRows
selectAll → all only for SSRM
```

`isRowSelectable` remains runtime business policy. `groupSelects` is not exposed for the current flat configurable SSRM runtime merely to allow its default/self behavior. It belongs with a future real server-side grouping capability.

The normalizer validates the supported native row-selection branches. The compiler can add the frontend-owned `isRowSelectable` callback to the resolved native selection object without putting that callback into persisted JSON.

## Field definition

```ts
FieldDefinition =
  ConfigurableNativeColDefOptions<...> & {
    colId;
    field;
    labelKey;
    cellDataType;
    validationRules?;
    valueFormatterKey?;
    valueFormatterConfig?;
    valueParserKey?;
    valueParserConfig?;
  };
```

### `colId` vs `field`

```text
colId
→ native AG Grid column identity
→ Grid State/API/logical config identity

field
→ native ColDef.field
→ current API/row value path
```

They may differ.

The compiler maps `labelKey` to native `headerName`. It compiles `rowId.path` separately into native `getRowId` plus the stable row-ID accessor used by shared draft editing.

## Native editor / renderer configuration

There is no custom `editing.editor` or `renderer: { key }` wrapper.

```text
editable
cellEditor
cellEditorParams
cellEditorPopup
cellEditorPopupPosition
singleClickEdit
suppressPaste
suppressFillHandle
useValueParserForImport
useValueFormatterForExport
cellRenderer
cellRendererParams
```

all map directly to the same AG Grid properties.

The native editing spike demonstrates an important merge rule:

```text
persisted cellEditorParams
→ e.g. min / max / maxLength

runtime editor validation
→ getValidationErrors callback

compiler/editor adapter
→ merges both into final native cellEditorParams
```

Functions never come from backend JSON.

## Validation rules

`FieldDefinition.validationRules` reuses the repository's existing proven validation contract rather than creating a second validation language:

```ts
GridValidationRule {
  key
  params?
  message?
}
```

The configurable alias changes only `params` to `ConfigurationJsonObject` so persisted rules remain JSON-safe.

Example equivalent to the existing Transaction validation rules:

```ts
validationRules: [
  { key: 'required', message: 'Account is required.' },
  {
    key: 'maxLength',
    params: { max: 100 },
    message: 'Account must be 100 characters or fewer.',
  },
]
```

Runtime ownership follows the merged native-editing spike:

```text
configuration validationRules
→ frontend validator registry
→ validation messages

provided AG Grid editor
→ runtime cellEditorParams.getValidationErrors

custom React/MUI editor
→ useGridCellEditor({ getValidationErrors, getValidationElement })

gridOptions.invalidEditValueMode = 'block'
→ invalid edit stays in the editor and never becomes a committed BASE+LOCAL draft
```

The current compiler implements the provided-editor branch and fails configuration compilation immediately when a rule key is not registered. The callbacks themselves are not configuration.

## Formatter/parser registries

```text
valueFormatterKey
→ formatter registry
→ real AG Grid valueFormatter function

valueParserKey
→ parser registry
→ real AG Grid valueParser function
```

If `valueParserKey` is omitted, native `cellDataType` parsing remains available where AG Grid provides it.

`valueFormatterConfig` / `valueParserConfig` without their matching key are compiler errors; unknown keys are also compiler errors.

## Native-first editing ownership

Merged PR #42 (`/ssrm-native-editing`) is the editing reference:

```text
AG Grid
→ normal edit
→ Cell Selection
→ Ctrl/Cmd+D
→ Ctrl/Cmd+Enter
→ Fill Handle
→ clipboard/paste
→ editable filtering
→ editor validation lifecycle
→ cellValueChanged

shared runtime
→ only dirty BASE + LOCAL fields
→ revert-to-BASE cleanup
→ selected ∩ dirty targeting
→ safe save acknowledgement/rebase
→ SSRM LOCAL restoration after RowNode/store recreation
→ Discard + authoritative refresh
```

Do not add configuration for the old Apply Last Edit/current-page Flow 1/Flow 2 mechanics. The native interactions supersede those mechanics in this architecture.

The `/configurable-ssrm` root composes `useGridDraftEditing` rather than copying the spike. It keeps only BASE + LOCAL dirty fields and restores LOCAL after SSRM RowNode/store recreation.

Runtime draft state, dirty counts, acknowledgement, SSRM restoration and Discard refresh are not persisted metadata. REMOTE/conflict reconciliation is also not automatically part of configurable editing; concurrency remains a separate product decision.

## First real consumer

`frontend/src/features/transactions/configurable/transactionsConfigurableFeature.ts` deliberately declares the first raw feature as `unknown` and immediately normalizes it.

It registers:

```text
provided filter names
provided/custom editor names
custom renderer names + implementations
formatter factories
parser factories
shared + Transaction-specific validators
Transaction data adapter
label resolver
```

The concrete `TransactionsConfigurableSsrmGrid` owns the SSRM row model, datasource, modules, GridApi ref, business edit/select policy, lifecycle events and PR #42 draft composition.

This is intentionally a real consumer, not a universal wrapper.

## Current deliberate limits

The current foundation does not yet implement:

```text
configurable read/write/save mapping
configurable selected business actions
access/security/masking metadata
Grid State/access reconciliation
runtime config schema/version negotiation
grouping/tree/pivot/aggregation
REMOTE/conflict/concurrency/versioning
```

Those are separate contracts. Do not add speculative metadata merely because AG Grid exposes a related API.

## Generated API docs

TypeDoc + `typedoc-plugin-markdown` are configured through root `typedoc.json` and:

```bash
npm run docs:configurable
```

Whenever `configuration.types.ts` or its JSDoc changes, regenerate `docs/configurable-feature/generated/` before treating generated API pages as current. This runtime batch does not alter `configuration.types.ts`, but the generated tree was already stale at the handoff checkpoint, so an actual regeneration is still required before it can be described as current.
