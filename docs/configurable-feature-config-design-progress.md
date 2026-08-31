# Configurable Feature Configuration Design Progress

## Purpose

Durable continuation file for configurable-feature work on `configurable-feature-grid`.

A new chat/session must reconstruct current truth from GitHub and repository docs rather than relying on conversation memory.

Start in this order:

1. inspect current `main`, `configurable-feature-grid`, open/recent PRs and latest CI/status;
2. read root `AGENTS.md` and follow its documented reading/workflow rules;
3. read `docs/configurable-feature-handoff.md`;
4. read `docs/configurable-feature/configuration-reference.md`;
5. read `docs/configurable-feature/type-hierarchy.md`;
6. read this file for the exact current checkpoint/resume point;
7. inspect merged PR #42 / `/ssrm-native-editing` when editing/runtime composition is relevant;
8. inspect the actual current source before changing anything, especially `frontend/src/shared/grid/configurable/configuration.types.ts`.

## Current merged checkpoint

PR #43 (`refactor: align configurable SSRM contract with native AG Grid`) was merged into `main` on 2026-08-31.

```text
PR #43 head before merge
307bb14694603842d1c31c62620e6e35379d8e8a

PR #43 merge commit / merged main checkpoint
1aba320ef48551d298ef52fc623c06ecb99017a0
```

Immediately after that merge, `configurable-feature-grid` was fast-forwarded to the merge commit above before this post-merge handoff cleanup. Subsequent handoff/documentation commits may advance `configurable-feature-grid`, so always inspect GitHub rather than assuming a stored SHA is the current branch head.

PR #42 (`Spike: native-first SSRM editing`) was previously merged into `configurable-feature-grid` at:

```text
279fbfea85da85741b42dfa6e3cb034b36a92c51
```

Its code is now part of the history merged through PR #43. `/ssrm-native-editing` is the behavioral editing reference for the configurable direction; existing `/ssrm` remains its own current implementation.

## Working rules

- Continue configurable-feature work on `configurable-feature-grid` unless explicitly told otherwise.
- Do not create another branch unless explicitly requested.
- Do not merge a PR unless explicitly requested.
- First configurable runtime remains flat SSRM.
- Backend metadata never chooses row model.
- AG Grid 36.1 is the implementation reference; use native capability first.
- No universal grid wrapper / giant `useGrid`.
- SSRM datasource loading remains datasource-owned, not TanStack Query-owned.
- Existing concrete Client/Infinite/SSRM grids remain independent; do not refactor them merely to make configurable composition work.
- `/ssrm-native-editing` is a reference for ownership and reusable mechanics, not a component to copy wholesale.

## Mandatory normalization boundary

```text
frontend-supported configuration
        ↓
backend/database representation may differ
        ↓
backend runtime JSON
        ↓
validate + normalize/adapt ALWAYS
        ↓
normalized frontend configuration
        ↓
compiler + registries + runtime policy
        ↓
AG Grid
```

Matching backend/frontend names do not remove normalization. TypeScript AG Grid types do not validate runtime JSON.

## Native naming/type rule

```text
same AG Grid concept + same persisted semantics
→ keep AG Grid property name

precise AG Grid type exists
→ use it directly

reviewed native surface
→ Pick<AGGridType, ReviewedKeys>

mixed declarative/callback member
→ Extract/Omit only unsafe branch

single Type['key'] is clearest
→ indexed access is fine
```

Top-level persisted surfaces stay explicit positive `Pick` allowlists. Do not use a broad `Omit` that might expose newly-added AG Grid runtime/callback properties after an upgrade.

## Current public type contract — design checkpoint complete

PR #43 is the review/merge checkpoint for the current public configuration-type design. Do not reopen the whole type model speculatively before building a real consumer. Adjust types when defaults/normalization/compiler/runtime work proves a concrete need.

### Feature/entity/identity

```text
FeatureDefinition
EntityDefinition
RowIdDefinition
field.colId
field.field
labelKey
dataAdapterKey
```

Entity identity lives in the `FeatureDefinition.entities` record key. `EntityDefinition` remains business-agnostic.

### Cell data type

```ts
FieldCellDataType = BaseCellDataType
```

AG Grid owns the built-in type union.

### Native column surface

`ConfigurableNativeColDefOptions` derives reviewed native values from `ColDef` with `Pick` and narrows callback unions only where needed.

Current native shape includes:

```text
type
sorting
visibility/pinning/sizing
wrapping/header/filter presentation
editable
filter / filterParams
cellEditor / cellEditorParams / popup options
singleClickEdit
suppressPaste / suppressFillHandle
useValueParserForImport
useValueFormatterForExport
cellRenderer / cellRendererParams
```

There is no custom `editing.editor`, `editing.parser`, `renderer`, or `filtering` wrapper.

### Native server-backed filters

Field filtering follows the real SSRM/native-editing columns:

```text
filter
filterParams
```

Operator names derive from `ISimpleFilterModelType`.

Safe filter-param types derive from:

```text
ITextFilterParams
INumberFilterParams
IBigIntFilterParams
IDateFilterParams
```

Current common server contract keeps one condition per field, so configurable `maxNumConditions` is narrowed to `1`.

Persisted filter params intentionally exclude executable callbacks and native options whose semantics the current server-query contract cannot faithfully reproduce.

