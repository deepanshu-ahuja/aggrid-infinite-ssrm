# Configurable Feature Configuration Design Progress

## Purpose

Durable continuation file for configurable-feature contract design on `configurable-feature-grid`.

Repository/source/docs are authoritative. In a new chat, read in this order after current GitHub state and root `AGENTS.md`:

1. `docs/configurable-feature-handoff.md` — architecture handoff;
2. `docs/configurable-feature/configuration-reference.md` — current public normalized contract;
3. `docs/configurable-feature/type-hierarchy.md` — relationship map;
4. this file — exact checkpoint and next work;
5. merged PR #42 / `/ssrm-native-editing` when working on configurable editing/runtime composition.

## Current GitHub checkpoint

PR #42 — `Spike: native-first SSRM editing` — was merged into `configurable-feature-grid`.

```text
merge commit: 279fbfea85da85741b42dfa6e3cb034b36a92c51
reference route: /ssrm-native-editing
```

The spike is an editing architecture reference. Existing `/ssrm` remains intentionally different and was not replaced by the spike.

## Working rules

- Stay on `configurable-feature-grid` unless explicitly told otherwise.
- Do not create another branch or merge another PR without explicit user instruction.
- First configurable runtime remains SSRM-only unless direction changes.
- Backend metadata never chooses row model.
- AG Grid 36.1 is the implementation reference; native capability first.
- Do not add a universal AG Grid wrapper/giant `useGrid`.
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

Normalization remains even when backend/storage names currently equal normalized names.

## Native naming/type rule

```text
same AG Grid concept + same persisted value semantics
→ AG Grid property name
→ derive/reuse AG Grid type where practical

AG Grid supports JSON-safe component-name registration
→ keep native cellEditor / cellRenderer
→ validate name against frontend registrations

AG Grid expects executable function/expression
→ explicit safe frontend registry key/config descriptor

application/business semantics differ
→ keep application name
```

The audit is capability-driven, not Transaction-demo-driven. Applicable native JSON-safe options should keep their native names. Exclude a native property only for a concrete reason: executable value, incompatible flat-SSRM semantics, unsupported end-to-end capability, or a different runtime architecture.

## Whole-contract native-first cleanup — DONE for current field/editing batch

Removed from the normalized public model:

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

### Native column/editing properties stay native

Fields/defaults use `ConfigurableNativeColDefOptions`. The reviewed safe surface currently includes:

```text
sorting
→ sortable
→ initialSort
→ initialSortIndex
→ sortingOrder

layout/sizing
→ initialHide
→ lockVisible
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

presentation/filter UI/navigation
→ wrapText
→ autoHeight
→ wrapHeaderText
→ autoHeaderHeight
→ headerTooltip
→ tooltipField
→ suppressNavigable (boolean branch)
→ floatingFilter
→ suppressHeaderMenuButton
→ suppressHeaderFilterButton
→ suppressHeaderContextMenu
→ suppressFloatingFilterButton

editing/import/export
→ editable (boolean branch)
→ cellEditor
→ cellEditorParams
→ cellEditorPopup
→ cellEditorPopupPosition
→ singleClickEdit
→ useValueParserForImport
→ useValueFormatterForExport
→ suppressPaste (boolean branch)
→ suppressFillHandle

rendering
→ cellRenderer
→ cellRendererParams
```

`cellEditor` / `cellRenderer` are native because AG Grid supports provided/registered component names as strings. Frontend runtime owns the actual custom component implementations/registration.

Stateful current values such as `hide`, `pinned`, `width`, `flex`, `sort` and `sortIndex` are not the declarative initial-config vocabulary; use their `initial*` forms so later Grid State/user changes are not repeatedly overwritten.

### Executable parser/formatter stay safe

```text
valueFormatterKey
valueFormatterConfig
valueParserKey
valueParserConfig
```

These remain explicit descriptors because AG Grid's actual `valueFormatter` / `valueParser` values are executable functions/expressions. Raw AG Grid expression strings are not accepted from backend configuration.

### Cell data types broadened

Current normalized built-in names:

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

SSRM still requires explicit `cellDataType`. Adapter conversion is responsible for producing the JavaScript representation AG Grid expects.

## Grid-level native configuration — BROAD CURRENT PASS DONE

`EntityDefinition` now has:

```text
gridOptions?: ConfigurableSsrmGridOptions
```

`defaultColDef` moved under `gridOptions` because it is itself a native GridOptions property.

Current reviewed native surface:

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
→ rowSelection: ConfigurableSsrmRowSelectionOptions

cell selection / editing
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

layout / presentation
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

This is still an intentional allowlist rather than an unchecked `GridOptions` pass-through, but it is no longer limited to the current Transaction demo values. Continue adding applicable native properties by capability using the same rule, not by inventing replacement names.

## Native flat-SSRM row selection

`ConfigurableSsrmRowSelectionOptions` now captures the safe native configuration while leaving business callbacks runtime-owned.

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

`isRowSelectable` remains a runtime callback because it enforces feature/business row policy.

AG Grid 36.1 documents `rowSelection.selectAll='filtered'|'currentPage'` as invalid for SSRM; the grid behaves as `'all'`. Therefore those values are not exposed as native SSRM config. The repository's All Filtered / Current Page semantics remain explicit application operations.

## Runtime-owned React/AG Grid props

These are not persisted merely because `AgGridReact` accepts them as props:

```text
modules
rowModelType
serverSideDatasource
columnDefs
context
getRowId callback
events/callbacks
GridApi refs
business-policy callbacks such as isRowSelectable
```

