# Handoff: Configurable Feature + AG Grid Architecture

> **Status:** current architecture/design handoff for configurable-feature work on `configurable-feature-grid`.
>
> Repository/source/docs are authoritative. In a new chat: inspect GitHub state, read root `AGENTS.md`, read this handoff, then read `docs/configurable-feature-config-design-progress.md` for the exact resume point.

## 1. Scope

The repository has proven Transaction Client, Infinite and SSRM grids plus the native-first SSRM editing reference route merged from PR #42.

The configurable work remains a separate SSRM-first architecture experiment. Backend metadata does not choose Client/Infinite/SSRM, and existing concrete grids should not be refactored merely to make configurable composition work.

```text
Review feature
├── "transaction" entity
├── "loan" entity
└── "finance" entity
```

Entity identity is the key in `FeatureDefinition.entities`; `EntityDefinition<TLabelKey, TFieldDefinition>` stays business-agnostic.

## 2. Mandatory normalization boundary

```text
frontend-supported configuration design
        ↓
may be persisted/managed using backend/database shape
        ↓
backend runtime JSON
        ↓
validate + normalize/adapt ALWAYS
        ↓
normalized frontend configuration
        ↓
compiler + registries + runtime policy
        ↓
AG Grid GridOptions / ColDef / callbacks / components
        ↓
concrete configurable SSRM runtime
```

Normalization remains even when backend/storage keys exactly match normalized frontend names. If backend naming changes later, map once at this boundary; compiler/grid code continues to consume the stable normalized model.

## 3. Native-first naming/type rule

```text
same AG Grid concept + same persisted value semantics
→ use AG Grid property name
→ derive/reuse AG Grid type where practical

AG Grid supports registered component by JSON-safe string name
→ keep native cellEditor / cellRenderer property
→ validate name against frontend registrations

AG Grid property expects function/expression
→ do not persist executable value
→ use explicit frontend registry key/config descriptor

application/business meaning differs
→ keep application name
```

This rule applies to the **whole configuration contract**, not only properties used by the current Transaction demo.

The normalized native surface is an explicit allowlist, not a raw `GridOptions`/`ColDef` passthrough. A native option is omitted only for a concrete reason such as executable semantics, incompatible flat-SSRM meaning, unsupported end-to-end server semantics, or a different runtime architecture.

## 4. Current normalized type structure

Source:

`frontend/src/shared/grid/configurable/configuration.types.ts`

```text
FeatureDefinition
└── entities: Record<entityKey, EntityDefinition>
    ├── labelKey
    ├── dataAdapterKey
    ├── rowId: RowIdDefinition
    ├── gridOptions?: ConfigurableSsrmGridOptions
    │   ├── defaultColDef?: ConfigurableDefaultColDef
    │   ├── pagination / SSRM loading-cache options
    │   ├── rowSelection?: ConfigurableSsrmRowSelectionOptions
    │   ├── cellSelection?: ConfigurableCellSelectionOptions
    │   ├── native editing/navigation/undo/clipboard options
    │   ├── native column-movement options
    │   ├── layout/presentation/tooltip options
    │   └── focus/accessibility options
    └── fields: FieldDefinition[]
        ├── colId
        ├── field
        ├── labelKey
        ├── cellDataType
        ├── ConfigurableNativeColDefOptions
        │   ├── sorting/layout/sizing/presentation
        │   ├── filter presentation/header controls
        │   ├── editable
        │   ├── cellEditor / cellEditorParams / popup options
        │   ├── paste/fill/import-export options
        │   └── cellRenderer / cellRendererParams
        ├── filtering?: FieldFilteringDefinition
        ├── valueFormatterKey? / valueFormatterConfig?
        └── valueParserKey? / valueParserConfig?
```

The previous custom hierarchy:

```text
editing
├── editor
└── parser

renderer
└── key
```

has been removed.

## 5. Native registered editor/renderer names

AG Grid supports provided/registered components by string name. Therefore normalized JSON can carry:

