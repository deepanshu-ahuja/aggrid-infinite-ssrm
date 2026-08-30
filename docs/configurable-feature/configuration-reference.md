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

Normalization remains mandatory even when backend/storage property names happen to match normalized frontend names exactly. Matching names only make a mapping identity-like; they do not make backend JSON trusted configuration.

A backend property that the deployed frontend does not validate/normalize/compile has no effect. Unknown required registered component names, unknown executable registry keys and invalid supported values must fail clearly.

## AG Grid naming/type rule

Use the AG Grid name and compatible AG Grid type when **both the concept and persisted value semantics are the same**.

```text
same concept + same value semantics
→ AG Grid property name
→ derive/reuse AG Grid type where practical

AG Grid supports safe component-name registration
→ keep native cellEditor / cellRenderer property
→ validate name against frontend registrations

AG Grid expects executable function/expression semantics
→ do not persist raw executable value
→ explicit frontend registry key/config descriptor

application/business concept
→ application name
```

This distinction removed the previous custom `editing: { editor, parser }` and `renderer: { key }` wrappers.

## Three categories of configuration

### 1. Native + declarative + JSON-safe AG Grid values

Supported native values keep AG Grid names/types and can be merged into the final grid configuration after validation/normalization.

Examples:

```text
gridOptions.pagination
gridOptions.cellSelection
gridOptions.invalidEditValueMode
gridOptions.defaultColDef
field.editable
field.cellEditor
field.cellEditorParams
field.cellRenderer
field.suppressPaste
```

### 2. Executable behavior selected by configuration

Functions/expressions cannot be stored safely as runtime JSON. Persist an explicit key plus optional JSON-safe app config:

```text
valueFormatterKey → frontend registry → ColDef.valueFormatter
valueParserKey    → frontend registry → ColDef.valueParser
```

Raw AG Grid expression strings are not accepted from backend configuration.

### 3. Runtime/compiler-owned infrastructure

The frontend runtime constructs values such as:

```text
modules
serverSideDatasource
context
compiled columnDefs
getRowId callback
GridApi refs
event/lifecycle handlers
native validation callbacks
```

Those values may be passed as React/AG Grid props at runtime, but they are not arbitrary persisted configuration.

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

The business identity is the key of `entities`:

```text
review
├── transaction → EntityDefinition
└── loan        → EntityDefinition
```

`EntityDefinition` itself stays reusable and business-agnostic.

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

### `labelKey`

Application translation key. It is not AG Grid `headerName`, because the stored value still needs translation.

### `dataAdapterKey`

Frontend application key resolving loading/saving/request-response mapping and transport normalization. It is not an AG Grid datasource object.

### `rowId`

Declarative path used by runtime code to build native executable `getRowId` behavior.

### `gridOptions`

Bounded native GridOptions-shaped configuration for the SSRM root.

`defaultColDef` now lives inside `gridOptions` because that is where AG Grid defines it:

```text
application configurable-SSRM defaults
        +
entity.gridOptions
        ↓
resolved GridOptions
        ↓
AgGridReact
```

Then normal column precedence applies:

```text
resolved gridOptions.defaultColDef
        +
compiled FieldDefinition
        ↓
final ColDef
```

## `ConfigurableSsrmGridOptions`

Current reviewed native surface:

```ts
interface ConfigurableSsrmGridOptions {
  defaultColDef?: ConfigurableDefaultColDef;

  pagination?: ...;
  paginationPageSize?: ...;
  paginationPageSizeSelector?: ...;

  cacheBlockSize?: ...;
  maxBlocksInCache?: ...;
  blockLoadDebounceMillis?: ...;
  maxConcurrentDatasourceRequests?: ...;

  cellSelection?: boolean | ConfigurableCellSelectionOptions;
  invalidEditValueMode?: ...;
  singleClickEdit?: ...;
  suppressClickEdit?: ...;
  stopEditingWhenCellsLoseFocus?: ...;
  undoRedoCellEditing?: ...;
  undoRedoCellEditingLimit?: ...;
  suppressClipboardPaste?: ...;

  rowHeight?: ...;
  headerHeight?: ...;
  animateRows?: ...;
}
```

