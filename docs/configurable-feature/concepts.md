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

Translation key
→ reference used to resolve displayed text such as an entity label.
```

Example relationship:

```text
Review feature
├─ Loan entity
│  ├─ labelKey: review.entities.loan.label
│  ├─ dataAdapterKey: reviewLoan
│  └─ rowId.path: id
└─ Finance entity
   ├─ labelKey: review.entities.finance.label
   ├─ dataAdapterKey: reviewFinance
   └─ rowId.path: id
```

More terms are added here only when their contracts are actually designed. Renderer/editor/validation/action/access/translation details should not be documented as settled concepts before their interfaces are reviewed.