```text
cellEditor: "agNumberCellEditor"
cellEditor: "transactionAccountEditor"
cellRenderer: "statusChip"
```

Frontend runtime owns actual custom component registration. Unknown/unapproved names must fail validation rather than being silently accepted.

## 6. Executable parser/formatter keys

AG Grid `valueParser` and `valueFormatter` are executable function/expression properties. Persisting arbitrary expression strings is not allowed.

```text
valueParserKey
→ frontend registry
→ real AG Grid valueParser

valueFormatterKey
→ frontend registry
→ real AG Grid valueFormatter
```

Optional `valueParserConfig` / `valueFormatterConfig` remain JSON-safe app data interpreted by the registered implementation.

## 7. `gridOptions` and `defaultColDef`

Entity native grid overrides live under:

```text
entity.gridOptions
```

`defaultColDef` lives there because AG Grid itself defines it as a GridOptions property:

```text
application configurable-SSRM defaults
        +
entity.gridOptions
        ↓
resolved GridOptions

resolved gridOptions.defaultColDef
        +
compiled field properties
        ↓
final ColDef
```

Exact nested merge behavior is the next compiler/defaults batch.

## 8. Current reviewed native GridOptions surface

Current categories:

```text
column defaults
→ defaultColDef

pagination
→ pagination
→ paginationAutoPageSize
→ paginationPageSize
→ paginationPageSizeSelector
→ suppressPaginationPanel

SSRM loading/cache
→ cacheBlockSize
→ maxBlocksInCache
→ blockLoadDebounceMillis
→ maxConcurrentDatasourceRequests
→ serverSideInitialRowCount
→ suppressServerSideFullWidthLoadingRow

row selection
→ rowSelection

cell selection/editing
→ cellSelection
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

Continue to expand this by **capability audit** when needed; do not invent aliases for native declarative values.

### Runtime-owned even though React accepts them as props

```text
modules
rowModelType
serverSideDatasource
columnDefs
context
getRowId callback
events/callbacks
GridApi refs
business callbacks such as isRowSelectable
```

The first configurable runtime remains SSRM. `rowModelType` is architecture-owned rather than metadata-selected.

## 9. Native flat-SSRM row selection

`ConfigurableSsrmRowSelectionOptions` keeps valid native row-selection configuration while business callbacks remain runtime-owned.

```text
common
→ mode: singleRow | multiRow
→ checkboxes?: boolean
→ hideDisabledCheckboxes?
→ enableClickSelection?
→ copySelectedRows?
→ enableSelectionWithoutKeys?

multiRow
→ groupSelects?: self
→ selectAll?: all
→ headerCheckbox?
→ ctrlASelectsRows?
```

AG Grid 36.1 documents `rowSelection.selectAll='filtered'|'currentPage'` as invalid for SSRM and treats them as `'all'`. Therefore those values are not exposed as native SSRM config. The repository's All Filtered / Current Page semantics remain explicit application operations.

`isRowSelectable` remains a runtime business-policy callback.

## 10. PR #42 / native-first SSRM editing reference

PR #42 (`Spike: native-first SSRM editing`) was merged into `configurable-feature-grid` as:

```text
279fbfea85da85741b42dfa6e3cb034b36a92c51
```

Reference route:

```text
/ssrm-native-editing
```

Existing `/ssrm` remains intentionally different. Use the spike to understand ownership; do not copy the whole Transaction component into configurable code.

### AG Grid owns

```text
normal cell editing
Cell Selection
Ctrl/Cmd+D Copy Range Down
Ctrl/Cmd+Enter selected-range edit
Fill Handle
clipboard/paste behavior
native editable filtering
editor commit/validation lifecycle
```

### Shared/runtime infrastructure owns

```text
BASE + LOCAL only for genuinely dirty fields
first BASE capture
LOCAL restore after SSRM RowNode/store recreation
revert-to-BASE cleanup
dirty row/cell counts
selected rows ∩ dirty rows
safe save acknowledgement/rebase
Discard draft cleanup + authoritative refresh
```

### Feature/business layer owns

```text
which fields are editable
row/cell editable business policy
validation rule selection/messages
persistence mapping/endpoints
row and selected Save/Discard presentation
backend authority
```

## 11. Configurable editing consequences

Do **not** introduce configurable copies of interactions AG Grid already owns:

```text
Apply Last Edit
old current-page Flow 1 / Flow 2
custom range-edit filtering
custom Fill Handle replacement
```

Configure native capability instead:

```text
gridOptions.cellSelection
field.editable
field.suppressPaste
field.suppressFillHandle
field.useValueParserForImport
field.useValueFormatterForExport
```

Native Fill Handle/paste already skip non-editable cells. Application row/access policy should be composed into AG Grid `editable` at compile/runtime time.

## 12. Validation direction after PR #42

The old stable validation store remains part of the existing concrete tracked-editing implementation, but it is **not automatically the configurable editing architecture**.

```text
provided AG Grid editor
→ runtime cellEditorParams.getValidationErrors

