# Configurable Feature Configuration Reference

Public reference for `frontend/src/shared/grid/configurable/configuration.types.ts`.

The configurable runtime/compiler is not wired yet. This document defines the normalized frontend contract that runtime code must eventually validate and compile. Configuration may be persisted by the backend, but raw backend/storage JSON is never passed directly to AG Grid.

Quick visual reference: [`type-hierarchy.md`](type-hierarchy.md).

## Core boundary: backend shape is not the grid contract

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

Normalization remains mandatory even when backend/storage property names happen to match normalized frontend names exactly. TypeScript/AG Grid types protect source code at compile time; they do not validate runtime JSON.

A backend property that the deployed frontend does not validate/normalize/compile has no effect. Unknown required registered component names, executable registry keys and invalid supported values must fail clearly.

## AG Grid naming and type-derivation rule

Use AG Grid vocabulary **and AG Grid's own types** when the normalized value has the same semantics.

```text
same concept + same persisted value semantics
→ AG Grid property name

precise exported AG Grid type exists
→ use it directly

reviewed group of native properties
→ Pick<AGGridType, ReviewedKeys>

native member mixes safe declarative data + callback/function
→ Extract/Omit/narrow only that member

one Type['key'] is the clearest exact type
→ indexed access is fine
```

Examples:

```ts
FieldCellDataType = BaseCellDataType

ConfigurableNativeColDefBase =
  Pick<ColDef, ConfigurableNativeColDefKey>

ConfigurableSsrmGridOptionsBase =
  Pick<GridOptions, ConfigurableSsrmGridOptionKey>
```

Do not manually re-declare every native member as `foo?: ColDef['foo']` or `bar?: GridOptions['bar']` when a `Pick` communicates the supported surface directly.

Also avoid a broad negative persisted type such as `Omit<ColDef, UnsafeKeys>`. AG Grid can add new members in a future release; a broad `Omit` could silently make them configurable. An explicit reviewed `Pick` makes every newly-supported capability opt-in.

## Configuration categories

### Native + declarative + JSON-safe

Keep native property names/types through direct AG Grid derivation.

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

AG Grid supports provided/registered filters, editors and renderers by string name, so normalized config can safely carry values such as:

```ts
filter: "agTextColumnFilter"
cellEditor: "agNumberCellEditor"
cellEditor: "transactionAccountEditor"
cellRenderer: "statusChip"
```

The frontend runtime owns the actual component implementations and validates/allowlists configured names.

### Executable behavior selected by configuration

Functions and AG Grid expression strings are not accepted from backend configuration.

```text
valueFormatterKey → frontend registry → ColDef.valueFormatter
valueParserKey    → frontend registry → ColDef.valueParser
```

`RegisteredValueFormatter<TData, TValue>` and `RegisteredValueParser<TData, TValue>` are derived from the actual function branches of `ColDef.valueFormatter` / `ColDef.valueParser`, so registry implementations can use AG Grid's real callback contract instead of a parallel local signature.

Optional `valueFormatterConfig` / `valueParserConfig` are JSON-safe application inputs interpreted by the registered implementation.

### Runtime/compiler-owned infrastructure

Not persisted merely because `AgGridReact` accepts it:

```text
modules
rowModelType
serverSideDatasource
columnDefs
context
getRowId callback
GridApi refs
event/lifecycle callbacks
native validation callbacks
business-policy callbacks such as isRowSelectable
```

## `FeatureDefinition`

```ts
interface FeatureDefinition<
  TFeatureKey extends string = string,
  TEntityKey extends string = string,
  TEntityDefinition extends EntityDefinition = EntityDefinition,
> {
  featureKey: TFeatureKey;
  entities: Record<TEntityKey, TEntityDefinition>;
}
```

Entity business identity is the key in `entities`:

```text
review
├── transaction → EntityDefinition
└── loan        → EntityDefinition
```

`EntityDefinition` itself remains business-agnostic.

## `EntityDefinition`

```ts
interface EntityDefinition<TLabelKey, TFieldDefinition> {
  labelKey: TLabelKey;
  dataAdapterKey: string;
  rowId: RowIdDefinition;
  gridOptions?: ConfigurableSsrmGridOptions;
  fields: readonly TFieldDefinition[];
}
```

`labelKey` is a translation key, not final AG Grid `headerName` text.

`dataAdapterKey` resolves frontend loading/saving/request-response mapping and wire normalization; it is not a persisted datasource object.

`rowId` is declarative data used to construct native executable `getRowId` behavior.

## `ConfigurableSsrmGridOptions`

The type is derived rather than manually mirrored:

