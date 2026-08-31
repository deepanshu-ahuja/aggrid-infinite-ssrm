# Configurable Feature Concepts

Plain-language meanings for the configurable feature/grid model.

For the visual type tree and AG Grid mapping, see [`type-hierarchy.md`](type-hierarchy.md).

```text
Feature definition
→ overall configurable business feature.

Entity key
→ stable business/configuration identity inside a feature, e.g. "transaction" or "loan".

Entity definition
→ reusable configuration for one data context; the shared type itself does not hard-code Transaction, Loan, Finance, etc.

Data adapter
→ frontend data/API boundary for normalization, loading, saving and request/response mapping.

Row identity
→ API row field/path containing the stable business-record ID; runtime code uses it to build AG Grid getRowId behavior.

Grid options
→ bounded JSON-safe native AG Grid options for the configurable SSRM root.

Field definition
→ one normalized field/column definition, using native ColDef names wherever the stored value has native semantics.

colId
→ stable AG Grid Column ID and application field identity used for Grid State/API/draft/validation identity.

field
→ actual value path in the normalized API row; may differ from colId.

filter / filterParams
→ native AG Grid filter configuration, narrowed so the active server adapter can actually execute the emitted model semantics.

validationRules
→ declarative application rules resolved by the frontend validator registry and adapted into native AG Grid editor validation.

valueFormatterKey / valueParserKey
→ safe frontend registry selectors for executable AG Grid functions.
```

## Where Transaction/Loan identity lives

The business entity name comes from the `FeatureDefinition.entities` record key:

```text
Review feature
├── "transaction" → EntityDefinition
└── "loan"        → EntityDefinition
```

A TypeDoc heading such as `EntityDefinition<TLabelKey, TFieldDefinition>` only describes TypeScript constraints. It does not somehow identify a Transaction.

## Frontend-designed, backend-stored configuration

```text
frontend-supported config design
        ↓
may be stored/managed by backend/database
        ↓
backend response
        ↓
validate + normalize/adapt ALWAYS
        ↓
normalized frontend config
        ↓
compiler/registries/runtime policy
        ↓
AG Grid
```

Normalization does not disappear when backend/storage keys happen to match normalized frontend keys.

## Native AG Grid alignment

Use native AG Grid vocabulary when the concept **and persisted value semantics** are the same:

```text
same concept + same value semantics
→ same AG Grid property name
→ reuse/derive AG Grid TypeScript type
```

At type level:

```text
precise exported type
→ use directly

reviewed native property set
→ Pick<AGGridType, ReviewedKeys>

native union contains callback + data
→ Extract safe data branch

nested native object contains one executable member
→ Omit only that member
```

Do not hand-copy dozens of `ColDef['key']` / `GridOptions['key']` properties when `Pick` describes the supported surface more clearly. Do not use one broad top-level `Omit` that could accidentally expose future AG Grid callbacks after an upgrade.

## Native column properties

Examples include:

```text
type
colId
field
cellDataType
sortable
initialWidth / initialFlex
initialPinned / initialHide
filter / filterParams
editable
cellEditor / cellEditorParams
cellEditorPopup / cellEditorPopupPosition
cellRenderer / cellRendererParams
suppressPaste / suppressFillHandle
useValueParserForImport
useValueFormatterForExport
```

`defaultColDef` lives inside `entity.gridOptions` because AG Grid itself defines it as a `GridOptions` property.

## Filters stay native, server semantics stay authoritative

The previous application `filtering` wrapper is gone.

The normalized field now looks like the real SSRM columns:

```ts
{
  filter: 'agTextColumnFilter',
  filterParams: {
    buttons: ['reset', 'apply'],
    maxNumConditions: 1,
    closeOnApply: true,
    filterOptions: ['contains', 'equals'],
  },
}
```

AG Grid owns the property names and filter-param types. The data adapter/backend still owns what those models mean on the server.

Current operator keys derive from `ISimpleFilterModelType` and are narrowed to supported server semantics.

```text
Text       → contains / equals / notEqual / startsWith / endsWith
Number     → equals / notEqual / greaterThan / greaterThanOrEqual / lessThan / lessThanOrEqual
BigInt     → same as Number
Date/time  → equals / notEqual / lessThan / greaterThan
Boolean    → equals / notEqual
```

JSON-safe is not enough by itself. A native filter option that changes server semantics but is not represented by the active filter model/backend contract stays excluded until the adapter owns that meaning.

Current filter-param derivation therefore uses AG Grid `ITextFilterParams`, `INumberFilterParams`, `IBigIntFilterParams` and `IDateFilterParams`, but deliberately excludes callback and unsupported semantic members.

## Why editor/filter/renderer names can stay native

AG Grid supports provided/registered components by string name:

```ts
{
  filter: 'agTextColumnFilter',
  cellEditor: 'transactionAccountEditor',
  cellRenderer: 'statusChip',
}
```

Frontend runtime owns the actual components and validates configured names.

This is why custom wrappers such as `editing.editor.key` or `renderer.key` are unnecessary.

## Why parser/formatter still need registry keys

