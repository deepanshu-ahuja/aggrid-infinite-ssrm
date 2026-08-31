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

Normalization remains even when backend/storage keys exactly match normalized frontend names. TypeScript AG Grid types protect source code; backend runtime JSON remains untrusted.

## 3. Native-first naming and type derivation

```text
same AG Grid concept + same persisted semantics
→ use AG Grid property name

precise exported AG Grid type exists
→ use it directly

reviewed native surface
→ Pick<AGGridType, ReviewedKeys>

native member mixes data + callback/function
→ Extract/Omit/narrow only the unsafe branch

single indexed access is clearest
→ Type['key'] is fine
```

Do not manually mirror dozens of AG Grid property types when a reviewed `Pick` expresses the relationship. Do not use a broad top-level `Omit` that could accidentally expose new AG Grid runtime/callback properties after a library upgrade.

## 4. Current normalized structure

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
        ├── Pick-derived native ColDef options
        ├── colId
        ├── field
        ├── labelKey
        ├── cellDataType: BaseCellDataType
        ├── native filter / typed filterParams
        ├── native cellEditor / cellRenderer names + static params
        ├── validationRules?
        ├── valueFormatterKey? / valueFormatterConfig?
        └── valueParserKey? / valueParserConfig?
```

There is deliberately no custom `editing → editor/parser`, `renderer → key`, or `filtering → filterOptions` hierarchy.

## 5. Native filters instead of an application filter wrapper

The configurable field now follows the actual SSRM columns:

```ts
filter: 'agTextColumnFilter',
filterParams: {
  buttons: ['reset', 'apply'],
  maxNumConditions: 1,
  closeOnApply: true,
  filterOptions: ['contains', 'equals'],
}
```

Filter operator names derive from AG Grid `ISimpleFilterModelType`.

Safe type-specific params derive from AG Grid:

```text
ITextFilterParams
INumberFilterParams
IBigIntFilterParams
IDateFilterParams
```

The server-query contract still matters. JSON-safe does **not** automatically mean suitable for SSRM configuration. Native options that change server filtering semantics without being represented by the current filter model/backend remain excluded.

Current server operator vocabulary:

```text
Text       → contains / equals / notEqual / startsWith / endsWith
Number     → equals / notEqual / greaterThan / greaterThanOrEqual / lessThan / lessThanOrEqual
BigInt     → same operator vocabulary as Number
Date/time  → equals / notEqual / lessThan / greaterThan
Boolean    → equals / notEqual
```

Current common filter config keeps `maxNumConditions = 1` because the backend request shape represents one condition per field.

## 6. Native editor/renderer/filter component names

AG Grid supports provided/registered components by string name, so normalized JSON can carry:

```text
filter: "agTextColumnFilter"
cellEditor: "agNumberCellEditor"
cellEditor: "transactionAccountEditor"
cellRenderer: "statusChip"
```

Frontend runtime owns actual implementations and validates configured names.

Static `cellEditorParams` / `cellRendererParams` remain JSON-safe. Runtime may merge callbacks into final params where AG Grid requires executable lifecycle hooks.

## 7. Executable formatter/parser registries

AG Grid formatter/parser string values are executable expressions, not component-registration names. Arbitrary expressions are not accepted from backend JSON.

```text
valueFormatterKey
→ frontend registry
→ real AG Grid valueFormatter

valueParserKey
→ frontend registry
→ real AG Grid valueParser
```

`RegisteredValueFormatter` / `RegisteredValueParser` derive the actual AG Grid function branches so registry implementations use native callback signatures.

## 8. Validation declarations use the proven shared rule shape

`FieldDefinition.validationRules` reuses the existing shared `GridValidationRule` contract:

```text
key
params
message
```

The configurable alias only narrows `params` to JSON-safe `ConfigurationJsonObject`.

Runtime adaptation follows PR #42:

```text
validationRules
→ frontend validator registry
→ validation messages

provided editor
→ runtime cellEditorParams.getValidationErrors

custom React/MUI editor
→ useGridCellEditor
→ getValidationErrors / getValidationElement