```ts
type ConfigurableSsrmGridOptionsBase =
  Pick<GridOptions, ConfigurableSsrmGridOptionKey>;

export type ConfigurableSsrmGridOptions =
  ConfigurableSsrmGridOptionsBase & {
    defaultColDef?: ConfigurableDefaultColDef;
    rowSelection?: ConfigurableSsrmRowSelectionOptions;
    cellSelection?: boolean | ConfigurableCellSelectionOptions;
  };
```

The reviewed direct-native keys currently cover:

```text
pagination
→ pagination
→ paginationAutoPageSize
→ paginationPageSize
→ paginationPageSizeSelector
→ suppressPaginationPanel

SSRM cache/loading
→ cacheBlockSize
→ maxBlocksInCache
→ blockLoadDebounceMillis
→ maxConcurrentDatasourceRequests
→ serverSideInitialRowCount
→ suppressServerSideFullWidthLoadingRow

editing/navigation
→ invalidEditValueMode
→ singleClickEdit
→ suppressClickEdit
→ enterNavigatesVertically
→ enterNavigatesVerticallyAfterEdit
→ stopEditingWhenCellsLoseFocus
→ undoRedoCellEditing
→ undoRedoCellEditingLimit
→ suppressClipboardPaste

column movement
→ suppressMovableColumns
→ suppressMoveWhenColumnDragging
→ suppressColumnMoveAnimation
→ suppressDragLeaveHidesColumns

layout/presentation
→ rowHeight
→ rowBuffer
→ headerHeight
→ animateRows
→ enableRtl

tooltips
→ enableBrowserTooltips
→ tooltipShowDelay
→ tooltipSwitchShowDelay
→ tooltipHideDelay
→ tooltipMouseTrack
→ tooltipInteraction

focus/accessibility
→ suppressCellFocus
→ suppressHeaderFocus
→ enableCellTextSelection
→ ensureDomOrder
```

`defaultColDef`, `rowSelection` and `cellSelection` are replaced by narrower derived types because their native value shapes include nested/mixed capability that needs review.

`rowModelType` remains architecture-owned; backend metadata does not choose another row model.

`readOnlyEdit` is deliberately not exposed because it changes the selected editing lifecycle from normal mutation/`cellValueChanged` to application-owned `cellEditRequest`.

Grouping/tree/pivot/aggregation options remain out of the initial flat SSRM contract until server semantics exist end to end.

## `ConfigurableNativeColDefOptions`

The native column surface is `Pick`-derived:

```ts
type ConfigurableNativeColDefBase =
  Pick<ColDef, ConfigurableNativeColDefKey>;
```

Current direct-native groups include:

```text
column type / sorting
→ type
→ sortable
→ initialSort
→ initialSortIndex
→ sortingOrder

layout/sizing
→ initialHide
→ lockVisible
→ initialPinned
→ initialWidth
→ initialFlex
→ minWidth
→ maxWidth
→ resizable
→ suppressSizeToFit
→ suppressAutoSize
→ suppressMovable
→ lockPosition
→ lockPinned

text/header/filter presentation
→ wrapText
→ autoHeight
→ wrapHeaderText
→ autoHeaderHeight
→ headerTooltip
→ tooltipField
→ floatingFilter
→ suppressHeaderMenuButton
→ suppressHeaderFilterButton
→ suppressHeaderContextMenu
→ suppressFloatingFilterButton

editing/import/export
→ cellEditorPopup
→ cellEditorPopupPosition
→ singleClickEdit
→ useValueParserForImport
→ useValueFormatterForExport
→ suppressFillHandle
```

`type` is important for native definitions such as the native-editing spike's `type: 'numericColumn'`; configuration should not invent another column-type property.

Mixed callback-capable native members are narrowed separately:

```ts
editable?: Extract<NonNullable<ColDef['editable']>, boolean>;
suppressNavigable?: Extract<NonNullable<ColDef['suppressNavigable']>, boolean>;
suppressPaste?: Extract<NonNullable<ColDef['suppressPaste']>, boolean>;
```

Then native filter/editor/renderer names and their static params are represented with native property names:

```ts
filter?: boolean | TFilterName;
filterParams?: TFilterParams;
cellEditor?: TCellEditorName;
cellEditorParams?: ConfigurationJsonObject;
cellRenderer?: TCellRendererName;
cellRendererParams?: ConfigurationJsonObject;
```

This is intentionally not an unrestricted `ColDef` passthrough.

## `ConfigurableDefaultColDef`

`defaultColDef` uses the same reviewed native column surface, but its `filterParams` is intentionally the common Simple Filter behavior rather than one filter type's operator list:

