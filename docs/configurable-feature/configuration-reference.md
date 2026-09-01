# Configurable Feature Configuration Reference

Reference for the current configurable feature/entity/access contract and `/configurable-ssrm` Review runtime.

See also [`type-hierarchy.md`](type-hierarchy.md), [`concepts.md`](concepts.md), and the current implementation guide [`../implementation/configurable-ssrm.md`](../implementation/configurable-ssrm.md).

## Current pipeline

```text
frontend-authored Review FeatureDefinition
├── loan
├── finance
└── transaction
        +
frontend development current-user access projection
        ↓
resolveReviewFeatureAccess
        ↓
resolved entity/field/action set
        ↓
active entity
        ↓
entity.dataAdapterKey
        ↓
Review runtime registry
        ↓
compileConfigurableSsrmEntity
        ↓
native GridOptions + ColDef[] + getRowId
        ↓
ConfigurableSsrmEntityGrid
        ↓
entity-owned backend adapter
```

When configuration actually comes from backend/storage, insert runtime validation/normalization before access resolution.

## Feature definition

```ts
interface FeatureDefinition<...> {
  featureKey: string;
  entities: Record<TEntityKey, EntityDefinition>;
}
```

Current Review identity tree:

```text
review
├── loan
├── finance
└── transaction
```

The record key carries business identity. Shared configuration/grid code is not Transaction-, Loan-, or Finance-specific.

## Entity definition

```ts
interface EntityDefinition<...> {
  labelKey: string;
  dataAdapterKey: string;
  rowId: { path: string };
  gridOptions?: ConfigurableSsrmGridOptions;
  fields: readonly FieldDefinition[];
}
```

Meaning:

- `labelKey` → frontend display-label lookup;
- `dataAdapterKey` → stable key used to resolve executable runtime/backend behavior;
- `rowId.path` → stable business row identity;
- `gridOptions` → bounded reviewed native SSRM options;
- `fields` → base column/field capabilities.

Review extends this at its feature boundary with JSON-safe business action identities:

```ts
interface ReviewEntityDefinition extends EntityDefinition {
  actions?: readonly {
    key: string;
    labelKey: string;
    placement: 'primary' | 'secondary';
  }[];
}
```

The current entities declare only the common primary `submit` action. Executable action functions are **not** stored in configuration.

## Current entity differences

```text
Loan
rowId.path = id
dataAdapterKey = review-loans
API = /api/review/loans/query/
wire request = offset / limit / sort / filters

Finance
rowId.path = recordKey
dataAdapterKey = review-finance
API = /api/review/finance/search/
wire request = window / orderBy / criteria
wire response = records / counts

Transaction
rowId.path = id
dataAdapterKey = transactions
API = existing /api/transactions/query/
config = reused existing rich Transaction configurable entity
```

The generic grid receives only a normalized `GridRowsLoader` result; it does not know these wire formats.

## Field definition

Use native AG Grid property names when the stored semantics genuinely match AG Grid.

Application-owned members include:

```text
colId
field
labelKey
cellDataType
validationRules
valueFormatterKey / valueFormatterConfig
valueParserKey / valueParserConfig
```

Reviewed native members include examples such as:

```text
type
sortable
initialSort
initialPinned
initialWidth / initialFlex
minWidth / maxWidth
resizable
filter / filterParams
editable
cellEditor / cellEditorParams
cellRenderer / cellRendererParams
suppressPaste
suppressFillHandle
```

`colId` is stable column identity. `field` is the row-data path and may differ from `colId`.

## Grid options

`ConfigurableSsrmGridOptions` is a positive reviewed subset of native `GridOptions`.

Current supported categories include pagination/cache sizing, native row/cell selection, edit behavior, column movement, row/header sizing, basic tooltip/focus/accessibility behavior, and `defaultColDef`.

Runtime infrastructure remains runtime-owned even if `AgGridReact` accepts it:

```text
modules
rowModelType
serverSideDatasource
columnDefs application
GridApi refs
event callbacks
getRowId function
business/runtime callbacks
```

## Access projection

Shared field access:

```ts
interface ConfigurableEntityAccessProjection {
  fields: Record<string, 'read' | 'edit'>;
}
```