custom React/MUI editor
→ useGridCellEditor
→ getValidationErrors / getValidationElement

gridOptions.invalidEditValueMode = "block"
→ invalid editor value stays in editor
→ no dirty draft until a valid commit occurs
```

Future configurable validation should describe declarative rule data. Compiler/editor code adapts those rules into native callbacks; callbacks never come from backend JSON.

## 13. Lightweight draft state is runtime, not config

Candidate shared files merged by PR #42:

```text
frontend/src/shared/grid/editing/gridDraftEditing.ts
frontend/src/shared/grid/editing/useGridDraftEditing.ts
```

State is deliberately finite:

```text
rowId
└── dirty field
    ├── baseValue
    └── value
```

Do not add complete API-response/block snapshots or a React Query row/original-value cache merely for draft persistence.

The spike deliberately omits the previous REMOTE/conflict layer. Concurrency/version/conflict UX remains a separate later decision.

## 14. Deliberately unsupported native examples

### `readOnlyEdit`

`readOnlyEdit=true` changes normal mutation/`cellValueChanged` into application-owned `cellEditRequest`. That is a different runtime architecture, so it is not exposed yet.

### Grouping/tree/pivot

The current configurable proof uses the repository's flat SSRM backend request contract. Grouping, tree data, aggregation and pivot options remain out until their server semantics are implemented end to end.

These are justified exclusions. "Transactions does not currently use it" is not enough by itself to exclude a native declarative option.

## 15. Filtering

`filtering` remains custom because its persisted meaning includes server-query support:

```text
field.filtering
→ appropriate native filter
→ filtering.filterOptions → filterParams.filterOptions
```

Native filter presentation properties such as `floatingFilter` remain native ColDef options. Runtime validation must reject contradictory combinations if filter presentation is configured without a supported server filtering capability.

## 16. `cellDataType`

Normalized AG Grid built-ins:

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

SSRM requires explicit cell data types. Data adapters must materialise the JavaScript representation AG Grid expects; raw JSON cannot directly transport bigint.

## 17. Stable identity

```text
field.colId
→ ColDef.colId
→ stable Grid State/API/logical column identity

field.field
→ ColDef.field
→ current row/API value path
```

They may differ.

## 18. Data adapters / backend authority

`dataAdapterKey` resolves the frontend loading/saving/request-response/normalization boundary.

SSRM block loading remains datasource-owned; do not force TanStack Query into datasource loading.

Backend remains authoritative for security/access, persistence validation, server-query semantics and writes.

## 19. Documentation / continuation

Public config changes require useful source JSDoc, curated docs and regenerated TypeDoc Markdown.

```bash
npm run docs:configurable
```

Current branch:

```text
configurable-feature-grid
```

Do not create another branch or merge another PR without explicit instruction.

Read `docs/configurable-feature-config-design-progress.md` for the exact next batch.
