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

Field definition
→ configuration for one field/column, including stable identity, API binding, label, semantic data type, filtering/sorting, and optional layout defaults.

Field ID
→ stable configuration identity for a field. It is not the same thing as the API row path.

Field path
→ location of the actual field value in the API row, such as `amount` or `financials.amount`.

Translation key
→ reference used to resolve displayed text such as an entity or field label.

Field data type
→ semantic value category such as text, number, boolean, date, or date-time. It determines the shared base filter-operator vocabulary and can map to AG Grid cell-data-type behavior.

Field filter
→ optional configuration that makes a field filterable and lists every operator the user may apply to that field.

Filter operator
→ stable data key describing one allowed filter operation, such as `contains`, `equals`, or `greaterThan`. A feature-specific operator needs a registered query/backend meaning; the string itself is not executable behavior.

Field layout
→ optional starting column layout such as initial visibility, pinning, and sizing. These are defaults that user Grid State may later override, not security/access rules.

Initial width
→ starting fixed pixel width for a field. It maps to AG Grid `initialWidth` so later user-resized state is not reset by column-definition updates.

Initial flex
→ starting flex weight used to divide remaining grid width. It maps to AG Grid `initialFlex` and cannot be configured together with initial fixed width.

Sizing constraints
→ limits such as minimum width, maximum width, and whether the user may resize the column. These continue to apply after the initial column state is created.
```

Example relationship:

```text
Review feature
└─ Loan entity
   ├─ labelKey: review.entities.loan.label
   ├─ dataAdapterKey: reviewLoan
   ├─ rowId.path: id
   └─ fields
      ├─ Loan Number
      │  ├─ id: loanNumber
      │  ├─ field: loanNumber
      │  ├─ dataType: text
      │  └─ layout.sizing.defaultWidth: 180
      └─ Loan Amount
         ├─ id: loanAmount
         ├─ field: financials.amount
         ├─ dataType: number
         ├─ filter.operators: [equals, greaterThan, lessThan]
         └─ layout.sizing
            ├─ defaultFlex: 1
            ├─ minWidth: 140
            └─ maxWidth: 320
```

Important distinctions:

```text
field.id
→ stable configuration identity

field.field
→ API row value location

layout defaults
→ starting user-facing column state

access/security
→ authoritative runtime permission constraints (designed separately)
```

More terms are added only when their contracts are actually designed. Formatter/renderer/editor/validation/action/access details should not be documented as settled before their interfaces are reviewed.
