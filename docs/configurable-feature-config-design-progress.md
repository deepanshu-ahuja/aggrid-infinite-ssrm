# Configurable Feature Configuration Design Progress

## Purpose

Durable continuation file for configurable-feature contract design on `configurable-feature-grid`.

In a new chat, inspect current GitHub state and root `AGENTS.md`, then read:

1. `docs/configurable-feature-handoff.md`;
2. `docs/configurable-feature/configuration-reference.md`;
3. `docs/configurable-feature/type-hierarchy.md`;
4. this file;
5. merged PR #42 / `/ssrm-native-editing` when editing/runtime composition is relevant.

## Current checkpoint

PR #42 (`Spike: native-first SSRM editing`) is merged into `configurable-feature-grid` at merge commit:

```text
279fbfea85da85741b42dfa6e3cb034b36a92c51
```

Latest configurable type refactor in this design sequence:

```text
44702fb9f2796ea9e8c3127863633d7c1df89c08
refactor: derive configurable types from ag grid
```

Later documentation commits may advance branch HEAD. Always inspect GitHub rather than assuming this commit is current HEAD.

## Working rules

- Stay on `configurable-feature-grid` unless explicitly told otherwise.
- Do not create another branch or merge another PR without explicit user instruction.
- First configurable runtime remains SSRM-only unless direction changes.
- Backend metadata never chooses row model.
- AG Grid 36.1 is the implementation reference; native capability first.
- No universal grid wrapper / giant `useGrid`.
- SSRM datasource loading remains datasource-owned, not TanStack Query.

## Mandatory normalization boundary

```text
frontend-supported configuration design
        ↓
may be stored/managed using backend/database representation
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

Normalization remains mandatory even when backend/storage names exactly equal normalized names. Compile-time AG Grid typing does not validate runtime JSON.

## Native naming and type-derivation rule

The strongest current rule is:

```text
same AG Grid concept + same persisted value semantics
→ use AG Grid property name

precise exported AG Grid type exists
→ use it directly

reviewed set of native properties
→ Pick<AGGridType, ReviewedKeys>

native member mixes data + callback/function branch
→ Extract/Omit/narrow only that member

single Type['key'] is clearest exact type
→ indexed access is fine
```

Do **not** manually mirror dozens of properties as:

```ts
foo?: ColDef['foo'];
bar?: GridOptions['bar'];
```

when a reviewed `Pick` can express the whole native surface.

Also do **not** define the persisted surface as a broad `Omit<ColDef, UnsafeKeys>` / `Omit<GridOptions, UnsafeKeys>`. That can accidentally expose newly-added AG Grid members after an upgrade. The safe pattern is:

```text
explicit Pick allowlist
+ narrow replacements for mixed/executable properties
```

The repo already uses this pattern in `serverFilterParams.ts` with `Pick<ITextFilterParams, ...>`.

## Latest type derivation cleanup — DONE

### Cell data type

Old approach reconstructed native literals from broad `ColDef.cellDataType`.

Current:

```ts
export type FieldCellDataType = BaseCellDataType;
```

`BaseCellDataType` is AG Grid's own exported union of predefined types:

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

This is more correct because `ColDef.cellDataType` is intentionally broader for inference/custom data type names.

### Filter option keys

Filter option unions now derive from AG Grid `ISimpleFilterModelType` using `Extract`, then narrow to server-supported operators.

```text
text
→ contains / equals / notEqual / startsWith / endsWith

number + bigint
→ equals / notEqual / greaterThan / greaterThanOrEqual / lessThan / lessThanOrEqual

date/dateString/dateTime/dateTimeString
→ equals / notEqual / lessThan / greaterThan

boolean
→ equals / notEqual
```

`FieldFilteringDefinition<TFilterOption>` now constrains options to `ISimpleFilterModelType`; feature extensions are native filter-option keys, not arbitrary strings.

### Column options

Current implementation shape:

```ts
type ConfigurableNativeColDefBase =
  Pick<ColDef, ConfigurableNativeColDefKey>;

export type ConfigurableNativeColDefOptions<...> =
  ConfigurableNativeColDefBase
  & ConfigurableNativeColDefBooleanBranches
  & {
      cellEditor?: TCellEditorName;
      cellEditorParams?: ConfigurationJsonObject;
      cellRenderer?: TCellRendererName;
      cellRendererParams?: ConfigurationJsonObject;
    };
```

Mixed callback/native properties such as `editable`, `suppressNavigable` and `suppressPaste` are narrowed to their boolean branch with `Extract`.

`cellEditor` / `cellRenderer` remain native string-name properties; runtime validates/owns the registered implementation. Static params stay JSON-safe.

### Cell Selection

Derived from `GridOptions['cellSelection']`:

```text
NativeCellSelectionOptions
→ Pick native top-level declarative properties

NativeCellSelectionHandle
→ Extract range handle
→ Extract fill handle
→ Omit fill.setFillValue only
```

This keeps AG Grid's native range/fill structure instead of maintaining a parallel local union.

### Row selection

Derived from `GridOptions['rowSelection']`:

```text
Extract singleRow branch
Extract multiRow branch
Pick shared native safe properties
narrow checkboxes to boolean branch
narrow multiRow groupSelects to self
narrow SSRM selectAll to all
```

`isRowSelectable` remains runtime-owned business policy.

### Grid options

Current implementation shape:

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

This replaces the previous manual sequence of `pagination?: GridOptions['pagination']`, etc., while preserving an explicit safe allowlist.

## Native-first editing status after PR #42

Removed from normalized public config:

```text
FieldEditingDefinition
FieldEditorDefinition
FieldValueParserDefinition
FieldRendererDefinition
FieldFormatterDefinition
field.editing
field.editing.editor
field.editing.parser
field.renderer
field.formatter
```

Native field properties remain flat:

```text
editable
cellEditor
cellEditorParams
cellEditorPopup
cellEditorPopupPosition
singleClickEdit
useValueParserForImport
useValueFormatterForExport
suppressPaste
suppressFillHandle
cellRenderer
cellRendererParams
```

Executable formatter/parser selection remains explicit:

```text
valueFormatterKey / valueFormatterConfig
valueParserKey / valueParserConfig
```

Raw AG Grid executable expression strings are not accepted from backend JSON.

## Current grid-level native surface

The reviewed `Pick<GridOptions, ...>` currently covers:

```text
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