`CellSelectionModule` and `ClipboardModule` are required runtime/bundle capabilities for corresponding native features, not backend JSON.

## Editing architecture learned from merged PR #42

AG Grid owns:

```text
normal editing
Cell Selection
Ctrl/Cmd+D
Ctrl/Cmd+Enter
Fill Handle
clipboard/paste
native editable filtering
editor validation/commit lifecycle
```

The configurable runtime should compose generic BASE+LOCAL draft infrastructure rather than recreate those interactions.

Candidate reusable runtime files merged by the spike:

```text
frontend/src/shared/grid/editing/gridDraftEditing.ts
frontend/src/shared/grid/editing/useGridDraftEditing.ts
```

They keep only dirty fields:

```text
rowId + field → baseValue + current LOCAL value
```

No complete API response/block snapshots and no React Query row/original-value cache.

### Keep as runtime mechanics, not config

```text
first BASE capture
revert-to-BASE cleanup
dirty row/cell counts
selected ∩ dirty payload construction
safe save acknowledgement/rebase
SSRM LOCAL restoration
Discard → clear draft + authoritative refresh
```

### Do not restore old custom propagation flows

```text
Apply Last Edit
current-page Flow 1 / Flow 2
custom range-edit filtering
```

Native Cell Selection / Ctrl+D / Ctrl+Enter / Fill Handle cover the spreadsheet-style propagation requirement.

## Validation direction changed by spike

Future configurable validation declarations should be declarative rule data.

Runtime adapts them into native AG Grid validation:

```text
provided editor
→ runtime cellEditorParams.getValidationErrors

custom React/MUI editor
→ useGridCellEditor
→ getValidationErrors / getValidationElement

gridOptions.invalidEditValueMode = "block"
→ invalid value does not commit
→ invalid value does not become a dirty BASE+LOCAL draft
```

Do not serialize those callbacks into configuration.

The old concrete tracked-editing validation store is not automatically the configurable editing design.

## Conflict/concurrency status

The merged native-first spike deliberately has no REMOTE/conflict layer.

Do not automatically carry the previous BASE/LOCAL/REMOTE conflict machinery into configurable runtime. Concurrency/version/conflict semantics remain a separate later decision.

## Deliberately unsupported native examples

### `readOnlyEdit`

Not exposed yet because it changes the selected editing lifecycle:

```text
normal edit
→ AG Grid mutates value
→ cellValueChanged
→ BASE+LOCAL observer

readOnlyEdit=true
→ AG Grid does not mutate value
→ cellEditRequest
→ different runtime ownership/lifecycle
```

### Grouping/tree/pivot options

The initial configurable proof uses the flat SSRM backend request contract. Grouping, tree data, aggregation and pivot native options remain outside the normalized contract until their server request/response semantics are implemented.

These are examples of justified exclusions. "The current Transaction demo does not use it" is not by itself a justification.

## Filtering status

`filtering` remains custom because its persisted meaning is server-query support, not only AG Grid filter UI selection.

Current shared operator vocabulary remains bounded by backend semantics. Native filter presentation such as `floatingFilter` can stay native, while common server filter UX (`buttons`, `maxNumConditions`, `closeOnApply`, debounce/defaults as applicable) still needs the next normalized/default-merge design.

## Coverage snapshot

```text
FeatureDefinition                               DONE
EntityDefinition generic meaning                DONE
RowIdDefinition                                DONE
colId / field identity                         DONE
cellDataType native built-ins                  DONE current set
ConfigurableNativeColDefOptions                 DONE broad current pass
native cellEditor / cellRenderer                DONE
valueFormatter/valueParser registry keys        DONE direction
filtering/filterOptions core                    DONE
ConfigurableSsrmGridOptions                     DONE broad current pass
ConfigurableSsrmRowSelectionOptions             DONE flat-SSRM pass
cellSelection / native editing grid props       DONE
PR #42 editing architecture review              DONE
backend/store → normalize → compile boundary    DONE DIRECTION
portable hierarchy + curated docs               UPDATED
TypeDoc + Markdown tooling                      CONFIGURED
generated TypeDoc for latest public types       NEEDS REGENERATION

application/entity grid-option merge runtime    NEXT
filter defaults + field filter merge            NEXT
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

## Exact resume point for the next chat

Do **not** reopen the removed `editing.editor/parser` wrapper design unless a concrete AG Grid limitation is discovered.

Resume with one coherent compiler/defaults batch:

1. inspect the latest branch and merged PR state again;
2. define application configurable-SSRM defaults and exact `entity.gridOptions` merge semantics;
3. define nested merge behavior for `defaultColDef`, `cellSelection`, and `rowSelection`;
4. design common server Simple Filter defaults and their merge with `field.filtering.filterOptions`;
5. define frontend registration/validation for native `cellEditor` / `cellRenderer` string names;
6. type formatter/parser registries using real AG Grid `valueFormatter` / `valueParser` function contracts;
7. define compiler output classification: native pass-through vs registry-resolved vs runtime-owned;
8. preserve mandatory backend/storage normalization.

Then design configurable validation rules adapted into AG Grid native validation lifecycle, followed by server query/search, save mapping, access/security/masking and runtime compiler layers.

## Validation/testing status

The latest configurable source/JSDoc/docs changes were written directly on `configurable-feature-grid` through GitHub. Full lint/typecheck/unit/build have **not** been executed on these new commits in this chat. Do not claim them green until the exact head is validated.

Regenerate source-derived docs after pulling:

```bash
npm run docs:configurable
```