The pagination/cache properties are the same native properties already used by the repository's server-backed grid defaults.

The editing-related properties were added after the merged native-first SSRM editing spike proved that these interactions should stay owned by AG Grid rather than being recreated in application controls.

### Not persisted despite being React grid props

```text
modules
rowModelType
serverSideDatasource
columnDefs
context
getRowId callback
row/cell callbacks/events
GridApi
```

`rowModelType` remains an application architecture decision. The first configurable proof is SSRM; backend metadata does not choose another row model.

`CellSelectionModule` / `ClipboardModule` are bundle/runtime capabilities. If normalized config enables features that require them, the runtime must provide those modules; the backend does not send module objects.

### Deliberately not exposed yet: `readOnlyEdit`

The merged spike's draft adapter observes normal AG Grid mutations through `cellValueChanged`. Native `readOnlyEdit=true` changes that lifecycle to `cellEditRequest` and therefore represents a different runtime architecture. Do not expose it until the configurable runtime intentionally supports that lifecycle.

## `ConfigurableCellSelectionOptions`

```ts
interface ConfigurableCellSelectionOptions {
  suppressMultiRanges?: boolean;
  enableHeaderHighlight?: boolean;
  enableColumnSelection?: boolean;
  handle?:
    | { mode: "range" }
    | {
        mode: "fill";
        direction?: "x" | "y" | "xy";
        suppressClearOnFillReduction?: boolean;
      };
}
```

The callback-based Fill Handle `setFillValue` option is intentionally absent because it is executable behavior.

Native Cell Selection is the surface behind spreadsheet-like operations such as Cell Selection, Ctrl/Cmd+D, Ctrl/Cmd+Enter and Fill Handle editing. The configurable model should configure this native capability, not create separate application implementations of those commands.

## `ConfigurableNativeColDefOptions`

This is the shared JSON-safe native column surface used by fields and by `defaultColDef`.

Current categories include:

```text
sorting
→ sortable
→ initialSort
→ initialSortIndex
→ sortingOrder

layout/sizing
→ initialHide
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

text/header presentation
→ wrapText
→ autoHeight
→ wrapHeaderText
→ autoHeaderHeight
→ headerTooltip
→ tooltipField

editing
→ editable (boolean persisted branch only)
→ cellEditor
→ cellEditorParams
→ cellEditorPopup
→ cellEditorPopupPosition
→ singleClickEdit
→ useValueParserForImport
→ suppressPaste (boolean persisted branch only)
→ suppressFillHandle

rendering
→ cellRenderer
→ cellRendererParams
```

When an AG Grid property supports both a declarative and callback branch, only the safe declarative branch is exposed unless a separate frontend registry design is intentionally added.

## `ConfigurableDefaultColDef`

`ConfigurableDefaultColDef` reuses the same reviewed native column surface.

It does not mean arbitrary `ColDef` values can be persisted. Callback/component implementations remain frontend-owned.

## `RowIdDefinition`

```ts
interface RowIdDefinition {
  path: string;
}
```

`path` supports dot notation and has no implicit `id` fallback. It stays custom because persisted JSON can carry a path, not the executable AG Grid `getRowId` callback.

## `FieldDefinition`

Conceptual shape:

