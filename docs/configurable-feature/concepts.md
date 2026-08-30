# Configurable Feature Concepts

Plain-language meanings for public configuration concepts already designed.

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

Formatter
→ registered value-presentation behavior; compiled to AG Grid `valueFormatter`.

Renderer
→ registered rich cell UI; compiled to AG Grid `cellRenderer`.

Editing capability
→ says a field may be edited; actual row/cell editability still depends on current access, row policy and conflict state.

Editor
→ editing UI for a field. If no custom editor is selected, AG Grid can use its normal data-type editor.

Value parser
→ converts an editor/import candidate into the LOCAL draft value; compiled to AG Grid `valueParser`.

Configuration params
→ JSON-safe data passed to registered behavior; executable functions/components remain frontend-owned.
```

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

## Field value flow

```text
authoritative API value
        ↓
effective grid value (API or unsaved LOCAL draft)
        ↓
formatter → displayed value
        ↓
editor → edit candidate
        ↓
parser → LOCAL draft value
        ↓
validation
        ↓
save mapping → backend payload   [designed later]
```

The formatter and renderer affect presentation, not stable field identity or backend save/query meaning. The parser is not a universal normalizer because programmatic edits can bypass AG Grid `valueParser`.

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
  dataType: "date",
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

Editing, validation, business actions, access control, server query mapping and save mapping remain distinct responsibilities even when they all reference the same stable field ID.