The important rule is:

> JSON-safe is necessary but not sufficient for SSRM configuration. A native property that changes server filtering meaning must also have end-to-end adapter/backend semantics.

### Native grid surface

`ConfigurableSsrmGridOptions` is a reviewed `Pick<GridOptions, ...>` plus bounded:

```text
defaultColDef
rowSelection
cellSelection
```

The grid-level surface includes the native-editing reference requirements:

```text
cellSelection
invalidEditValueMode
suppressClipboardPaste
```

plus reviewed pagination/cache/navigation/presentation/focus options.

`readOnlyEdit` remains excluded because it changes draft ownership from `cellValueChanged` observation to `cellEditRequest`.

### Row selection

Derived from native `GridOptions['rowSelection']`.

For current flat SSRM:

```text
singleRow | multiRow
static checkbox branch
headerCheckbox
ctrlASelectsRows
selectAll = all
```

`isRowSelectable` remains runtime business policy.

`groupSelects` is not exposed for the flat configurable runtime merely to store `'self'`; introduce it together with real server-side grouping support.

### Cell Selection

Derived from native `GridOptions['cellSelection']` and native range/fill handle types. Only executable Fill Handle `setFillValue` is removed.

### Formatter/parser registries

```text
valueFormatterKey / valueFormatterConfig
valueParserKey / valueParserConfig
```

`RegisteredValueFormatter` / `RegisteredValueParser` derive the real AG Grid function branches for registry implementation typing.

### Validation declarations

`FieldDefinition.validationRules` reuses the proven shared `GridValidationRule` shape:

```text
key
params
message
```

Only `params` is narrowed to JSON-safe `ConfigurationJsonObject` for persisted config.

Runtime native adaptation remains:

```text
provided editor
→ cellEditorParams.getValidationErrors

custom React/MUI editor
→ useGridCellEditor(getValidationErrors/getValidationElement)

invalidEditValueMode = block
→ invalid values do not commit into BASE+LOCAL draft state
```

## Native-first editing ownership from PR #42

AG Grid owns:

```text
normal edit
Cell Selection
Ctrl/Cmd+D
Ctrl/Cmd+Enter
Fill Handle
clipboard/paste
native editable filtering
editor validation lifecycle
```

Shared runtime owns:

```text
only dirty BASE + LOCAL fields
first BASE capture
revert-to-BASE cleanup
selected ∩ dirty targeting
safe acknowledgement/rebase
SSRM LOCAL restoration
Discard + authoritative refresh
```

Feature/business layer owns row/cell editability policy, validation rule selection/messages, persistence mapping/endpoints, Save/Discard presentation and backend authority.

Do not recreate old Apply Last Edit / current-page Flow 1 / Flow 2 behavior.

## Runtime-owned/excluded examples

```text
modules
rowModelType
serverSideDatasource
columnDefs
context
getRowId callback
GridApi refs
events
getRowClass / rowClassRules business callbacks
isRowSelectable
native editor-validation callbacks
```

Grouping/tree/pivot/aggregation stay out until their real SSRM/server semantics are designed.

## Type contract remaining refinements

The public type surface is broad enough to start runtime work. Refine these only when a real config/runtime example requires it:

- strongly correlating registered component names with their static params;
- feature-specific filter component-name allowlists;
- validation message/i18n representation if plain `message` is not the final product contract;
- additional executable registry keys only when a real configurable requirement exists.

Do not pre-create registry keys for every AG Grid callback.

## Exact next batch

Proceed to the **defaults + normalization/compiler foundation**, not another general type-only naming pass.

Before implementation, first verify the merged checkpoint locally/CI and regenerate TypeDoc if still stale.

Then implement one coherent batch:

1. define application configurable-SSRM defaults;
2. define exact merge semantics for `entity.gridOptions`;
3. define nested merge semantics for `defaultColDef`, `filterParams`, `rowSelection`, `cellSelection`, and static `cellEditorParams` plus runtime validation params;
4. define runtime validation/normalization of backend JSON against the supported contract;
5. define allowlist validation for named filters/editors/renderers;
6. define formatter/parser registries using `RegisteredValueFormatter` / `RegisteredValueParser`;
7. compile normalized fields into final `ColDef`s while composing runtime business `editable` policy and validation callbacks;
8. build/compose the configurable SSRM root while keeping AG Grid lifecycle visible;
9. compose the shared PR #42 draft-editing infrastructure rather than copying the Transaction spike;
10. keep server query mapping/data adapters authoritative for filter/sort semantics.

Expected runtime direction:

```text
application configurable-SSRM defaults
        +
normalized entity.gridOptions
        ↓
resolved configurable grid options
        ↓
normalized fields
        ↓
component/formatter/parser/validator resolution
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

After that, continue with read/write/save mapping, access/security/masking, actions, Grid State reconciliation and broader runtime schema/versioning.

## Validation/testing status

PR #43 was merged without an exact-head green status being established in the design session. Do not infer green from the merge itself.

At the start of the next implementation session, inspect current GitHub Actions/status first. If the exact merged/configurable head has not been validated, run at least:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run docs:configurable
```

Review and commit regenerated TypeDoc output under `docs/configurable-feature/generated/` if it changes.

Do not claim local/browser/CI verification that was not actually executed.