```ts
interface FieldDefinition<...> extends ConfigurableNativeColDefOptions<...> {
  colId: ...;
  field: string;
  labelKey: string;
  cellDataType: FieldCellDataType;

  filtering?: FieldFilteringDefinition<...>;

  valueFormatterKey?: string;
  valueFormatterConfig?: ConfigurationJsonObject;
  valueParserKey?: string;
  valueParserConfig?: ConfigurationJsonObject;
}
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

They may differ. Requiring explicit `colId` prevents a backend field-path rename from silently changing saved column identity.

### `cellDataType`

Supported AG Grid built-ins:

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

The configurable proof is SSRM, so the compiler sets this explicitly. `bigint` requires adapter conversion to JavaScript bigint; `object` commonly requires formatter/parser behavior that understands the object shape.

## Filtering

`filtering` remains intentionally application-specific:

```ts
interface FieldFilteringDefinition<TFilterOption extends string = FilterOption> {
  filterOptions: readonly [TFilterOption, ...TFilterOption[]];
}
```

Its persisted meaning is **server-supported query semantics**, not merely an AG Grid filter component choice.

Compiler meaning:

```text
field.filtering
→ choose/enable appropriate AG Grid filter
→ field.filtering.filterOptions → filterParams.filterOptions
```

Do not expose an operator merely because AG Grid can render it; the active data adapter/backend contract must support the same semantics.

## Native editor configuration

There is no longer an `editing.editor` wrapper.

```text
editable                  → ColDef.editable after runtime policy composition
cellEditor                → ColDef.cellEditor
cellEditorParams          → ColDef.cellEditorParams
cellEditorPopup           → ColDef.cellEditorPopup
cellEditorPopupPosition   → ColDef.cellEditorPopupPosition
singleClickEdit           → ColDef.singleClickEdit
suppressPaste             → ColDef.suppressPaste
suppressFillHandle        → ColDef.suppressFillHandle
useValueParserForImport   → ColDef.useValueParserForImport
```

`cellEditor` may be an AG Grid provided editor name such as `agNumberCellEditor` or a frontend-registered custom editor name. The normalizer/runtime must validate allowed custom names.

Static `cellEditorParams` are JSON-safe configuration. Runtime functions such as `getValidationErrors` are merged by the compiler/editor integration and are never accepted from backend JSON.

## Native renderer configuration

There is no longer a custom `renderer: { key }` wrapper.

```text
cellRenderer       → AG Grid provided/registered renderer name
cellRendererParams → static JSON-safe params
```

Frontend runtime owns the actual registered React/component implementation.

## Formatter/parser executable keys

AG Grid formatter/parser values are executable functions or expression strings rather than component-name references, so the normalized persisted contract deliberately does not expose raw `valueFormatter` / `valueParser` values.

```text
valueFormatterKey
→ frontend formatter registry
→ real ColDef.valueFormatter

valueParserKey
→ frontend parser registry
→ real ColDef.valueParser
```

`valueFormatterConfig` and `valueParserConfig` are optional extra application data interpreted by the registered implementation.

If `valueParserKey` is omitted, the compiler leaves AG Grid cell-data-type parser behavior intact where applicable.

## Native-first editing runtime learned from the merged spike

The merged `/ssrm-native-editing` route is an architecture reference, not the configurable component itself.

Its ownership model is:

```text
AG Grid native editing interactions
→ normal edit / Cell Selection / Ctrl+D / Ctrl+Enter / Fill Handle / clipboard
→ native editable rules
→ cellValueChanged
→ shared BASE + LOCAL dirty-field observer
```

The configurable contract controls relevant native options. The BASE+LOCAL state and persistence lifecycle are runtime/shared infrastructure, not metadata.

Do not bring back the previous Apply Last Edit/current-page Flow 1/Flow 2 configuration. The spike removed those because native AG Grid interactions cover the required spreadsheet-style propagation.

## Validation direction

Future configurable validation declarations should remain data, such as registered validation rule keys + JSON-safe params/messages.

Runtime adaptation differs by editor type:

```text
provided editor
→ compiler merges getValidationErrors into runtime cellEditorParams

custom React/MUI editor
→ component uses useGridCellEditor
→ getValidationErrors / getValidationElement
```

`gridOptions.invalidEditValueMode="block"` can then let AG Grid keep invalid input in the editor instead of committing it into the draft layer.

Do not serialize those validation callbacks into config.

## Runtime draft state is not configuration

The merged spike's generic runtime keeps only:

```text
rowId + dirty field
→ baseValue
→ current LOCAL value
```

It does not copy complete API responses/SSRM blocks into React state and does not add a React Query row cache.

The following stay shared/runtime mechanics:

```text
first BASE capture
revert-to-BASE cleanup
dirty row/cell counts
selected ∩ dirty payload
save acknowledgement/rebase
SSRM LOCAL restore
Discard → remove draft + refresh authoritative data
```

REMOTE/conflict reconciliation is not automatically part of configurable editing; concurrency/version/conflict behavior remains a separate later decision.
