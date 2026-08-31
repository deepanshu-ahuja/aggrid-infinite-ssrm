# Handoff: Configurable Feature + AG Grid Architecture

> **Status:** current architecture/design handoff for configurable-feature work on `configurable-feature-grid` after merged PR #43.
>
> Repository/source/docs are authoritative. In a new chat: inspect GitHub state first, read root `AGENTS.md`, read this handoff, then read `docs/configurable-feature-config-design-progress.md` for the exact resume point. Do not rely on old chat memory when the repository can provide current truth.

## 1. Current merged checkpoint and scope

PR #43 (`refactor: align configurable SSRM contract with native AG Grid`) was merged into `main` on 2026-08-31.

```text
PR #43 head before merge
307bb14694603842d1c31c62620e6e35379d8e8a

PR #43 merge commit / merged main checkpoint
1aba320ef48551d298ef52fc623c06ecb99017a0
```

After the merge, `configurable-feature-grid` was fast-forwarded to that merge commit before post-merge handoff cleanup. Later handoff commits may advance the working branch; always inspect GitHub.

The repository has proven Transaction Client, Infinite and SSRM grids plus the native-first SSRM editing reference route introduced by PR #42 and carried into `main` through PR #43.

The configurable work remains a separate SSRM-first architecture experiment. Backend metadata does not choose Client/Infinite/SSRM, and existing concrete grids should not be refactored merely to make configurable composition work.

```text
Review feature
├── "transaction" entity
├── "loan" entity
└── "finance" entity
```

Entity identity is the key in `FeatureDefinition.entities`; `EntityDefinition<TLabelKey, TFieldDefinition>` stays business-agnostic.

### New-chat reading order

A new session should:

1. inspect current `main`, `configurable-feature-grid`, open/recent PRs and current CI/status;
2. read root `AGENTS.md` and follow its branch/PR/testing/documentation rules;
3. read this file;
4. read `docs/configurable-feature-config-design-progress.md`;
5. read `docs/configurable-feature/configuration-reference.md`;
6. read `docs/configurable-feature/type-hierarchy.md` and `docs/configurable-feature/concepts.md` as needed;
7. inspect `frontend/src/shared/grid/configurable/configuration.types.ts` directly;
8. inspect `/ssrm-native-editing` and merged PR #42 when editing/runtime composition is relevant.

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

PR #43 is the checkpoint for this public type-design pass. Do not reopen the whole type model speculatively before implementing a real consumer; refine types when runtime/default/compiler work proves a concrete need.

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

The configurable field follows the actual SSRM/native-editing columns:

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

Runtime adaptation follows the native-first editing reference:

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

PR #42 (`Spike: native-first SSRM editing`) was merged into `configurable-feature-grid` at:

```text
279fbfea85da85741b42dfa6e3cb034b36a92c51
```

Its code is now also in merged `main` through PR #43.

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
native editable filtering
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

## 15. Exact next work after PR #43

The type-only native-alignment pass is now a merged checkpoint. The next session should not continue adding types merely for completeness.

First verify the merged/configurable head and regenerate generated docs if needed:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run docs:configurable
```

Then proceed with one coherent **defaults + normalization/compiler foundation** batch:

```text
application configurable-SSRM defaults
        +
normalized entity.gridOptions
        ↓
exact merge semantics
        ↓
runtime JSON validation + normalization
        ↓
named filter/editor/renderer validation
        ↓
formatter/parser/validator resolution
        ↓
compiled ColDef[] + GridOptions
        ↓
AgGridReact SSRM
        ↓
native editing / Cell Selection / clipboard / Fill Handle
        ↓
cellValueChanged
        ↓
useGridDraftEditing BASE + LOCAL runtime
```

The batch should define:

1. application configurable-SSRM defaults;
2. exact `entity.gridOptions` merge behavior;
3. nested merge behavior for `defaultColDef`, `filterParams`, `rowSelection`, `cellSelection`, static editor params and runtime validation additions;
4. runtime validation/normalization of backend JSON;
5. allowlist validation for named filters/editors/renderers;
6. formatter/parser registries using the AG Grid-derived registry types;
7. field compilation into final `ColDef`s, including translated `headerName`, runtime business `editable` policy and validation callbacks;
8. `rowId.path` compilation into runtime `getRowId`;
9. configurable SSRM root composition while keeping AG Grid lifecycle visible;
10. composition of the shared PR #42 draft-editing primitives, not a copy of the Transaction spike.

After that, continue with read/write/save mapping, access/security/masking, actions, Grid State reconciliation and schema/versioning.

Read `docs/configurable-feature-config-design-progress.md` for the most precise checkpoint and current validation status.

## 16. Documentation / verification truth

Public config changes require source JSDoc, curated docs and regenerated TypeDoc Markdown:

```bash
npm run docs:configurable
```

PR #43 being merged does not by itself prove the exact head passed local/CI verification. Inspect current CI/status and do not claim checks that were not actually executed.

Current working branch for continued configurable-feature work: `configurable-feature-grid`.

Do not create another branch or merge another PR without explicit user instruction.