AG Grid `valueParser` / `valueFormatter` string values are executable expressions, not component-registration names.

Backend JSON therefore does not carry raw expressions:

```text
valueParserKey
→ frontend registry
→ real AG Grid valueParser

valueFormatterKey
→ frontend registry
→ real AG Grid valueFormatter
```

`RegisteredValueParser` / `RegisteredValueFormatter` use the actual AG Grid function branches for registry typing.

## Native-first editing from `/ssrm-native-editing`

The merged native-editing reference establishes this interaction flow:

```text
normal edit
Cell Selection
Ctrl/Cmd+D
Ctrl/Cmd+Enter
Fill Handle
clipboard/paste
        ↓
AG Grid applies editable rules + editor validation
        ↓
cellValueChanged for committed changes
```

We do not configure replacements such as Apply Last Edit/current-page Flow 1/Flow 2.

Native grid/column configuration drives those capabilities:

```text
gridOptions.cellSelection
gridOptions.invalidEditValueMode
gridOptions.suppressClipboardPaste
field.editable
field.suppressPaste
field.suppressFillHandle
```

Application row/access policy is composed into native `editable` behavior rather than rebuilt separately for every range operation.

## Validation rules are config; callbacks are runtime

The configurable field now has `validationRules` based on the repository's proven `GridValidationRule` shape:

```ts
validationRules: [
  { key: 'required', message: 'Account is required.' },
  {
    key: 'maxLength',
    params: { max: 100 },
    message: 'Account must be 100 characters or fewer.',
  },
]
```

Config params are JSON-safe. Rule keys select frontend validator functions.

Runtime adapts rule results into AG Grid:

```text
provided editor
→ cellEditorParams.getValidationErrors

custom React/MUI editor
→ useGridCellEditor
→ getValidationErrors / getValidationElement
```

`invalidEditValueMode: 'block'` prevents invalid input from committing into draft state.

## Lightweight draft editing is runtime infrastructure

The merged spike's generic draft state keeps only genuinely dirty fields:

```text
rowId
└── field
    ├── baseValue
    └── value
```

These are runtime/shared mechanics, not backend metadata:

```text
first BASE capture
LOCAL value tracking
revert-to-BASE cleanup
dirty row/cell counts
selected ∩ dirty payload construction
safe save acknowledgement/rebase
SSRM LOCAL restore
Discard → clear draft + authoritative refresh
```

Do not copy complete API responses/SSRM blocks into React state and do not add a React Query original-row cache for this purpose.

The previous REMOTE/conflict layer is not automatically part of configurable editing. Concurrency/conflict/versioning remains a separate product decision.

## Grid-level config vs runtime-owned props

Configurable native examples:

```text
pagination
paginationPageSize
cacheBlockSize
rowSelection
cellSelection
invalidEditValueMode
undoRedoCellEditing
rowHeight
```

Runtime-owned examples:

```text
modules
rowModelType
serverSideDatasource
columnDefs
context
getRowId callback
event handlers
GridApi refs
getRowClass / rowClassRules
isRowSelectable
```

`CellSelectionModule` and `ClipboardModule` are runtime/bundle capabilities, not backend metadata.

## Row selection for the current flat SSRM runtime

The type derives from native `GridOptions['rowSelection']`.

```text
singleRow | multiRow
static checkboxes
headerCheckbox
ctrlASelectsRows
selectAll = all
```

`isRowSelectable` remains application business policy.

`groupSelects` is not exposed merely to store `'self'`; it belongs with a future real grouping capability.

AG Grid's `filtered` / `currentPage` native select-all values are not valid SSRM semantics. The repository's All Filtered / Current Page behavior remains application-owned.

## Defaults and merging

```text
application configurable-SSRM defaults
        +
entity.gridOptions overrides
        ↓
resolved GridOptions
```

Then:

```text
resolved gridOptions.defaultColDef
        +
individual FieldDefinition properties
        ↓
final ColDef
```

The compiler/normalizer must define exact nested merge behavior, especially for `filterParams`, `rowSelection`, `cellSelection`, static editor params, and runtime validation callbacks.

## Example

```ts
{
  colId: 'amount',
  field: 'amount',
  labelKey: 'review.fields.amount.label',
  cellDataType: 'number',
  type: 'numericColumn',
  minWidth: 140,
  filter: 'agNumberColumnFilter',
  filterParams: {
    filterOptions: ['equals', 'greaterThan', 'lessThan'],
  },
  editable: true,
  cellEditor: 'agNumberCellEditor',
  cellEditorParams: {
    min: 0,
    max: 1000000,
  },
  validationRules: [
    {
      key: 'numberRange',
      params: { min: 0, max: 1000000 },
      message: 'Amount must be between 0 and 1,000,000.',
    },
  ],
  valueFormatterKey: 'currency',
}
```

Entity grid behavior remains native too:

```ts
{
  gridOptions: {
    invalidEditValueMode: 'block',
    cellSelection: {
      enableHeaderHighlight: true,
      handle: { mode: 'fill', direction: 'y' },
    },
  },
}
```

Both objects still pass through runtime validation/normalization before compilation.
