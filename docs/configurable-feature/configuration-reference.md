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

Also avoid using a broad negative type such as `Omit<ColDef, UnsafeKeys>` for persisted configuration. AG Grid can add new members in a future release; a broad `Omit` could silently make them configurable. An explicit reviewed `Pick` makes every newly-supported capability opt-in.

The repository already uses this pattern in `serverFilterParams.ts`, e.g. `Pick<ITextFilterParams, 'buttons' | 'maxNumConditions' | 'closeOnApply'>`.

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
field.editable
field.cellEditor
field.cellEditorParams
field.cellRenderer
field.suppressPaste
```

### Native registered component names

AG Grid supports provided/registered editors and renderers by string name, so normalized config can safely carry:

```ts
cellEditor: "agNumberCellEditor"
cellEditor: "transactionAccountEditor"
cellRenderer: "statusChip"
```

The frontend runtime owns the actual component implementations and validates/allowlists configured names.

### Executable behavior selected by configuration

Functions/AG Grid expression strings are not accepted from backend configuration.

```text
valueFormatterKey → frontend registry → ColDef.valueFormatter
valueParserKey    → frontend registry → ColDef.valueParser
```

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

The native column surface is also `Pick`-derived:

```ts
type ConfigurableNativeColDefBase =
  Pick<ColDef, ConfigurableNativeColDefKey>;
```

Current direct-native groups include:

```text
sorting
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

Mixed callback-capable native members are narrowed separately:

```ts
editable?: Extract<NonNullable<ColDef['editable']>, boolean>;
suppressNavigable?: Extract<NonNullable<ColDef['suppressNavigable']>, boolean>;
suppressPaste?: Extract<NonNullable<ColDef['suppressPaste']>, boolean>;
```

Then native registered components/static params are supplied as the safe persisted representation:

```ts
cellEditor?: TCellEditorName;
cellEditorParams?: ConfigurationJsonObject;
cellRenderer?: TCellRendererName;
cellRendererParams?: ConfigurationJsonObject;
```

This is intentionally not an unrestricted `ColDef` passthrough.

## `ConfigurableDefaultColDef`

```ts
export type ConfigurableDefaultColDef =
  ConfigurableNativeColDefOptions<string, string>;
```

It uses the same reviewed native declarative surface as individual fields.

## `FieldCellDataType`

The normalized type now directly uses AG Grid's exported predefined union:

```ts
export type FieldCellDataType = BaseCellDataType;
```

This is preferable to extracting literals from `ColDef['cellDataType']`: that property is deliberately broad because AG Grid supports inference and custom data-type names.

Current AG Grid predefined values are therefore source-derived:

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

## Filtering

The application descriptor remains:

```ts
interface FieldFilteringDefinition<
  TFilterOption extends ISimpleFilterModelType = FilterOption,
> {
  filterOptions: readonly [TFilterOption, ...TFilterOption[]];
}
```

The option keys themselves now derive from AG Grid's exported `ISimpleFilterModelType` with `Extract`; we no longer maintain unrelated raw string unions.

Current end-to-end server subsets:

```text
text
→ contains, equals, notEqual, startsWith, endsWith

number / bigint
→ equals, notEqual, greaterThan, greaterThanOrEqual, lessThan, lessThanOrEqual

date/dateString/dateTime/dateTimeString
→ equals, notEqual, lessThan, greaterThan

boolean
→ equals, notEqual
```

`filtering` remains application-specific because its persisted meaning is **which native filter operations the data adapter/backend can execute**, not merely which filter UI is shown.

The next filter-default batch should derive JSON-safe parameter surfaces from AG Grid's exported types:

```text
ITextFilterParams
INumberFilterParams
IBigIntFilterParams
IDateFilterParams
ISimpleFilterParams
```

Use utility types to keep safe native members and remove callbacks/custom predicates/unsupported end-to-end behavior. Existing `serverFilterParams.ts` is the precedent.

## Cell Selection

Cell Selection is not a locally reconstructed range/fill hierarchy anymore. It derives from:

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

The contract `Extract`s native `singleRow` and `multiRow` branches, `Pick`s common safe declarative members, narrows callback-capable `checkboxes` to boolean, and narrows flat SSRM values:

```text
groupSelects → self
selectAll     → all
```

`isRowSelectable` stays runtime-owned business policy.

AG Grid 36.1 treats `selectAll='filtered'|'currentPage'` as invalid for SSRM; therefore those values are not represented as native configurable SSRM selection. The repository's All Filtered / Current Page operations remain explicit application semantics.

## `FieldDefinition`

The public shape is now a type intersection rather than a manually mirrored interface:

```ts
export type FieldDefinition<...> =
  ConfigurableNativeColDefOptions<TCellEditorName, TCellRendererName> & {
    colId: TColId;
    field: TFieldPath;
    labelKey: TLabelKey;
    cellDataType: TCellDataType;

    filtering?: FieldFilteringDefinition<...>;

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

They may differ. This is a case where using indexed access such as `NonNullable<ColDef['colId']>` for the generic constraint is concise and precise.

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

Runtime functions such as editor validation callbacks are merged later and never accepted from backend JSON.

## Formatter/parser registry keys

```text
valueFormatterKey
→ frontend formatter registry
→ real ColDef.valueFormatter

valueParserKey
→ frontend parser registry
→ real ColDef.valueParser
```

If `valueParserKey` is omitted, the compiler leaves AG Grid cell-data-type parsing intact where applicable.

## Native-first editing/runtime ownership

Merged PR #42 (`/ssrm-native-editing`) establishes the current editing reference:

```text
AG Grid
→ normal edit / Cell Selection / Ctrl+D / Ctrl+Enter / Fill Handle / clipboard
→ native editable rules
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

Future configurable validation is declarative data adapted into AG Grid's native editor lifecycle:

```text
provided editor
→ runtime cellEditorParams.getValidationErrors

custom React/MUI editor
→ useGridCellEditor
→ getValidationErrors / getValidationElement

invalidEditValueMode = "block"
→ invalid value does not commit into the BASE+LOCAL draft
```

Callbacks remain frontend code.

## Runtime draft state is not configuration

The merged shared editing primitives retain only genuinely dirty fields as `baseValue + value`. Dirty counts, selected∩dirty calculation, acknowledgement, SSRM draft restoration and Discard refresh are runtime/shared mechanics, not backend metadata.

REMOTE/conflict reconciliation is not automatically part of configurable editing; concurrency/versioning remains a separate product decision.
