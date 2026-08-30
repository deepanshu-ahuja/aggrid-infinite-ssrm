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

Field definition
→ configuration for one data field/column.

colId
→ stable AG Grid Column ID and application field identity used for Grid State/API/edit-conflict-validation identity.

field
→ actual value path in the normalized API row; may differ from colId.

defaultColDef
→ supported entity-wide native column defaults merged with the application's baseDefaultColDef.

cellDataType
→ AG Grid value type/representation. The name and compatible type deliberately follow ColDef.cellDataType.

filtering
→ application/server-query capability descriptor. It is intentionally not named filter because AG Grid ColDef.filter has different value semantics.

filterOptions
→ exact AG Grid Simple Filter choices allowed for the field; maps to filterParams.filterOptions.

formatter / renderer / editor / parser
→ optional registry-backed executable overrides used only when native AG Grid behavior is not sufficient.
```

## Where Transaction/Loan identity actually lives

The business entity name comes from the `FeatureDefinition.entities` record key:

```text
Review feature
├── "transaction" → EntityDefinition
└── "loan"        → EntityDefinition
```

A TypeDoc heading such as:

```text
EntityDefinition<TLabelKey, TFieldDefinition>
```

only describes TypeScript constraints. `TLabelKey` narrows translation keys and `TFieldDefinition` narrows the field shape. Neither generic parameter identifies the business entity.

## Frontend-designed, backend-stored configuration

The long-term persistence flow is:

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
compiler/registries
        ↓
AG Grid
```

Normalization remains even when backend/storage keys exactly match the normalized frontend/AG Grid-aligned names. Matching names only make the transformation simple.

If backend naming changes later, map it once at the same boundary:

```text
backend "columnDefaults"
→ normalizer
→ frontend defaultColDef
→ compiler
```

Grid/compiler code must not contain scattered checks for historical/current backend property names.

## Native AG Grid alignment

Use native AG Grid vocabulary when the concept **and the value semantics** are genuinely the same:

```text
same concept + same value semantics
→ same AG Grid property name where practical
→ reuse/derive AG Grid TypeScript type where practical
```

Examples currently aligned:

```text
colId
field
cellDataType
sortable
defaultColDef
initialHide
initialPinned
initialWidth
initialFlex
minWidth
maxWidth
resizable
filterOptions
cellRendererParams
cellEditorParams
cellEditorPopup
cellEditorPopupPosition
```

Custom vocabulary remains when the stored value is not actually the AG Grid value. For example:

```text
labelKey
→ translation key, not final headerName string

rowId: { path }
→ declarative path, not executable getRowId callback

formatter: { key, params }
→ registry descriptor, not valueFormatter function

filtering: { filterOptions }
→ server-supported filtering descriptor, not ColDef.filter value
```

## Column identity vs API binding

```text
colId
→ stable logical column identity
→ saved Grid State and AG Grid API identity
→ edit/conflict/validation identity

field
→ API row value path
```

Requiring explicit `colId` prevents a backend field-path rename from silently changing the logical column identity.

## Native layout/sizing leaves

There is no longer a custom `layout` or `sizing` wrapper. The normalized field uses the native leaves directly:

```text
initialHide
initialPinned
initialWidth
initialFlex
minWidth
maxWidth
resizable
```

The `initial*` properties seed a new column without repeatedly overwriting later user/Grid State changes. Persistent constraints such as min/max width and resizability continue to apply.

The configurable model follows AG Grid's native width/flex behavior rather than inventing a separate XOR sizing rule.

## Defaults and merging

```text
shared baseDefaultColDef
        +
entity.defaultColDef
        ↓
resolved AG Grid defaultColDef
        ↓
individual compiled field ColDef overrides
```

A future grid-level SSRM configuration surface should follow the same principle:

```text
frontend/application defaults
        +
normalized entity overrides
        ↓
resolved supported AG Grid options
```

## Declarative vs executable vs runtime-owned

```text
Native + JSON-safe AG Grid value
→ normalized config may carry it directly using AG Grid naming

Executable behavior
→ config stores a key (+ JSON-safe params where needed)
→ frontend registry resolves to real AG Grid-compatible code

Runtime/compiler infrastructure
→ frontend constructs it
→ do not treat it as arbitrary persisted configuration
```

Examples of runtime-owned values include `serverSideDatasource`, runtime `context`, compiled `columnDefs` and `GridApi` references.

## Filtering

```text
filtering omitted
→ field is not exposed as filterable by the configurable contract

filtering present
→ compiler enables the appropriate AG Grid filter
→ filterOptions become filterParams.filterOptions
```

Only operators supported by the active server-query/data-adapter/backend contract should be exposed.

## Params and AG Grid

```text
renderer.cellRendererParams
→ ColDef.cellRendererParams

editor.cellEditorParams
→ ColDef.cellEditorParams

editor.cellEditorPopup
→ ColDef.cellEditorPopup

editor.cellEditorPopupPosition
→ ColDef.cellEditorPopupPosition
```

Formatter/parser `params` remain application-specific because AG Grid has no direct `valueFormatterParams` / `valueParserParams` ColDef properties.

AG Grid still supplies its normal runtime callback/component params such as value, data, node, column and API.

## Field value flow

```text
authoritative API value
        ↓
effective grid value (API or LOCAL overlay)
        ↓
AG Grid cellDataType baseline behavior
        ↓
optional custom formatter / renderer
        ↓
editor (provided or custom)
        ↓
optional custom valueParser
        ↓
LOCAL draft
        ↓
validation
        ↓
save mapping → backend payload   [later]
```

A parser is not a universal normalizer; programmatic application-owned edits can bypass AG Grid `valueParser`.

## Example

```ts
{
  colId: "transactionDate",
  field: "transactionDate",
  labelKey: "review.fields.transactionDate.label",
  cellDataType: "dateString",
  initialWidth: 180,
  formatter: { key: "date" },
  editing: {
    editor: {
      key: "dateInput",
      cellEditorPopup: true,
      cellEditorPopupPosition: "under",
    },
  },
}
```

The custom formatter/editor are optional. If AG Grid's native `dateString` behavior is enough, omit them.
