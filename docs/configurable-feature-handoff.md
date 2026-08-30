# Handoff: Configurable Feature + AG Grid Architecture

> **Status:** current architecture/design handoff for configurable-feature work on `configurable-feature-grid`.
>
> Repository/source/docs are authoritative. In a new chat: inspect GitHub state, read root `AGENTS.md`, read this handoff, then read `docs/configurable-feature-config-design-progress.md` for the exact resume point.

## 1. Scope

The repository has proven Transaction Client, Infinite and SSRM grids plus an isolated native-first SSRM editing reference route merged from PR #42.

The configurable work remains a separate SSRM-first architecture experiment. Backend metadata does not choose Client/Infinite/SSRM, and the existing concrete grids should not be refactored merely to make configurable composition work.

Business structure:

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

## 3. Native-first naming rule

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

This rule applies to the **whole configuration contract**, not just columns currently used by Transactions.

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
    │   ├── pagination/cache native options
    │   ├── cellSelection
    │   ├── invalidEditValueMode
    │   ├── native edit-entry/undo/clipboard options
    │   └── basic native grid presentation options
    └── fields: FieldDefinition[]
        ├── colId
        ├── field
        ├── labelKey
        ├── cellDataType
        ├── ConfigurableNativeColDefOptions
        │   ├── sorting/layout/sizing/presentation
        │   ├── editable
        │   ├── cellEditor / cellEditorParams / popup options
        │   ├── suppressPaste / suppressFillHandle
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

has been removed from the normalized model.

## 5. Why native `cellEditor` / `cellRenderer` are safe

AG Grid supports provided/registered components by string name. Therefore normalized JSON can carry:

```text
cellEditor: "agNumberCellEditor"
cellEditor: "transactionAccountEditor"
cellRenderer: "statusChip"
```

Frontend runtime owns the actual custom component registration. Unknown/unapproved names must fail validation rather than being silently accepted.

This is native AG Grid capability, so a separate `editor.key` or `renderer.key` abstraction is unnecessary.

## 6. Why parser/formatter still use explicit keys

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

Entity-level native grid overrides now live under:

```text
entity.gridOptions
```

because the nested names are actual GridOptions concepts.

`defaultColDef` moved under that object because AG Grid itself defines `defaultColDef` as a GridOptions property:

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

Exact nested merge behavior belongs in the later normalizer/compiler implementation, but downstream property names stay native.

## 8. Current reviewed native GridOptions surface

The normalized SSRM grid options currently include:

```text
defaultColDef

pagination
paginationPageSize
paginationPageSizeSelector

cacheBlockSize
maxBlocksInCache
blockLoadDebounceMillis
maxConcurrentDatasourceRequests

cellSelection
invalidEditValueMode
singleClickEdit
suppressClickEdit
stopEditingWhenCellsLoseFocus
undoRedoCellEditing
undoRedoCellEditingLimit
suppressClipboardPaste

rowHeight
headerHeight
animateRows
```

This is an allowlisted native surface, not an unrestricted `GridOptions` passthrough. It should continue to expand by auditing applicable JSON-safe native options rather than by inventing app aliases.

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
```

The first configurable runtime remains SSRM. `rowModelType` is architecture-owned rather than metadata-selected.

## 9. PR #42 / merged native-first SSRM editing reference

PR #42 (`Spike: native-first SSRM editing`) was merged into `configurable-feature-grid` as merge commit `279fbfea85da85741b42dfa6e3cb034b36a92c51`.

Reference route:

```text
/ssrm-native-editing
```

It intentionally leaves the existing `/ssrm` implementation unchanged. Use it to understand editing ownership; do not copy the whole Transaction spike into configurable code.

### Native AG Grid owns

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

## 10. Configurable editing consequences

Do **not** introduce configurable copies of interactions AG Grid already owns:

```text
Apply Last Edit
old current-page Flow 1 / Flow 2
custom range-edit filtering
custom Fill Handle replacement
```

Configure the native capability instead:

```text
gridOptions.cellSelection
field.editable
field.suppressPaste
field.suppressFillHandle
...
```

AG Grid's native Fill Handle/paste already skips non-editable cells. Application row/access policy should be composed into the native `editable` callback at compile/runtime time.

## 11. Validation direction after PR #42

The previous stable validation store remains part of the old concrete tracked-editing implementation, but it is **not automatically the configurable editing architecture**.

The native-first spike proved:

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

Future configurable validation should therefore describe declarative rule data. The compiler/editor implementation adapts those rules into AG Grid's native validation callbacks. Callback functions themselves never come from backend JSON.

## 12. Lightweight draft state is not config

The merged generic spike primitives are candidates for reusable configurable runtime composition:

```text
frontend/src/shared/grid/editing/gridDraftEditing.ts
frontend/src/shared/grid/editing/useGridDraftEditing.ts
```

They are not metadata schemas.

The state is deliberately finite:

```text
rowId
└── dirty field
    ├── baseValue
    └── value
```

Do not add complete API-response/block snapshots or a React Query row/original-value cache merely for draft persistence.

The spike deliberately omits the previous REMOTE/conflict reconciliation layer. Concurrency/version/conflict UX remains a separate later product decision.

## 13. Deliberately unsupported native lifecycle: `readOnlyEdit`

AG Grid `readOnlyEdit=true` changes normal editing from grid mutation/`cellValueChanged` to application-owned `cellEditRequest`.

The merged spike and candidate draft observer are built around normal mutation + committed `cellValueChanged`. Therefore `readOnlyEdit` is not exposed in configurable grid options yet.

This is the correct reason to omit a native option: it changes the selected editing architecture, not merely because the Transaction demo does not use it.

## 14. Filtering remains a server-query descriptor

`filtering` remains custom:

```text
filtering: {
  filterOptions: [...]
}
```

because its important persisted meaning is which operators the active server adapter/backend supports, not only which filter component AG Grid can render.

Compiler intent:

```text
filtering
→ appropriate native filter
→ filterOptions → filterParams.filterOptions
```

Do not expose unsupported operators only because AG Grid provides them.

## 15. `cellDataType`

The normalized built-in AG Grid names now include:

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

SSRM requires explicit cell data types. The data adapter must materialise values in the representation AG Grid expects; for example raw JSON cannot directly transport JavaScript bigint.

## 16. Stable identity

```text
field.colId
→ ColDef.colId
→ stable Grid State/API/logical column identity

field.field
→ ColDef.field
→ current row/API value path
```

They may differ. Explicit `colId` prevents API field-path changes from silently changing logical column identity.

## 17. Data adapters and backend authority

`dataAdapterKey` resolves the frontend boundary for loading/saving/request-response mapping and backend-wire normalization.

SSRM block loading remains datasource-owned; do not force TanStack Query into the datasource lifecycle for consistency.

Backend remains authoritative for security/access, business validation at persistence, server-query semantics and writes.

## 18. Documentation and source comments

Public config changes require:

1. useful JSDoc/IDE hover rationale in `configuration.types.ts`;
2. curated reference updates under `docs/configurable-feature/`;
3. progress/handoff updates when architecture direction changes;
4. regenerated source-derived TypeDoc Markdown.

Regenerate with:

```bash
npm run docs:configurable
```

Generated pages under `docs/configurable-feature/generated/` must not be hand-edited as the normal fix.

## 19. Working branch / continuation

Current configurable design branch:

```text
configurable-feature-grid
```

Do not create another branch unless explicitly asked. Do not merge another PR without explicit approval.

Read `docs/configurable-feature-config-design-progress.md` for the exact next batch.
