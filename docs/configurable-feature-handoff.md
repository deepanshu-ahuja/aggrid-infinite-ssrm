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

TypeScript derivation from AG Grid does **not** replace runtime validation. Imported AG Grid types protect our source at compile time; backend JSON remains untrusted runtime data and still crosses the normalizer.

## 3. Native-first naming and type-derivation rule

```text
same AG Grid concept + same persisted value semantics
→ use AG Grid property name
→ derive/reuse AG Grid type

precise AG Grid exported type exists
→ use it directly
→ example: BaseCellDataType, ISimpleFilterModelType

reviewed group of native properties
→ Pick<AGGridType, ReviewedKeys>

native property mixes safe data + callback/function branch
→ Extract/Omit the safe branch
→ replace only the executable member when necessary

single indexed access is genuinely the clearest exact type
→ Type['key'] is fine
→ example: stable colId generic
```

Do **not** manually mirror dozens of properties as `foo?: ColDef['foo']` / `bar?: GridOptions['bar']` when `Pick` expresses the supported surface. Also do **not** use a broad `Omit<ColDef, UnsafeKeys>` or `Omit<GridOptions, UnsafeKeys>` as the persisted contract: a future AG Grid upgrade could then silently expose a newly-added callback/runtime property. The safe pattern is an explicit reviewed `Pick` allowlist plus narrow replacements.

This rule applies to the **whole configuration contract**, not only properties used by the current Transaction demo.

The repository already follows this style in `serverFilterParams.ts`, where shared behavior is typed from AG Grid filter-param interfaces with `Pick<ITextFilterParams, ...>`.

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
    │   ├── Pick<GridOptions, reviewed native keys>
    │   ├── defaultColDef?: ConfigurableDefaultColDef
    │   ├── rowSelection?: ConfigurableSsrmRowSelectionOptions
    │   └── cellSelection?: boolean | ConfigurableCellSelectionOptions
    └── fields: FieldDefinition[]
        ├── ConfigurableNativeColDefOptions
        │   ├── Pick<ColDef, reviewed native keys>
        │   ├── narrowed boolean branches for mixed callback properties
        │   └── native named cellEditor/cellRenderer + JSON-safe params
        ├── colId
        ├── field
        ├── labelKey
        ├── cellDataType: BaseCellDataType
        ├── filtering?: FieldFilteringDefinition
        ├── valueFormatterKey? / valueFormatterConfig?
        └── valueParserKey? / valueParserConfig?
```

The previous custom hierarchy `editing → editor/parser` and `renderer → key` has been removed.

## 5. Native registered editor/renderer names

AG Grid supports provided/registered components by string name. Therefore normalized JSON can carry:

```text
cellEditor: "agNumberCellEditor"
cellEditor: "transactionAccountEditor"
cellRenderer: "statusChip"
```

Frontend runtime owns actual custom component registration. Unknown/unapproved names must fail validation rather than being silently accepted.

`cellEditorParams` / `cellRendererParams` are restricted to JSON-safe static config. Runtime/compiler code may merge executable additions such as validation callbacks later.

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

## 7. Grid options / defaultColDef derivation

Entity native grid overrides live under `entity.gridOptions` because the nested names are actual `GridOptions` concepts.

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

`ConfigurableSsrmGridOptions` is derived from a reviewed `Pick<GridOptions, ...>` and then replaces only nested/mixed properties such as `defaultColDef`, `rowSelection` and `cellSelection` with their bounded derived forms.

`ConfigurableNativeColDefOptions` follows the same pattern with `Pick<ColDef, ...>` plus narrow safe replacements for mixed/executable values.

## 8. Cell data types and filtering derive from AG Grid

`FieldCellDataType` is now exactly AG Grid's exported `BaseCellDataType`. Do not reconstruct that union from `ColDef['cellDataType']`, because `ColDef.cellDataType` is deliberately broader to support inference/custom data-type names.

Current AG Grid built-ins therefore come directly from the library:

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

Simple-filter operator keys derive from AG Grid's exported `ISimpleFilterModelType`, then are narrowed to the subset supported by our current backend/query mapper. `filtering` remains application-specific because its persisted meaning is **server-supported query semantics**, not merely which filter UI AG Grid can render.

Next filter-default work should similarly derive from AG Grid's exported filter-param interfaces (`ITextFilterParams`, `INumberFilterParams`, `IBigIntFilterParams`, `IDateFilterParams`) using `Pick`/`Omit`/narrowed replacements rather than inventing parallel filter-param types.

## 9. Native Cell Selection / row selection derivation

Cell Selection is derived from `GridOptions['cellSelection']`:

```text
native cellSelection object
→ Pick native declarative top-level members
→ derive native range/fill handle union
→ Omit only executable Fill Handle setFillValue
```

Row selection is derived from `GridOptions['rowSelection']` and its native `singleRow` / `multiRow` branches. Callback-valued members such as `isRowSelectable` stay runtime-owned; `checkboxes` is narrowed to its static boolean branch.

For flat SSRM, `selectAll` is narrowed to native `'all'`. AG Grid 36.1 treats `'filtered'` / `'currentPage'` as invalid SSRM values, so the repository's All Filtered / Current Page operations remain explicit application semantics.

## 10. PR #42 / native-first SSRM editing reference

PR #42 (`Spike: native-first SSRM editing`) was merged into `configurable-feature-grid` as:

```text
279fbfea85da85741b42dfa6e3cb034b36a92c51
```

Reference route: `/ssrm-native-editing`.

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

Do not reintroduce Apply Last Edit, old current-page Flow 1/Flow 2, custom range-edit filtering or a custom Fill Handle replacement.

## 11. Validation direction after PR #42

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

## 12. Lightweight draft state is runtime, not config

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

Do not add complete API-response/block snapshots or a React Query row/original-value cache merely for draft persistence. The spike deliberately omits the previous REMOTE/conflict layer; concurrency/version/conflict UX remains a separate later decision.

## 13. Runtime-owned / deliberately unsupported examples

Runtime-owned even though `AgGridReact` accepts them as props:

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

`readOnlyEdit` is deliberately not exposed yet because it changes normal mutation/`cellValueChanged` into application-owned `cellEditRequest`, which is a different editing lifecycle.

Grouping/tree/pivot/aggregation options remain outside the initial configurable flat-SSRM contract until server request/response semantics exist end to end.

These are justified exclusions. "Transactions does not currently use it" is not enough by itself.

## 14. Stable identity / data adapters / backend authority

```text
field.colId
→ ColDef.colId
→ stable Grid State/API/logical column identity

field.field
→ ColDef.field
→ current row/API value path
```

`dataAdapterKey` resolves the frontend loading/saving/request-response/normalization boundary. SSRM block loading remains datasource-owned; do not force TanStack Query into datasource loading.

Backend remains authoritative for security/access, persistence validation, server-query semantics and writes.

## 15. Documentation / continuation

Public config changes require useful source JSDoc, curated docs and regenerated TypeDoc Markdown.

```bash
npm run docs:configurable
```

Current branch: `configurable-feature-grid`.

Do not create another branch or merge another PR without explicit instruction. Read `docs/configurable-feature-config-design-progress.md` for the exact next batch.
