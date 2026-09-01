# Configurable Feature Type Hierarchy and AG Grid Mapping

Portable architecture/type map for the current configurable SSRM experiment.

## Base configuration hierarchy

```text
FeatureDefinition
├── featureKey
└── entities: Record<entityKey, EntityDefinition>
    │
    │  entityKey = business/config identity
    │  e.g. "loan", "finance", "builder"
    │
    └── EntityDefinition
        ├── labelKey
        ├── dataAdapterKey
        ├── rowId: RowIdDefinition
        │   └── path
        ├── gridOptions?: ConfigurableSsrmGridOptions
        │   ├── reviewed native GridOptions properties
        │   ├── defaultColDef?: ConfigurableDefaultColDef
        │   ├── rowSelection?: bounded native SSRM selection
        │   └── cellSelection?: bounded native range/fill selection
        └── fields: FieldDefinition[]
            ├── reviewed native ColDef properties
            ├── colId
            ├── field
            ├── labelKey
            ├── cellDataType
            ├── validationRules?
            ├── valueFormatterKey? / valueFormatterConfig?
            └── valueParserKey? / valueParserConfig?
```

`FeatureDefinition` and `EntityDefinition` are business-agnostic. The entity record key carries business identity.

## Current access hierarchy

```text
ConfigurableApplicationAccessProjection
└── features: Record<featureKey, ConfigurableFeatureAccessProjection>
    └── entities: Record<entityKey, ConfigurableEntityAccessProjection>
        └── fields: Record<colId, "read" | "edit">
```

Resolution:

```text
FeatureDefinition
        +
ConfigurableApplicationAccessProjection
        ↓
resolveFeatureAccess(...)
        ↓
ResolvedFeatureDefinition
└── entities: only accessible entities
    └── EntityDefinition
        └── fields: only accessible fields
            ├── read → editable false
            └── edit → preserve base editability
```

`edit` access never promotes a base field whose definition is read-only.

The access projection uses `colId` for field identity. It does not guess by label or arbitrary response property.

## Current Review proof

```text
reviewFeatureDefinition
├── loan
│   ├── EntityDefinition
│   ├── LoanReviewRow
│   └── GridRowsLoader<LoanReviewRow>
└── finance
    ├── EntityDefinition
    ├── FinanceReviewRow
    └── GridRowsLoader<FinanceReviewRow>
```

Then:

```text
resolved Review feature
        ↓
active entity key (loan | finance)
        ↓
ConfigurableSsrmEntityGrid<TData>
        ↓
compileConfigurableSsrmEntity<TData>
        ↓
CompiledConfigurableSsrmEntity<TData>
├── gridOptions: GridOptions<TData>
├── columnDefs: ColDef<TData>[]
├── getRowId
├── getRowIdFromData
└── components?
```

The generic grid root does not know the active profile name or business entity name.

## Profile identity versus active entity

Development-only localStorage currently supplies two separate values:

```text
aggrid.devAccessProfile
→ simulated current-user access

aggrid.devActiveEntity
→ which accessible entity is currently open
```

Do not collapse these into one concept. A profile may access multiple entities.

## Trusted local configuration versus runtime JSON

Current Review path:

```text
frontend-authored object
        ↓
`satisfies FeatureDefinition`
        ↓
access resolution
        ↓
compiler
```

Future backend/storage path:

```text
unknown runtime JSON
        ↓
configuration.normalizer.ts
        ↓
FeatureDefinition-compatible normalized config
        ↓
access resolution / compiler
```

Runtime normalization is a transport/trust-boundary concern, not a mandatory ceremony for every typed local constant.

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
validationRules        → validator registry → getValidationErrors
valueFormatterKey      → formatter registry → ColDef.valueFormatter
valueParserKey         → parser registry → ColDef.valueParser
```

Native names remain native when stored semantics match AG Grid. Executable functions remain frontend-owned.

## Runtime-owned values

Even though `AgGridReact` accepts them, these do not become ordinary feature metadata:

```text
modules
rowModelType
serverSideDatasource
columnDefs application
GridApi refs
event callbacks
React lifecycle
getRowId executable callback
row-specific business callbacks
BASE + LOCAL runtime state
```

The configurable compiler produces native grid/column inputs; the generic SSRM root still visibly owns AG Grid lifecycle.

## Query boundary

The compiler does not infer backend query semantics from `colId` or `field`.

```text
AG Grid sort/filter model
        ↓
entity/feature request mapper
        ↓
backend contract
```

The current Loan/Finance local proof intentionally has no server sort/filter semantics. The Transaction mapper remains the real server-query reference until another backend entity is implemented.