gridOptions.invalidEditValueMode = "block"
→ invalid value does not commit into BASE+LOCAL draft state
```

The callbacks themselves are runtime code, not configuration.

## 9. Grid options/defaultColDef

Entity native grid overrides live under `entity.gridOptions` because those are real `GridOptions` concepts.

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

The reviewed grid surface includes pagination/cache/loading, editing/navigation, Cell Selection, clipboard, column movement, layout/presentation, tooltips and focus/accessibility.

`defaultColDef`, `rowSelection`, and `cellSelection` are bounded native-derived nested types.

`readOnlyEdit` is deliberately excluded because it changes the selected edit lifecycle from normal mutation/`cellValueChanged` observation to `cellEditRequest` ownership.

## 10. Native Cell Selection / row selection

Cell Selection is derived from `GridOptions['cellSelection']`:

```text
native cellSelection
→ Pick safe declarative top-level members
→ derive native range/fill handle union
→ Omit only executable fill.setFillValue
```

Row selection derives native `singleRow` / `multiRow` branches. `checkboxes` is narrowed to its static boolean branch and `isRowSelectable` stays runtime business policy.

For current flat configurable SSRM:

```text
selectAll = all
headerCheckbox
ctrlASelectsRows
```

`groupSelects` is not exposed merely to store the default `'self'`; grouping belongs with a real server-side grouping capability.

AG Grid's `filtered` / `currentPage` native select-all modes are not valid SSRM semantics, so the repository's All Filtered / Current Page operations remain application-owned.

## 11. PR #42 native-first SSRM editing reference

PR #42 (`Spike: native-first SSRM editing`) is merged into `configurable-feature-grid` as:

```text
279fbfea85da85741b42dfa6e3cb034b36a92c51
```

Reference route: `/ssrm-native-editing`.

Use the spike to understand ownership. Do not copy the whole Transaction grid into configurable code.

### AG Grid owns

```text
normal cell editing
Cell Selection
Ctrl/Cmd+D
Ctrl/Cmd+Enter
Fill Handle
clipboard/paste
editable filtering
editor commit/validation lifecycle
```

### Shared runtime owns

```text
BASE + LOCAL only for genuinely dirty fields
first BASE capture
revert-to-BASE cleanup
selected ∩ dirty targeting
safe save acknowledgement/rebase
LOCAL restore after SSRM RowNode/store recreation
Discard draft cleanup + authoritative refresh
```

### Feature/business layer owns

```text
row/cell editable policy
validation rule selection/messages
persistence mapping/endpoints
row/selected Save and Discard presentation
backend authority
```

Do not reintroduce Apply Last Edit, old current-page Flow 1/Flow 2, or custom range-edit filtering.

## 12. Runtime draft state is not config

Shared candidates:

```text
frontend/src/shared/grid/editing/gridDraftEditing.ts
frontend/src/shared/grid/editing/useGridDraftEditing.ts
```

State stays intentionally lightweight:

```text
rowId
└── dirty field
    ├── baseValue
    └── value
```

Do not copy full API responses/SSRM blocks into React state and do not add a React Query original-row cache for this purpose.

The spike deliberately omits the previous REMOTE/conflict layer. Concurrency/version/conflict UX remains a separate later product decision.

## 13. Runtime-owned / deliberately unsupported examples

```text
modules
rowModelType
serverSideDatasource
columnDefs
context
getRowId callback
GridApi refs
events/callbacks
getRowClass / rowClassRules business callbacks
isRowSelectable
validation callbacks
```

Grouping/tree/pivot/aggregation remain outside the initial flat configurable SSRM contract until server request/response semantics exist end to end.

These are justified exclusions. "Transactions does not currently use it" is not sufficient by itself.

## 14. Stable identity / adapter authority

```text
field.colId
→ ColDef.colId
→ stable Grid State/API/logical column identity

field.field
→ ColDef.field
→ current row/API value path
```

`dataAdapterKey` resolves frontend loading/saving/request-response normalization. SSRM block loading remains datasource-owned rather than TanStack Query-owned.

Backend remains authoritative for security/access, persistence validation, server-query semantics and writes.

## 15. Next work

The type-only native-alignment pass is now far enough along to start runtime foundations.

Next batch:

```text
application configurable-SSRM defaults
→ exact entity.gridOptions merge semantics
→ nested defaultColDef/filterParams/rowSelection/cellSelection merging
→ runtime JSON validation + normalization
→ named component validation
→ formatter/parser registries
→ field compiler
→ compose PR #42 draft editing + native validation
```

Then proceed to save/read mapping, access/security/masking, actions, Grid State reconciliation and schema/versioning.

Read `docs/configurable-feature-config-design-progress.md` for the exact current checkpoint.

## 16. Documentation / verification

Public config changes require source JSDoc, curated docs and regenerated TypeDoc Markdown:

```bash
npm run docs:configurable
```

Current branch: `configurable-feature-grid`.

Do not create another branch or merge another PR without explicit instruction.
