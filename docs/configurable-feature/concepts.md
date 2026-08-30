# Configurable Feature Concepts

Plain-language meanings for the configurable feature/grid model.

For the visual type tree and AG Grid mapping, see [`type-hierarchy.md`](type-hierarchy.md).

```text
Feature definition
→ overall configurable business feature.

Entity definition
→ one data context inside a feature, such as Loan or Finance.

Data adapter
→ frontend data/API boundary for configuration/data normalization, loading, saving and request/response mapping.

Row identity
→ API row field/path containing the stable business-record ID.

Field definition
→ configuration for one data field/column.

Field ID
→ stable configuration identity, separate from the API row path.

Field path
→ actual value location in the normalized API row.

Field defaults
→ common settings for an entity's fields; compiled into AG Grid `defaultColDef`.

cellDataType
→ AG Grid value type/representation. The name and compatible type deliberately follow `ColDef.cellDataType`.

Filter options
→ exact AG Grid Simple Filter choices allowed for a filterable field; named after AG Grid `filterParams.filterOptions`.

Formatter / renderer / editor / parser
→ optional registered executable overrides used only when native AG Grid behavior is not sufficient.

Configuration params
→ extra JSON-safe information for registered behavior; AG Grid's normal runtime params are not duplicated here.
```

## Frontend-authored, backend-stored configuration

The long-term persistence flow is:

```text
frontend-supported config design
        ↓
stored/managed by backend/database
        ↓
backend response
        ↓
validate + normalize
        ↓
frontend compiler/registries
        ↓
AG Grid
```

The normalization boundary **always remains**, even when backend/storage keys happen to match the normalized frontend/AG Grid-aligned names exactly. Matching names simply make normalization close to an identity transform; they do not make raw runtime data trusted frontend configuration.

The backend storage/wire shape does not have to stay identical to the frontend normalized shape. If it differs, transform at the same boundary. Do not scatter backend-key checks throughout the table.

A backend property that the current frontend does not read/normalize/compile has no effect. Raw backend JSON is never spread blindly into `AgGridReact`.

## Native AG Grid alignment

When our configuration means the same thing AG Grid means:

```text
same concept
→ same AG Grid name where practical
→ reuse/derive AG Grid TypeScript type where practical
→ no pointless rename-and-map layer
```

Examples already aligned:

```text
cellDataType
sortable
filterOptions
initialHide
initialPinned
initialWidth
initialFlex
minWidth
maxWidth
resizable
```

Our own vocabulary remains for genuinely application-specific concepts such as `featureKey`, `dataAdapterKey`, `fieldDefaults`, registry keys, access/masking and backend save/query mapping.

## Declarative vs executable vs runtime-owned

```text
Native + JSON-safe AG Grid option
→ normalized config may carry it directly using AG Grid naming

Executable behavior
→ config stores a key (+ JSON-safe params when needed)
→ frontend registry resolves to the real AG Grid-compatible function/component

Runtime/compiler infrastructure
→ frontend constructs it
→ do not treat it as arbitrary persisted config
```

For example, a future configurable `onCellClicked` behavior may use a key if a real use case requires it, while `serverSideDatasource`, runtime `context` and compiled `columnDefs` remain frontend-built infrastructure.

## Native-first field behavior

```text
field.cellDataType
        ↓
AG Grid native parser / formatter / editor / renderer / filter behavior
        ↓
custom field config only when product behavior requires it
```

The configurable proof uses SSRM, so `cellDataType` is set explicitly; AG Grid inference is Client-Side Row Model only.

Current values distinguish Date objects from strings:

```text
text
number
boolean
date           → JavaScript Date
dateString     → string date, e.g. "2026-08-30"
dateTime       → JavaScript Date
dateTimeString → string date-time
```

## Defaults and merging

Current column-default relationship:

```text
shared baseDefaultColDef
        +
entity.fieldDefaults
        ↓
AG Grid defaultColDef
        ↓
individual compiled field ColDef overrides
```

A future table/grid-level SSRM configuration surface should follow the same idea:

```text
frontend/application defaults
        +
normalized entity overrides
        ↓
resolved supported AG Grid options
```

The schema should not be limited to only the handful of pagination/cache properties used by today's Transaction demo. It should support a broad reviewed declarative AG Grid surface while excluding executable/runtime-owned properties from raw persistence.

## Params and AG Grid

```text
renderer.params → cellRendererParams
editor.params   → cellEditorParams
```

AG Grid still supplies its normal runtime props such as value, data, node, column and API.

Formatter/parser params are compiler-owned extras combined with AG Grid `ValueFormatterParams` / `ValueParserParams` before calling the registered implementation.

Registry implementations should use the real AG Grid callback/component types where practical rather than parallel signatures invented by us.

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

## Stable edit identity

```text
field.id
→ configurable edit/conflict/validation identity

field.field
→ row/API value path
```

## Example

```ts
{
  id: "transactionDate",
  field: "transactionDate",
  labelKey: "review.fields.transactionDate.label",
  cellDataType: "dateString",
  layout: {
    sizing: { initialWidth: 180 },
  },
  formatter: { key: "date" },
  editing: {
    editor: {
      key: "dateInput",
      popup: true,
      popupPosition: "under",
    },
  },
}
```

The custom formatter/editor are optional overrides. If AG Grid's native `dateString` behavior is enough, omit them.
