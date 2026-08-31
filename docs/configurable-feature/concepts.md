# Configurable Feature Concepts

Plain-language meanings for the configurable feature/grid model and the first implemented configurable SSRM runtime.

For the visual type tree and AG Grid mapping, see [`type-hierarchy.md`](type-hierarchy.md). For current implemented runtime truth, see [`../implementation/configurable-ssrm.md`](../implementation/configurable-ssrm.md).

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
→ API row field/path containing the stable business-record ID; runtime code compiles it into AG Grid getRowId and the draft row-ID accessor.

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
backend response (`unknown`)
        ↓
validate + normalize/adapt ALWAYS
        ↓
normalized frontend config
        ↓
application defaults + deterministic merge
        ↓
compiler/registries/runtime policy
        ↓
AG Grid
```

Normalization does not disappear when backend/storage keys happen to match normalized frontend keys. TypeScript cannot validate runtime backend JSON.

The implemented normalizer rejects unsupported members and executable/non-JSON values before compilation. It also validates the currently exposed native union/enum branches, type-specific filter options, the one-condition server-filter contract, selection branches and duplicate column IDs.

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

## Application defaults are runtime policy, not backend metadata

The configurable SSRM path has frontend-owned application defaults. They reuse the repository's existing server-backed pagination/cache defaults, set native invalid-edit handling to `block`, establish the default native selection/Cell Selection shape, and provide common Simple Filter Apply/Reset params.

Crucially, configurable `defaultColDef` explicitly starts with:

```text
sortable = false
filter = false
```

The application-wide AG Grid defaults are broader. A configurable server-backed grid must not inherit global sorting/filtering automatically because that could expose server operations the active data adapter never declared. A field explicitly opts into those native capabilities only when the feature adapter/backend can execute the same semantics.

## Filters stay native, server semantics stay authoritative

The previous application `filtering` wrapper is gone.

The normalized field looks like the real SSRM columns:

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

The first Transaction configurable consumer still uses `mapTransactionGridRequest`. The shared compiler does not translate arbitrary configured `colId`/`field` values directly into backend query instructions.

## Why editor/filter/renderer names can stay native

AG Grid supports provided/registered components by string name:

```ts
{
  filter: 'agTextColumnFilter',
  cellEditor: 'transactionAccountEditor',
  cellRenderer: 'statusChip',
}
```

Frontend runtime owns the actual components and validates configured names against explicit allowlists.

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

Application row/access policy is composed into the final native `editable` callback rather than rebuilt separately for every range operation. That same callback is consulted by native single-cell editing, Cell Selection editing, Fill Handle and paste behavior.

## Validation rules are config; callbacks are runtime

The configurable field uses `validationRules` based on the repository's proven `GridValidationRule` shape:

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

The current configurable consumer uses provided AG Grid editors. The compiler preserves static configured editor params and adds runtime `getValidationErrors`; `invalidEditValueMode: 'block'` prevents invalid input from committing into draft state.

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

The configurable Transaction root composes the same `useGridDraftEditing` observer and restores LOCAL values after SSRM RowNode/store recreation. It does not copy the Transaction native-editing spike.

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

Exact merge behavior is now implemented:

```text
top-level scalar / array
→ entity value replaces default

defaultColDef
→ merge
→ nested filter/editor/renderer params merge

rowSelection
→ merge only within same native mode
→ mode change replaces branch

cellSelection
→ boolean replacement or object merge
→ range/fill handle mode change replaces branch

field
→ overrides resolved defaultColDef
→ nested static params merge
```

Arrays replace; they are not concatenated.

## First real configurable consumer

The isolated `/configurable-ssrm` route is the first real consumer of this contract.

Its raw Transaction definition is intentionally typed `unknown` and immediately passed through runtime normalization, even though it currently lives in frontend source. That forces the same trust boundary a future backend response must use.

Feature/runtime ownership stays explicit:

```text
configurable metadata
→ native grid/column behavior

Transaction data adapter
→ existing listTransactions + mapTransactionGridRequest

Transaction row policy
→ existing row/cell eligibility callbacks

frontend registries
→ custom renderers / formatter / parser / validators

concrete configurable SSRM root
→ datasource/modules/GridApi/lifecycle
```

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

## Current deliberate limits

The foundation route does not yet implement configurable read/write/save mapping, business actions, access/security/masking metadata, Grid State/access reconciliation, runtime config schema/version negotiation, grouping/tree/pivot/aggregation, or concurrency/conflict/versioning.

Those remain separate contracts rather than speculative properties added to the current metadata surface.