```ts
ConfigurableNativeColDefOptions<
  string,
  string,
  string,
  ConfigurableSimpleFilterCommonParams
>
```

This is where application defaults such as `buttons: ['reset', 'apply']`, `maxNumConditions: 1` and `closeOnApply: true` can live without pretending that Text, Number and Date share the same valid `filterOptions`.

## `FieldCellDataType`

The normalized type directly uses AG Grid's exported predefined union:

```ts
export type FieldCellDataType = BaseCellDataType;
```

Current values are therefore source-derived:

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

SSRM requires the type to be supplied explicitly. Data adapters remain responsible for materialising the JavaScript representation AG Grid expects, e.g. real `bigint` values cannot arrive directly through ordinary JSON.

## Native server-backed filtering

There is deliberately **no longer a `field.filtering` wrapper**.

The normalized field uses the same properties as the native SSRM reference grid:

```ts
filter: 'agTextColumnFilter',
filterParams: {
  buttons: ['reset', 'apply'],
  maxNumConditions: 1,
  closeOnApply: true,
  filterOptions: ['contains', 'equals'],
}
```

The server capability constraint is preserved by narrowing `filterParams.filterOptions` to native `ISimpleFilterModelType` keys that the data adapter/backend supports. Normalization/runtime validation still verifies that configured filter semantics are actually supported end to end.

### Common Simple Filter params

`ConfigurableSimpleFilterCommonParams` derives safe common behavior from `ITextFilterParams`:

```text
buttons
closeOnApply
debounceMs
readOnly
defaultOption
defaultJoinOperator
maxNumConditions
numAlwaysVisibleConditions
filterPlaceholder (string branch only)
```

AG Grid's executable `filterPlaceholder` callback is not persisted.

### Text Filter

`ConfigurableTextFilterParams` derives from `ITextFilterParams` and adds:

```text
caseSensitive
trimInput
filterOptions
```

`textMatcher`, `textFormatter` and custom filter-option predicates are executable, so they remain frontend-owned.

Current server-supported Text options:

```text
contains
equals
notEqual
startsWith
endsWith
```

### Number / BigInt Filters

`ConfigurableNumberFilterParams` and `ConfigurableBigIntFilterParams` derive native scalar behavior such as:

```text
inRangeInclusive
includeBlanksInEquals
includeBlanksInNotEqual
includeBlanksInLessThan
includeBlanksInGreaterThan
includeBlanksInRange
allowedCharPattern
```

Executable native parser/formatter callbacks are not persisted.

Current server-supported Number/BigInt operators remain:

```text
equals
notEqual
greaterThan
greaterThanOrEqual
lessThan
lessThanOrEqual
```

The types can represent native declarative parameters such as `inRangeInclusive`, but runtime validation must reject contradictory configuration such as enabling an `inRange`-specific behavior while the active server contract does not support the `inRange` operator.

### Date Filter

`ConfigurableDateFilterParams` derives safe native properties such as:

```text
browserDatePicker
minValidYear
maxValidYear
inRangeFloatingFilterDateFormat
includeTime
useIsoSeparator
```

`minValidDate` / `maxValidDate` are narrowed to AG Grid's string branch because JavaScript `Date` objects are not JSON-safe. Native `comparator` and `isValidDate` callbacks stay frontend-owned.

Current server-supported Date options remain:

```text
equals
notEqual
lessThan
greaterThan
```

### Boolean / Set / Multi Filter boundary

The initial configurable runtime is modelling the Simple Filter server contract proven by the current SSRM grids. Set Filter and Multi Filter have different server model semantics and are not silently included merely because AG Grid exposes them. They should be added as separate native capabilities when the data adapter/backend can represent them.

## Cell Selection

Cell Selection derives from:

```ts
GridOptions['cellSelection']
```

Conceptually:

```text
NativeCellSelectionOptions
→ Pick suppressMultiRanges / enableHeaderHighlight / enableColumnSelection

NativeCellSelectionHandle
→ Extract range branch
→ Extract fill branch
→ Omit fill.setFillValue
```

`setFillValue` is executable and therefore remains frontend-owned. All other reviewed declarative handle semantics stay AG Grid-derived.

This native surface powers Cell Selection, Ctrl/Cmd+D, Ctrl/Cmd+Enter and Fill Handle editing learned from PR #42.

## Row selection

Row-selection types derive from:

```ts
GridOptions['rowSelection']
```

The contract `Extract`s native `singleRow` and `multiRow` branches, `Pick`s common safe declarative members and narrows callback-capable `checkboxes` to boolean.

For current flat SSRM:

