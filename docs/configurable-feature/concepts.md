# Configurable Feature Concepts

Plain-language meanings for public configuration concepts already designed.

For the visual type tree and exact AG Grid mapping, see `type-hierarchy.md`.

```text
Feature definition
→ overall configurable business feature.

Entity definition
→ one data context inside a feature, such as Loan or Finance.

Data adapter
→ frontend data/API boundary for loading, saving and request/response mapping.

Row identity
→ API row field/path containing the stable business-record ID.

Field definition
→ configuration for one data field/column.

Field ID
→ stable configuration identity, separate from the API row path.

Field path
→ actual value location in the API row.

Field defaults
→ common settings for an entity's fields; compiled into AG Grid `defaultColDef`.

Initial field setting
→ seeds column state when created without continuously overriding later user/Grid-State changes.

Data type
→ value type/representation compiled explicitly to AG Grid `cellDataType`; AG Grid's native type behavior is the baseline.

Formatter
→ optional registered display override; compiled to AG Grid `valueFormatter` when native `cellDataType` formatting is not sufficient.

Renderer
→ optional registered rich cell UI; compiled to AG Grid `cellRenderer` when native rendering is not sufficient.

Editing capability
→ says a field may be edited; actual row/cell editability still depends on current access, row policy and conflict state.

Editor
→ editing UI for a field. If no custom editor is selected, AG Grid can use the editor supplied by the field's `cellDataType`.

Value parser
→ optional registered override of AG Grid `valueParser`; converts an editor/import candidate into the LOCAL draft value when custom conversion is required.

Configuration params
→ extra JSON-safe configuration supplied to a registered behavior; do not duplicate runtime values AG Grid already supplies.
```

## Native-first rule

```text
field.dataType
        ↓
explicit AG Grid cellDataType
        ↓
AG Grid native parser / formatter / editor / renderer / filter behavior
        ↓
custom field configuration overrides only when product behavior requires it
```

The configurable proof uses SSRM, so `cellDataType` must be set explicitly; AG Grid type inference is Client-Side Row Model only.

Current supported values intentionally distinguish Date objects from strings:

```text
text
number
boolean
date           → JavaScript Date
dateString     → string date, such as "2026-08-30"
dateTime       → JavaScript Date
dateTimeString → string date-time
```

This matters for JSON APIs. A field carrying an ISO date string should normally use `dateString`, not `date`.

## Defaults

```text
shared baseDefaultColDef
        +
entity.fieldDefaults
        ↓
AG Grid defaultColDef
        ↓
individual compiled field ColDef overrides matching defaults
```

## Params and AG Grid

Renderer/editor params map directly to AG Grid component-param mechanisms:

```text
renderer.params → cellRendererParams
editor.params   → cellEditorParams
```

AG Grid still supplies normal component runtime props such as value, row data, node, column and API. Custom configuration params are only the extra information our component needs.

Formatter/parser params are slightly different: AG Grid supplies `ValueFormatterParams` / `ValueParserParams` to the callbacks, and our compiler combines those callback params with our JSON-safe configured params before calling the registered function.

## Field value flow

```text
authoritative API value
        ↓
effective grid value (API or unsaved LOCAL draft)
        ↓
AG Grid cellDataType baseline behavior
        ↓
optional custom formatter / renderer → displayed cell
        ↓
editor (AG Grid provided or custom input)
        ↓
optional custom parser override
        ↓
LOCAL draft value
        ↓
validation
        ↓
save mapping → backend payload   [designed later]
```

Omitting a custom parser does not mean "leave the candidate unchanged". The parser supplied by AG Grid's `cellDataType` can still apply. Likewise, omitting a custom renderer does not always mean plain text; for example AG Grid's boolean cell type provides checkbox rendering.

The formatter and renderer affect presentation, not stable field identity or backend save/query meaning. A custom parser is not a universal normalizer because programmatic edits can bypass AG Grid `valueParser`.

## Stable edit identity

```text
field.id
→ key used by configurable edit/conflict/validation state

field.field
→ API row path used to read/write the actual row value
```

These may be identical for simple models but the reusable contract must not require that.

## Example

```ts
{
  id: "transactionDate",
  field: "transactionDate",
  labelKey: "review.fields.transactionDate.label",
  dataType: "dateString",
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

The example uses `dateString` because a normal JSON API date is a string. The custom formatter/editor are optional overrides; if AG Grid's native date-string presentation/editor were sufficient, they should be omitted.

Editing, validation, business actions, access control, server query mapping and save mapping remain distinct responsibilities even when they all reference the same stable field ID.
