# Configurable Feature Concepts

This page gives the short, plain-language meaning of configuration terms before the detailed interface reference.

## Current concepts

```text
Feature definition
→ overall configurable business feature.

Entity definition
→ configuration for one data context inside a feature, such as Loan or Finance.

Data adapter
→ frontend data/API boundary used for loading, saving, and the request/response mapping required by those operations.

Row identity
→ field/path in an API row that contains the stable unique ID for that business record.

Field defaults
→ optional entity-level defaults for fields. They compile into AG Grid `defaultColDef` on top of the shared grid defaults; individual fields override matching defaults through normal AG Grid column-definition precedence.

Field definition
→ configuration for one field/column, including stable identity, API row path, label, semantic data type, sorting/filtering capability, and optional layout/sizing.

Field ID
→ stable configuration identity for a field. It is not the same thing as the API row path.

Field path
→ location of the actual field value in the API row, such as `amount` or `financials.amount`.

Translation key
→ reference used to resolve displayed text such as an entity or field label.

Field data type
→ semantic value category such as text, number, boolean, date, or date-time. It determines the shared base filter-operator vocabulary appropriate for the field.

Field filter
→ optional configuration that makes a field filterable and lists every operator the user may apply to that field.

Filter operator
→ stable data key describing one allowed filter operation, such as `contains`, `equals`, or `greaterThan`. A feature-specific operator needs a registered query/backend meaning; the string itself is not executable behavior.

Field layout
→ initial visibility, initial pinning, and sizing behavior for a field. Initial values seed column state; they do not keep forcing the state after user/Grid State changes.
```

## Default-column relationship

The configurable design intentionally follows AG Grid's own `defaultColDef` + `columnDefs` model:

```text
shared baseDefaultColDef
        +
entity.fieldDefaults
        ↓
resolved AG Grid defaultColDef

entity.fields[]
        ↓
AG Grid columnDefs[]

columnDefs value for a property
→ overrides the corresponding defaultColDef value
```

Example:

```text
shared baseDefaultColDef
  minWidth: 120
  resizable: true
  sortable: true

entity.fieldDefaults
  layout.sizing.minWidth: 140

Loan Amount field
  sortable: false
  layout.sizing.minWidth: 180

resolved behavior
  Loan Amount minWidth: 180
  Loan Amount resizable: true
  Loan Amount sortable: false
```

## Initial layout naming

The public field layout uses `initial*` names because these values describe initial column state:

```text
layout.initialVisible
→ AG Grid initialHide (inverse boolean)

layout.initialPinned
→ AG Grid initialPinned

layout.sizing.initialWidth
→ AG Grid initialWidth

layout.sizing.initialFlex
→ AG Grid initialFlex
```

`initialWidth` and `initialFlex` are mutually exclusive. Frontend-authored TypeScript prevents both at once; backend JSON must be rejected by runtime configuration validation if it contains an invalid combination.

More terms are added here only when their contracts are actually designed. Renderer/editor/validation/action/access details should not be documented as settled concepts before their interfaces are reviewed.
