# Configurable Feature Type Hierarchy and AG Grid Mapping

Portable type/ownership map for the current configurable Review SSRM runtime.

## Base configuration hierarchy

```text
FeatureDefinition
├── featureKey
└── entities: Record<entityKey, EntityDefinition>
    │
    │ entityKey = business/config identity
    │ e.g. loan / finance / transaction
    │
    └── EntityDefinition
        ├── labelKey
        ├── dataAdapterKey
        ├── rowId.path
        ├── gridOptions?: ConfigurableSsrmGridOptions
        └── fields: FieldDefinition[]
            ├── reviewed native ColDef properties
            ├── colId / field / labelKey / cellDataType
            ├── validationRules?
            ├── valueFormatterKey?
            └── valueParserKey?
```

Review extends `EntityDefinition` only with JSON-safe business-action identities:

```text
ReviewEntityDefinition
└── actions?
    └── { key, labelKey, placement }
```

Executable action/API functions do not live in configuration.

## Access hierarchy

```text
ReviewApplicationAccessProjection
└── features: Record<featureKey, ReviewFeatureAccessProjection>
    └── entities: Record<entityKey, ReviewEntityAccessProjection>
        ├── fields: Record<colId, "read" | "edit">
        └── actions?: Record<actionKey, true>
```

Resolution:

```text
base Review FeatureDefinition
        +
current-user access projection
        ↓
resolveFeatureAccess
        ↓
shared entity/field narrowing
        ↓
resolveReviewFeatureAccess
        ↓
Review action narrowing
        ↓
ResolvedReviewEntityDefinition
```

Rules remain default-deny:

- missing entity/field/action → unavailable;
- `read` → resolved `editable=false`;
- `edit` → preserves base editability and cannot promote base read-only;
- unknown entity/field/action references fail controlledly.

The access shape is not an `EntityDefinition` override.

## Current Review entity tree

```text
reviewFeatureDefinition
├── loan
│   ├── Loan EntityDefinition
│   ├── rowId.path = id
│   └── dataAdapterKey = review-loans
│
├── finance
│   ├── Finance EntityDefinition
│   ├── rowId.path = recordKey
│   └── dataAdapterKey = review-finance
│
└── transaction
    ├── thin Review adapter
    ├── reuses existing Transaction configurable EntityDefinition
    └── dataAdapterKey = transactions
```

The runtime path is independent of entity name:

```text
resolved entity
        ↓
entity.dataAdapterKey
        ↓
reviewEntityRuntimeRegistry
        ↓
ReviewEntityRuntime
├── rowsLoader
├── registries
├── runtimePolicy?
└── primaryAction?
        ↓
ConfigurableSsrmEntityGrid
```

## Runtime/backend adapter hierarchy

```text
Loan runtime
├── mapLoanGridRequest
├── /api/review/loans/query/
└── /api/review/loans/submit/

Finance runtime
├── mapFinanceGridRequest
├── /api/review/finance/search/
└── /api/review/finance/commands/submit/

Transaction runtime
├── existing Transaction request mapper
├── /api/transactions/query/
└── existing Transaction selected-action API
```

All three normalize to the shared runtime contract before the generic grid consumes them.

## Active entity lifecycle

```text
active entity key
        ↓
resolved entity + runtime
        ↓
<ReviewResolvedEntity key={activeEntityKey}>
        ↓
ConfigurableSsrmEntityGrid
```

Changing the entity identity remounts the entity subtree rather than reusing one live GridApi/datasource across incompatible business entities.

## Profile identity versus active entity

```text
aggrid.devAccessProfile
→ which feature/entity/field/action projection to simulate

aggrid.devActiveEntity
→ which accessible entity is currently open
```

These are separate concepts. Current supported active entities are `loan | finance | transaction`.

## Field → AG Grid mapping

```text
field.colId            → ColDef.colId
field.field            → ColDef.field
field.labelKey         → label resolver → ColDef.headerName
field.cellDataType     → ColDef.cellDataType
field.editable         → final native ColDef.editable
field.filter           → ColDef.filter
field.filterParams     → ColDef.filterParams
field.cellEditor       → ColDef.cellEditor
field.cellEditorParams → ColDef.cellEditorParams
field.cellRenderer     → validated renderer/component
validationRules        → validator registry → getValidationErrors
valueFormatterKey      → formatter registry → ColDef.valueFormatter
valueParserKey         → parser registry → ColDef.valueParser
```

## Shared grid runtime output

```text
compileConfigurableSsrmEntity<TData>
        ↓
CompiledConfigurableSsrmEntity<TData>
├── gridOptions: GridOptions<TData>
├── columnDefs: ColDef<TData>[]
├── getRowId
├── getRowIdFromData
└── components?
```

`ConfigurableSsrmEntityGrid` then visibly owns SSRM lifecycle, datasource composition, selection controller, GridApi ref, validation/editing events, and BASE + LOCAL draft restoration.

## Runtime-owned values

These remain frontend/runtime-owned even though AG Grid accepts them:

```text
modules
rowModelType
serverSideDatasource
GridApi refs
event callbacks
React lifecycle
getRowId executable callback
row runtime policy
backend API functions
mutation state
BASE + LOCAL runtime state
```

## Query boundary

```text
AG Grid sort/filter request
        ↓
entity field allowlist/request mapper
        ↓
entity backend API
        ↓
entity response normalizer
        ↓
GridRowsLoader result
```

Loan, Finance, and Transaction intentionally prove that one configurable grid does not require one backend wire format.

## Trust boundary

```text
trusted frontend Loan/Finance config
→ TypeScript/access/compiler

runtime backend/storage config (`unknown`)
→ configuration.normalizer
→ access/compiler
```

Transaction currently reuses its earlier normalized backend-like definition. Normalization is a runtime trust-boundary concern, not mandatory ceremony for trusted local constants.
