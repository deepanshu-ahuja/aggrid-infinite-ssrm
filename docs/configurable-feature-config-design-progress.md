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

## Latest whole-contract audit — DONE for current field/grid batch

The previous contract was too custom around editing/rendering. It has been corrected after the merged native-first SSRM editing spike.

### Removed custom wrappers

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

### Native column/editing properties now stay native

Fields/defaults use `ConfigurableNativeColDefOptions`, including reviewed JSON-safe native properties such as:

```text
sortable
initialSort
initialSortIndex
sortingOrder
initialHide
initialPinned
initialWidth
initialFlex
minWidth
maxWidth
resizable
suppressSizeToFit
suppressAutoSize
suppressMovable
lockPosition
lockPinned
wrapText
autoHeight
wrapHeaderText
autoHeaderHeight
headerTooltip
tooltipField

editable
cellEditor
cellEditorParams
cellEditorPopup
cellEditorPopupPosition
singleClickEdit
useValueParserForImport
suppressPaste
suppressFillHandle

cellRenderer
cellRendererParams
```

`editable` and `suppressPaste` expose only their safe boolean branch; callback branches remain frontend-owned.

`cellEditor` / `cellRenderer` are native because AG Grid supports provided/registered component names as strings. Frontend runtime owns the actual custom component implementations/registration.

### Executable parser/formatter stay safe

```text
valueFormatterKey
valueFormatterConfig
valueParserKey
valueParserConfig
```

These are explicit application descriptors because AG Grid's actual `valueFormatter` / `valueParser` values are executable functions/expressions.

Raw AG Grid expression strings are not accepted from backend configuration.

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

## Grid-level native configuration — NOW PRESENT

`EntityDefinition` now has:

```text
gridOptions?: ConfigurableSsrmGridOptions
```

`defaultColDef` moved under `gridOptions` because it is itself a native GridOptions property.

Current reviewed grid-level native surface includes:

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

`ConfigurableCellSelectionOptions` supports the JSON-safe native range/fill configuration, including Fill Handle direction and `suppressClearOnFillReduction`. Executable `setFillValue` is deliberately excluded.

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
```

`CellSelectionModule` and `ClipboardModule` are required runtime/bundle capabilities for the corresponding native features, not backend JSON.

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

## Deliberately unsupported native option

`readOnlyEdit` is intentionally not exposed yet.

Reason:

```text
normal edit architecture
→ AG Grid mutates value
→ cellValueChanged
→ BASE+LOCAL observer

readOnlyEdit=true
→ AG Grid does not mutate value
→ cellEditRequest
→ different runtime ownership/lifecycle
```

Omit it until that alternate lifecycle is intentionally supported.

## Filtering status

`filtering` remains custom because its persisted meaning is server-query support, not only AG Grid filter UI selection.

Current shared operator vocabulary remains bounded by backend semantics. Common server filter UX (`buttons`, `maxNumConditions`, `closeOnApply`, debounce/defaults as applicable) still needs a final normalized/default-merge design.

## Coverage snapshot

```text
FeatureDefinition                               DONE
EntityDefinition generic meaning                DONE
RowIdDefinition                                DONE
colId / field identity                         DONE
cellDataType native built-ins                  DONE current set
ConfigurableNativeColDefOptions                 DONE current reviewed set
native cellEditor / cellRenderer                DONE
valueFormatter/valueParser registry keys        DONE direction
filtering/filterOptions core                    DONE
ConfigurableSsrmGridOptions                     DONE current reviewed set
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
3. define nested merge behavior for `defaultColDef` and `cellSelection`;
4. design common server Simple Filter defaults and their merge with `field.filtering.filterOptions`;
5. define frontend registration/validation for native `cellEditor` / `cellRenderer` string names;
6. type formatter/parser registries using real AG Grid `valueFormatter` / `valueParser` function contracts;
7. define the compiler output classification: native pass-through vs registry-resolved vs runtime-owned;
8. preserve mandatory backend/storage normalization.

Then design configurable validation rules adapted into AG Grid native validation lifecycle, followed by server query/search, save mapping, access/security/masking and runtime compiler layers.

## Validation/testing status

The latest configurable source/JSDoc/docs changes were written directly on `configurable-feature-grid` through GitHub. Full lint/typecheck/unit/build have **not** been executed on these new commits in this chat. Do not claim them green until the exact head is validated.

Regenerate source-derived docs after pulling:

```bash
npm run docs:configurable
```