Nested `defaultColDef`, `rowSelection`, `cellSelection` use their bounded derived types.

## Runtime-owned / excluded examples

Do not persist merely because `AgGridReact` accepts them:

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

`readOnlyEdit` remains deliberately unsupported because it changes the selected editing lifecycle from `cellValueChanged` observation to `cellEditRequest` ownership.

Grouping/tree/pivot/aggregation options remain outside the initial flat SSRM contract until backend request/response semantics exist.

## Editing runtime learned from merged PR #42

AG Grid owns normal edits, Cell Selection, Ctrl/Cmd+D, Ctrl/Cmd+Enter, Fill Handle, clipboard/paste, native editable filtering and editor validation lifecycle.

Shared/runtime candidate primitives:

```text
frontend/src/shared/grid/editing/gridDraftEditing.ts
frontend/src/shared/grid/editing/useGridDraftEditing.ts
```

They retain only genuinely dirty `BASE + LOCAL` fields and own first-BASE capture, revert cleanup, selected∩dirty targeting, acknowledgement/rebase, SSRM LOCAL restoration and Discard refresh. These are runtime mechanics, not config.

Do not restore old Apply Last Edit / current-page Flow 1 / Flow 2 mechanics.

## Validation direction

Future configurable validation remains declarative rule data. Runtime adapts it into AG Grid native editor validation:

```text
provided editor
→ cellEditorParams.getValidationErrors

custom React/MUI editor
→ useGridCellEditor
→ getValidationErrors / getValidationElement

invalidEditValueMode = block
→ invalid edit does not commit into BASE+LOCAL draft
```

Callbacks do not come from backend JSON.

## Filtering — next important derivation batch

The current `filtering` descriptor intentionally represents server-query capability. Common Simple Filter behavior still needs a normalized/default design.

When implementing it, prefer AG Grid's exported filter-param types:

```text
ITextFilterParams
INumberFilterParams
IBigIntFilterParams
IDateFilterParams
ISimpleFilterParams
```

Use `Pick` / `Omit` / `Extract` to expose the supported JSON-safe members and remove callback/executable or unsupported end-to-end behavior. Existing `serverFilterParams.ts` is the local precedent.

Current repo behavior already proves:

```text
buttons = reset + apply
maxNumConditions = 1
closeOnApply = true
```

Do not expose multi-condition/range/blank/custom predicate behavior until backend/query semantics support it.

## Coverage snapshot

```text
FeatureDefinition                               DONE
EntityDefinition generic meaning                DONE
RowIdDefinition                                DONE
colId / field identity                         DONE
BaseCellDataType derivation                     DONE
ISimpleFilterModelType operator derivation      DONE
Pick-derived ConfigurableNativeColDefOptions    DONE current pass
native cellEditor / cellRenderer                DONE
valueFormatter/valueParser registry keys        DONE direction
Pick-derived ConfigurableSsrmGridOptions         DONE current pass
derived Cell Selection safe shape               DONE
derived flat-SSRM rowSelection safe shape       DONE
PR #42 editing architecture review              DONE
backend/store → normalize → compile boundary    DONE DIRECTION
TypeDoc + Markdown tooling                      CONFIGURED
generated TypeDoc for latest public types       NEEDS REGENERATION

app/entity grid-option merge runtime             NEXT
filter-param/default derivation + merge          NEXT
registry implementation typing/compiler shape   NEXT
validation declarations/native adaptation       AFTER ABOVE
server sort/filter/search mapping                NOT YET DESIGNED
read/write/save mapping                          NOT YET DESIGNED
access/security/masking                          NOT YET DESIGNED
data-adapter registry                            NOT YET DESIGNED
actions/business operations                      NOT YET DESIGNED
Grid State/access reconciliation                 PRINCIPLES ONLY
runtime config schema/version validation         NOT YET DESIGNED
final runtime/compiler                           NOT YET DESIGNED
```

## Exact resume point

Resume one coherent compiler/defaults/filter-types batch:

1. inspect latest GitHub state and AG Grid 36.1 exports again;
2. define application configurable-SSRM defaults and exact `entity.gridOptions` merge semantics;
3. define nested merge behavior for `defaultColDef`, `cellSelection` and `rowSelection`;
4. derive common server Simple Filter config from `ITextFilterParams` / `INumberFilterParams` / `IBigIntFilterParams` / `IDateFilterParams` with utility types;
5. merge those defaults with `field.filtering.filterOptions` without duplicating AG Grid types;
6. define native `cellEditor` / `cellRenderer` registration validation;
7. type formatter/parser registries with real AG Grid function contracts;
8. classify compiler output: native pass-through vs registry-resolved vs runtime-owned;
9. preserve mandatory backend/storage normalization.

Then design validation declarations/native adaptation, server query/search, save mapping, access/security/masking and runtime compiler layers.

## Validation/testing status

The latest source/docs were written directly on `configurable-feature-grid` through GitHub. Full lint/typecheck/unit/build have **not** been run on this exact head in this chat. Do not claim green until executed.

After pulling, run at least:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run docs:configurable
```

Generated TypeDoc under `docs/configurable-feature/generated/` is stale until regeneration is committed.
