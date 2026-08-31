# Configurable Feature Type Hierarchy and AG Grid Mapping

Quick architecture/type map for `frontend/src/shared/grid/configurable/configuration.types.ts`.

The text hierarchy is the portable source of truth for this visual document. Mermaid remains supplemental because not every viewer renders it.

## Current hierarchy

```text
FeatureDefinition
├── featureKey
└── entities: Record<entityKey, EntityDefinition>
    │
    │  entityKey = business/config identity
    │  e.g. "transaction", "loan", "finance"
    │
    └── EntityDefinition
        ├── labelKey
        ├── dataAdapterKey
        ├── rowId: RowIdDefinition
        │   └── path
        ├── gridOptions?: ConfigurableSsrmGridOptions
        │   ├── Pick<GridOptions, reviewed native keys>
        │   ├── defaultColDef?: ConfigurableDefaultColDef
        │   │   └── ConfigurableNativeColDefOptions
        │   ├── rowSelection?: derived native flat-SSRM selection
        │   └── cellSelection?: derived native range/fill selection
        └── fields: FieldDefinition[]
            ├── ConfigurableNativeColDefOptions
            │   ├── Pick<ColDef, reviewed native keys>
            │   ├── Extract safe boolean branches from callback unions
            │   ├── filter + typed filterParams
            │   └── native named editor/renderer + JSON-safe params
            ├── colId                  ← ColDef.colId
            ├── field                  ← ColDef.field
            ├── labelKey               → translation → ColDef.headerName
            ├── cellDataType           ← BaseCellDataType
            ├── validationRules?       → validator registry → native editor validation
            ├── valueFormatterKey?     → formatter registry → ColDef.valueFormatter
            ├── valueFormatterConfig?
            ├── valueParserKey?        → parser registry → ColDef.valueParser
            └── valueParserConfig?
```

There is deliberately no configurable `editing: { editor, parser }`, `renderer: { key }`, or `filtering: { ... }` wrapper. Native AG Grid properties stay flat whenever their persisted values are safely representable.

## What the generics do — and do not do

```text
FeatureDefinition.entities record key
→ entity business/config identity
→ "transaction" / "loan" / "finance"

EntityDefinition<TLabelKey, TFieldDefinition>
→ only narrows allowed label keys and field shape
→ remains reusable and business-agnostic
```

## Supplemental Mermaid relationship view

```mermaid
flowchart TD
    F[FeatureDefinition] -->|entities record key = entity identity| E[EntityDefinition]
    E --> R[RowIdDefinition]
    E --> GO[ConfigurableSsrmGridOptions]
    GO --> GP[Pick from GridOptions]
    GO --> D[ConfigurableDefaultColDef]
    GO --> RS[Derived rowSelection]
    GO --> CS[Derived cellSelection]
    E --> FD[FieldDefinition array]
    FD --> N[ConfigurableNativeColDefOptions]
    N --> CP[Pick from ColDef]
    N --> FIL[filter + typed filterParams]
    FIL --> FP[AG Grid filter param types]
    FD --> VAL[validationRules]
    VAL --> VR[validator registry]
    FD --> FMT[valueFormatterKey]
    FD --> PAR[valueParserKey]
    FMT --> FR[formatter registry]
    PAR --> PR[parser registry]
    FR --> VF[AG Grid valueFormatter]
    PR --> VP[AG Grid valueParser]
    FD --> CD[compiled AG Grid ColDef]
    GO --> GRID[resolved AG Grid GridOptions / React props]
```

## Mandatory normalization boundary

```text
backend/database representation
        ↓
validate + normalize/adapt ALWAYS
        ↓
normalized frontend configuration
        ↓
compiler + registries + runtime policy
        ↓
final AG Grid GridOptions / ColDef / callbacks / components
```

Normalization remains even when backend/storage names currently equal normalized frontend names. Compile-time AG Grid type derivation does not make backend JSON trusted.

## Native naming + type derivation rule

```text
same AG Grid concept + same persisted value semantics
→ use AG Grid property name

precise AG Grid public type exists
→ use directly
→ BaseCellDataType / ISimpleFilterModelType

reviewed group of native members
→ Pick<ColDef | GridOptions, ReviewedKeys>

native member has declarative + executable branches
→ Extract the safe branch

nested native object has one executable member
→ derive the native object
→ Omit only that executable member
```

Do not hand-copy a long list as individual `ColDef['key']` / `GridOptions['key']` declarations when `Pick` expresses the relationship. Also do not use a broad negative `Omit` for the whole persisted surface: explicit `Pick` means a future AG Grid upgrade cannot silently expose newly-added runtime/callback properties.

## Grid options: configurable vs runtime-owned

Examples of current native configurable grid properties:

```text
defaultColDef
pagination / paginationAutoPageSize / paginationPageSize
cacheBlockSize / maxBlocksInCache / serverSideInitialRowCount
rowSelection
cellSelection
invalidEditValueMode
singleClickEdit / suppressClickEdit
enterNavigatesVertically / enterNavigatesVerticallyAfterEdit
undoRedoCellEditing
suppressClipboardPaste
suppressMovableColumns / suppressMoveWhenColumnDragging
rowHeight / rowBuffer / headerHeight / animateRows
tooltipShowDelay / tooltipHideDelay / tooltipInteraction
suppressCellFocus / suppressHeaderFocus / ensureDomOrder
```

Runtime/bundle infrastructure remains frontend-owned even though `AgGridReact` accepts it as props:

```text
modules
rowModelType
serverSideDatasource
columnDefs
context
getRowId callback
event callbacks
GridApi refs
business callbacks such as isRowSelectable/getRowClass
```

