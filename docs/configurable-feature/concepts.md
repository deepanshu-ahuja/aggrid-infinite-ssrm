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
→ configuration for one field/column, including its stable identity, API row path, label, semantic data type, sorting capability, and filtering capability.

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
      │  └─ dataType: text
      └─ Loan Amount
         ├─ id: loanAmount
         ├─ field: financials.amount
         ├─ dataType: number
         └─ filter.operators: [equals, greaterThan, lessThan]
```

The important distinction is:

```text
field.id
→ stable configuration identity

field.field
→ API row value location
```

More terms are added here only when their contracts are actually designed. Renderer/editor/validation/action/access details should not be documented as settled concepts before their interfaces are reviewed.
