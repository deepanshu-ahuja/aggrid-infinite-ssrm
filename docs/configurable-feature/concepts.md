# Configurable Feature Concepts

Plain-language meanings for the public configuration concepts already designed.

```text
Feature definition
→ overall configurable business feature.

Entity definition
→ configuration for one data context inside a feature, such as Loan or Finance.

Data adapter
→ frontend data/API boundary for loading, saving, and request/response mapping needed by those operations.

Row identity
→ API row field/path containing the stable business-record ID.

Field definition
→ configuration for one data field/column.

Field ID
→ stable configuration identity, separate from the API row path.

Field path
→ actual value location in the API row, e.g. `amount` or `financials.amount`.

Translation key
→ reference used to resolve displayed text.

Field data type
→ semantic value category: text, number, boolean, date, or date-time.

Field defaults
→ common configurable settings for an entity's fields; compiled into AG Grid `defaultColDef` on top of shared grid defaults.

Field layout
→ initial visibility/pinning/sizing plus continuing size constraints.

Initial field setting
→ seeds column state when created; it does not keep overwriting later user/Grid-State changes.

Field filter
→ optional field filtering capability plus the exact allowed operators.

Filter operator
→ stable key for an allowed filter operation such as `contains`, `equals`, or `greaterThan`.

Formatter
→ registered value-presentation behavior selected by a key; compiled to AG Grid `valueFormatter`.

Renderer
→ registered rich cell UI selected by a key; compiled to AG Grid `cellRenderer`.

Configuration params
→ JSON-safe data passed to registered behavior; executable functions/components stay frontend-owned.
```

## Default relationship

```text
shared baseDefaultColDef
        +
entity.fieldDefaults
        ↓
AG Grid defaultColDef
        ↓
individual compiled field ColDef overrides matching defaults
```

`fieldDefaults` is not an unrestricted AG Grid `ColDef`; it exposes only supported configurable options.

## Example

```ts
{
  id: "loanAmount",
  field: "financials.amount",
  labelKey: "review.fields.loanAmount.label",
  dataType: "number",
  filter: { operators: ["equals", "greaterThan", "lessThan"] },
  layout: {
    sizing: { initialWidth: 180, minWidth: 140, maxWidth: 300 },
  },
  formatter: {
    key: "currency",
    params: { currencyField: "currency" },
  },
}
```

```text
field.id   → stable configuration identity
field.field → API row value location
formatter  → value presentation
renderer   → richer cell UI
```

Formatter/renderer are separate from editing, validation, business actions, access control, server query mapping, and save mapping.