Review adds action access:

```ts
interface ReviewEntityAccessProjection extends ConfigurableEntityAccessProjection {
  actions?: Record<string, true>;
}
```

Resolution is default-deny:

```text
feature omitted → unavailable
entity omitted  → unavailable
field omitted   → removed
field=read      → present, editable=false
field=edit      → preserve base editability; never promote base read-only
action omitted  → unavailable
action=true     → available only if declared by base entity
```

Unknown entity/field/action references fail controlledly.

The access projection is an authorization allowlist. It is **not** a partial entity/grid override: it does not repeat widths, editor configuration, filters, parsers, formatters, or other column metadata.

## Development profile provider

Current frontend-only profile selector:

```text
localStorage["aggrid.devAccessProfile"]
```

Supported profiles:

```text
loanOnly
financeOnly
transactionOnly
loanAndFinance
allEntities
loanReadOnly
loanRestricted
```

Default:

```text
allEntities
```

Active entity remains separate:

```text
localStorage["aggrid.devActiveEntity"] = "loan" | "finance" | "transaction"
```

These values simulate already-resolved access for development only. They are not production authorization/security.

## Defaults and merge semantics

`configuration.defaults.ts` owns application configurable-SSRM defaults.

Important baseline includes:

```text
invalidEditValueMode = block
defaultColDef.sortable = false
defaultColDef.filter = false
native multi-row selection
native Cell Selection/fill handle
common simple-filter behavior
```

Entities opt fields into sort/filter only when the entity mapper/backend supports matching server semantics.

Merge structure:

```text
application defaults + entity.gridOptions → resolved GridOptions
resolved defaultColDef + field definition → final ColDef
```

Nested union merges remain deliberate and mode-aware; arrays replace rather than concatenate.

## Runtime normalization

`configuration.normalizer.ts` remains the `unknown` trust boundary for actual runtime JSON.

Current Loan/Finance definitions are trusted typed frontend source and do not need to pretend they arrived through a backend. Transaction continues to reuse its earlier normalized backend-like definition.

Future runtime path:

```text
backend/storage JSON (`unknown`)
→ validate/normalize
→ FeatureDefinition-compatible value
→ access resolution
→ compiler/runtime
```

## Registries

Executable behavior stays frontend-owned:

```text
filter/editor/renderer names → allowlists/components
valueFormatterKey           → formatter registry
valueParserKey              → parser registry
validationRules[].key       → validator registry
```

Configuration never carries arbitrary JavaScript/functions/expressions.

## Query semantics

The compiler does not convert arbitrary configured `colId`/`field` values into backend queries.

Each server-backed entity owns an explicit request mapper/field allowlist.

Current examples intentionally prove both compatible and incompatible backend wire shapes:

```text
Loan AG Grid state → Loan mapper → flat Loan query
Finance AG Grid state → Finance mapper → window/orderBy/criteria
Transaction AG Grid state → existing Transaction mapper
```

## Common Review action

All three current entities expose the primary action identity `submit` when the access projection permits it.

Execution is resolved separately through the active `ReviewEntityRuntime`:

```text
configuration/action access → action identity
runtime registry            → executable endpoint/payload/response behavior
Review component            → TanStack mutation state
shared grid                 → selection + filter model + success refresh lifecycle
```

Loan, Finance, and Transaction therefore share one Review button without sharing one backend endpoint or request shape.

Entity-specific secondary actions are not rendered/executed yet.

## Editing

```text
base editable
+ current-user read/edit access
→ resolved editable
→ native ColDef.editable
→ AG Grid validation
→ committed cellValueChanged
→ useGridDraftEditing BASE + LOCAL
```

The current route does not yet implement configurable cell-edit Save/Save Selected/Discard persistence.

## Current unimplemented contracts

- real backend authentication/authorization;
- backend-delivered feature/access metadata;
- configurable cell-edit persistence mapping;
- masking/unmask/sensitive-value retrieval;
- entity-specific secondary actions;
- row-specific access/capability payloads beyond current runtime row policy;
- Grid State/access reconciliation;
- runtime schema/version negotiation;
- grouping/tree/pivot/aggregation;
- REMOTE conflict/concurrency/versioning.
