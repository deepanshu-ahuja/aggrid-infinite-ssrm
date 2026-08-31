# Configurable Feature Configuration Reference

Public reference for `frontend/src/shared/grid/configurable/configuration.types.ts`.

The configurable runtime/compiler is not wired yet. This document defines the normalized frontend contract that runtime code must eventually validate and compile. Configuration may be persisted by the backend, but raw backend/storage JSON is never passed directly to AG Grid.

Quick visual reference: [`type-hierarchy.md`](type-hierarchy.md).

## Core boundary

```text
frontend-supported configuration design
        ↓
may be stored/managed using backend/database shape
        ↓
backend returns runtime JSON
        ↓
validate + normalize/adapt ALWAYS
        ↓
normalized frontend configuration
        ↓
resolve registries + runtime policy + compile
        ↓
AG Grid GridOptions / ColDef / callbacks / components
```

Normalization remains mandatory even when backend/storage names already equal normalized frontend names. TypeScript/AG Grid typing does not validate runtime JSON.

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

Frontend runtime owns and validates actual registrations.

### Executable behavior selected by configuration

Raw functions and AG Grid expression strings are not accepted from backend JSON.

```text
valueFormatterKey → frontend registry → ColDef.valueFormatter
valueParserKey    → frontend registry → ColDef.valueParser
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

`FieldDefinition.validationRules` now reuses the repository's existing proven validation contract rather than creating a second validation language:

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

The callbacks themselves are not configuration.

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

Runtime draft state, dirty counts, acknowledgement, SSRM restoration and Discard refresh are not persisted metadata. REMOTE/conflict reconciliation is also not automatically part of configurable editing; concurrency remains a separate product decision.
