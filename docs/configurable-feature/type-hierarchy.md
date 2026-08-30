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
            │   └── native named editor/renderer + JSON-safe params
            ├── colId                  ← ColDef.colId
            ├── field                  ← ColDef.field
            ├── labelKey               → translation → ColDef.headerName
            ├── cellDataType           ← BaseCellDataType
            ├── filtering?: FieldFilteringDefinition
            │   └── filterOptions      ← ISimpleFilterModelType subset
            ├── valueFormatterKey?     → formatter registry → ColDef.valueFormatter
            ├── valueFormatterConfig?
            ├── valueParserKey?        → parser registry → ColDef.valueParser
            └── valueParserConfig?
```

There is deliberately **no** configurable `editing: { editor, parser }` wrapper. Native AG Grid properties stay flat whenever their persisted values are safely representable.

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
    FD --> FIL[FieldFilteringDefinition]
    FIL --> SFM[ISimpleFilterModelType]
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

The allowlist is capability-driven, not based only on the current Transaction demo.

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
business callbacks such as isRowSelectable
```

## Native flat-SSRM row selection

The normalized selection type is derived from `GridOptions['rowSelection']` rather than recreated locally:

```text
Extract singleRow branch
Extract multiRow branch
Pick common native declarative members
Extract checkboxes boolean branch

multiRow:
Extract groupSelects = self
Extract selectAll = all
Pick headerCheckbox / ctrlASelectsRows
```

`isRowSelectable` remains runtime business policy.

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

## Editing mapping after the native-first SSRM spike

```text
normal cell edit
Cell Selection
Ctrl/Cmd+D
Ctrl/Cmd+Enter
Fill Handle
clipboard/paste
        ↓
AG Grid applies native editable rules
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

## Registered component names vs executable registries

```text
cellEditor: "transactionAccountEditor"
cellRenderer: "statusChip"
```

These are native registered-component names. Frontend runtime owns actual implementations.

Formatter/parser are different:

```text
valueFormatterKey
→ frontend formatter registry
→ ColDef.valueFormatter

valueParserKey
→ frontend parser registry
→ ColDef.valueParser
```

Raw AG Grid expression strings are not accepted from backend configuration.

## Filtering derives native types but keeps server semantics explicit

```text
ISimpleFilterModelType
        ↓ Extract current backend-supported operators
FieldFilteringDefinition.filterOptions
        ↓
compiler → filterParams.filterOptions
```

`filtering` stays a deliberate application descriptor because it means "server-supported query capability", not only "render an AG Grid filter".

The next filter-default layer should derive safe properties from AG Grid's `ITextFilterParams`, `INumberFilterParams`, `IBigIntFilterParams`, `IDateFilterParams` and `ISimpleFilterParams` using `Pick`/`Extract`/`Omit`. Executable matcher/parser/formatter/comparator members and semantics unsupported by the backend remain excluded.

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

Exact nested merge behavior for `defaultColDef`, `cellSelection` and `rowSelection` is the next compiler/defaults design batch.

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