## Native flat-SSRM row selection

The normalized selection type is derived from `GridOptions['rowSelection']` rather than recreated locally:

```text
Extract singleRow branch
Extract multiRow branch
Pick common native declarative members
Extract checkboxes boolean branch

multiRow:
Pick headerCheckbox / ctrlASelectsRows
Extract selectAll = all
```

`isRowSelectable` remains runtime business policy.

`groupSelects` is intentionally absent from the current configurable contract because the target runtime is flat SSRM. It should return with actual server-side grouping support rather than being exposed only to carry the default `'self'` value.

AG Grid treats `rowSelection.selectAll='filtered'|'currentPage'` as invalid for SSRM, so those are not accepted as native config. The repository's All Filtered / Current Page operations remain application-owned semantics.

## Cell Selection / range-fill types

Cell Selection is derived from `GridOptions['cellSelection']`:

```text
Pick native declarative top-level members
        ↓
Extract native range handle
Extract native fill handle
        ↓
Omit fill.setFillValue only
```

`setFillValue` is executable frontend behavior. The native range/fill shape, mode, direction and other declarative handle members stay AG Grid-owned.

## Native server-backed filtering

```text
field.filter
→ native AG Grid filter name / boolean

field.filterParams
→ ConfigurableFilterParamsForCellDataType
→ AG Grid ITextFilterParams / INumberFilterParams /
   IBigIntFilterParams / IDateFilterParams-derived safe members
```

Operator keys come from `ISimpleFilterModelType` and are narrowed to the active server-adapter contract.

Current common contract:

```text
Text       → contains / equals / notEqual / startsWith / endsWith
Number     → equals / notEqual / greaterThan / greaterThanOrEqual / lessThan / lessThanOrEqual
BigInt     → same operator vocabulary as Number
Date/time  → equals / notEqual / lessThan / greaterThan
Boolean    → equals / notEqual
```

Common filter behavior stays native:

```text
buttons
closeOnApply
debounceMs
readOnly
filterPlaceholder string
maxNumConditions = 1
```

Type-specific UI-safe native members are derived from AG Grid types. Executable callbacks and server-semantic toggles that the current filter model/backend does not represent remain excluded.

There is no parallel `FieldFilteringDefinition` anymore.

## Editing mapping after the native-first SSRM spike

```text
normal cell edit
Cell Selection
Ctrl/Cmd+D
Ctrl/Cmd+Enter
Fill Handle
clipboard/paste
        ↓
AG Grid applies native editable + editor validation rules
        ↓
cellValueChanged
        ↓
shared BASE + LOCAL draft observer
```

The configurable contract therefore describes native behavior:

```text
field.editable                  → composed ColDef.editable
field.cellEditor                → ColDef.cellEditor
field.cellEditorParams          → ColDef.cellEditorParams
field.cellEditorPopup           → ColDef.cellEditorPopup
field.cellEditorPopupPosition   → ColDef.cellEditorPopupPosition
field.singleClickEdit           → ColDef.singleClickEdit
field.suppressPaste             → ColDef.suppressPaste
field.suppressFillHandle        → ColDef.suppressFillHandle
field.useValueParserForImport   → ColDef.useValueParserForImport
field.useValueFormatterForExport→ ColDef.useValueFormatterForExport

gridOptions.cellSelection      → GridOptions.cellSelection
gridOptions.invalidEditValueMode
                                → GridOptions.invalidEditValueMode
gridOptions.suppressClipboardPaste
                                → GridOptions.suppressClipboardPaste
```

## Validation mapping

```text
field.validationRules
→ ConfigurableValidationRule
→ proven GridValidationRule shape with JSON-safe params
→ frontend validator registry
→ validation messages
```

Then runtime adapts those messages into AG Grid's native validation lifecycle:

```text
provided editor
→ cellEditorParams.getValidationErrors

custom React/MUI editor
→ useGridCellEditor
→ getValidationErrors / getValidationElement
```

`invalidEditValueMode='block'` means invalid editor values never become committed BASE+LOCAL drafts.

## Registered component names vs executable registries

```text
filter: "agTextColumnFilter"
cellEditor: "transactionAccountEditor"
cellRenderer: "statusChip"
```

These are native registered-component names. Frontend runtime owns actual implementations.

Formatter/parser are different because native string values there are executable AG Grid expressions:

```text
valueFormatterKey
→ frontend formatter registry
→ ColDef.valueFormatter

valueParserKey
→ frontend parser registry
→ ColDef.valueParser
```

`RegisteredValueFormatter` and `RegisteredValueParser` derive the real AG Grid function branches for registry implementation typing.

## Grid-level merge structure

```text
application configurable-SSRM defaults
        +
entity.gridOptions overrides
        ↓
resolved GridOptions

resolved GridOptions.defaultColDef
        +
individual FieldDefinition native properties
        ↓
final ColDef
```

Exact nested merge behavior for `defaultColDef`, `cellSelection`, `rowSelection`, static editor params and runtime validation params belongs to the compiler/defaults implementation batch.

## Runtime editing state is not configuration

```text
rowId
└── dirty field
    ├── baseValue
    └── value
```

The merged spike's BASE+LOCAL state is runtime/shared infrastructure. Dirty counts, selected∩dirty calculation, Save acknowledgement, SSRM draft restoration and Discard refresh behavior are not persisted metadata.

## Generated API docs

TypeDoc + `typedoc-plugin-markdown` are configured through root `typedoc.json` and:

```bash
npm run docs:configurable
```

Whenever `configuration.types.ts` or its JSDoc changes, regenerate `docs/configurable-feature/generated/` before treating generated API pages as current.