```text
selectAll → all
```

`isRowSelectable` stays runtime-owned business policy. `groupSelects` is no longer exposed merely to allow the value `'self'`; grouping is not part of the current configurable SSRM capability. If server-side grouping is added later, its native group-selection semantics should be introduced together with the real grouping request/state contract.

`ctrlASelectsRows` remains a useful native multi-row option when Cell Selection is active.

AG Grid 36.1 treats `selectAll='filtered'|'currentPage'` as invalid for SSRM; therefore those values are not represented as native configurable SSRM selection. The repository's All Filtered / Current Page operations remain explicit application semantics.

## `FieldDefinition`

The public shape is a type intersection rather than a manually mirrored interface:

```ts
export type FieldDefinition<...> =
  ConfigurableNativeColDefOptions<
    TCellEditorName,
    TCellRendererName,
    string,
    ConfigurableFilterParamsForCellDataType<TCellDataType, TAdditionalFilterOption>
  > & {
    colId: TColId;
    field: TFieldPath;
    labelKey: TLabelKey;
    cellDataType: TCellDataType;

    valueFormatterKey?: TValueFormatterKey;
    valueFormatterConfig?: ConfigurationJsonObject;
    valueParserKey?: TValueParserKey;
    valueParserConfig?: ConfigurationJsonObject;
  };
```

### `colId` vs `field`

```text
colId
→ AG Grid ColDef.colId
→ stable Grid State/API/logical column identity

field
→ AG Grid ColDef.field
→ current API/row value path
```

They may differ.

## Native editor / renderer configuration

There is no `editing.editor` wrapper and no `renderer: { key }` wrapper.

```text
editable                  → composed ColDef.editable
cellEditor                → ColDef.cellEditor registered/provided name
cellEditorParams          → static ColDef.cellEditorParams data
cellEditorPopup           → ColDef.cellEditorPopup
cellEditorPopupPosition   → ColDef.cellEditorPopupPosition
singleClickEdit           → ColDef.singleClickEdit
suppressPaste             → ColDef.suppressPaste static branch
suppressFillHandle        → ColDef.suppressFillHandle
useValueParserForImport   → ColDef.useValueParserForImport
useValueFormatterForExport→ ColDef.useValueFormatterForExport
cellRenderer              → ColDef.cellRenderer registered/provided name
cellRendererParams        → static ColDef.cellRendererParams data
```

The native editing spike demonstrates an important merge case: static configuration can contain `cellEditorParams: { min, max }`, while runtime validation adds executable `getValidationErrors`. The compiler must merge runtime-owned callback params without permitting those functions in persisted JSON.

## Formatter/parser registry keys

```text
valueFormatterKey
→ frontend formatter registry
→ real ColDef.valueFormatter

valueParserKey
→ frontend parser registry
→ real ColDef.valueParser
```

Raw AG Grid expression strings are not accepted from backend configuration. If `valueParserKey` is omitted, the compiler leaves AG Grid cell-data-type parsing intact where applicable.

## Native-first editing/runtime ownership

Merged PR #42 (`/ssrm-native-editing`) establishes the current editing reference:

```text
AG Grid
→ normal edit / Cell Selection / Ctrl+D / Ctrl+Enter / Fill Handle / clipboard
→ native editable rules
→ native editor validation
→ cellValueChanged

shared runtime
→ lightweight dirty BASE + LOCAL fields
→ selected ∩ dirty save targeting
→ acknowledgement/rebase
→ SSRM LOCAL restoration
→ Discard + authoritative refresh
```

Do not bring back custom Apply Last Edit/current-page Flow 1/Flow 2 configuration merely to reproduce interactions AG Grid already owns.

## Validation direction

Future configurable validation remains declarative rule data adapted into AG Grid's native editor lifecycle:

```text
provided editor
→ runtime cellEditorParams.getValidationErrors

custom React/MUI editor
→ useGridCellEditor
→ getValidationErrors / getValidationElement

invalidEditValueMode = "block"
→ invalid value does not commit into the BASE+LOCAL draft
```

Callbacks remain frontend code. The existing shared `GridValidationRule` / validator registry is the implementation precedent, but the persisted configurable rule/message shape still needs its own explicit design rather than being copied blindly.

## Runtime draft state is not configuration

The merged shared editing primitives retain only genuinely dirty fields as `baseValue + value`. Dirty counts, selected∩dirty calculation, acknowledgement, SSRM draft restoration and Discard refresh are runtime/shared mechanics, not backend metadata.

REMOTE/conflict reconciliation is not automatically part of configurable editing; concurrency/versioning remains a separate product decision.
