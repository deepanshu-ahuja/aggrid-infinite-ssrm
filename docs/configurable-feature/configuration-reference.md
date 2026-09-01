# Configurable Feature Configuration Reference

Current reference for the configurable feature/entity/access contract and the isolated SSRM runtime.

Quick visual reference: [`type-hierarchy.md`](type-hierarchy.md). Plain-language concepts: [`concepts.md`](concepts.md). Current implemented runtime: [`../implementation/configurable-ssrm.md`](../implementation/configurable-ssrm.md).

## Current configuration pipeline

The current Review experiment uses trusted frontend-authored base definitions and frontend-only simulated access projections:

```text
typed frontend FeatureDefinition
        +
frontend simulated current-user access projection
        ↓
resolveFeatureAccess
        ↓
resolved feature/entities/fields
        ↓
active entity
        ↓
compileConfigurableSsrmEntity
        ↓
native GridOptions + ColDef[] + getRowId
        ↓
ConfigurableSsrmEntityGrid<TData>
```

When configuration eventually comes from backend/storage, add the runtime trust boundary before access resolution:

```text
backend/storage JSON (`unknown`)
        ↓
configuration.normalizer.ts
        ↓
normalized FeatureDefinition-compatible configuration
        ↓
resolveFeatureAccess / compiler
```

Do not pass raw runtime JSON directly to AG Grid. Also do not force typed local constants through runtime normalization merely to imitate a backend that does not exist yet.

## Feature definition

```ts
interface FeatureDefinition<...> {
  featureKey: string;
  entities: Record<TEntityKey, EntityDefinition>;
}
```

The entity record key is the business/config identity, for example:

```text
review
├── loan
└── finance
```

`FeatureDefinition` does not mean Transaction. Shared code must remain business-agnostic.

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

- `labelKey` resolves to the entity display label;
- `dataAdapterKey` identifies feature/runtime loading/saving/request-response behavior when required;
- `rowId.path` identifies stable business row identity;
- `gridOptions` contains the bounded native configurable SSRM surface;
- `fields` contains the entity's base field definitions.

The current Review proof uses distinct `LoanReviewRow` and `FinanceReviewRow` types and distinct local row loaders.

## Field definition

`FieldDefinition` uses native AG Grid property names whenever stored semantics genuinely match AG Grid.

Application-owned members:

```text
colId
field
labelKey
cellDataType
validationRules
valueFormatterKey / valueFormatterConfig
valueParserKey / valueParserConfig
```

Common native configurable examples:

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

`colId` is stable application/AG Grid column identity. `field` is the row-data value path. They may differ.

## Grid options

`ConfigurableSsrmGridOptions` is a reviewed positive subset of native `GridOptions`, with narrowed nested values where native types also include callbacks/runtime objects.

Current categories include:

```text
pagination/cache sizing
native selection/cell selection
native edit behavior
column movement
row/header sizing
basic tooltip/focus/accessibility behavior
defaultColDef
```

Runtime infrastructure does not become persisted/configurable simply because `AgGridReact` accepts it.

Runtime-owned examples:

```text
modules
rowModelType
serverSideDatasource
columnDefs application
context
GridApi refs
event callbacks
getRowId executable callback
business callbacks
```

## Current-user access projection

Implemented access types live in `configuration.access.ts`.

```ts
interface ConfigurableApplicationAccessProjection {
  features: Record<string, ConfigurableFeatureAccessProjection>;
}

interface ConfigurableFeatureAccessProjection {
  entities: Record<string, ConfigurableEntityAccessProjection>;
}

interface ConfigurableEntityAccessProjection {
  fields: Record<string, 'read' | 'edit'>;
}
```

The field keys are stable `FieldDefinition.colId` values.

Resolution rules:

```text
feature omitted
→ feature unavailable

entity omitted
→ entity unavailable

field omitted
→ field removed from resolved entity

field = read
→ field present + editable false

field = edit
→ preserve base editability
→ never promote base editable=false
```

Invalid local/access projections that reference an unknown entity or `colId` fail controlledly.

The current access schema is intentionally small. Business actions, masking/unmask, row-specific permissions and other access concerns remain later contracts.

## Development profile provider

Current FE-only Review profiles live in `reviewConfigurableFeature.ts` and represent simulated **already-resolved** user access.

Selector:

```text
localStorage["aggrid.devAccessProfile"]
```

Supported values:

```text
loanOnly
financeOnly
loanAndFinance
loanReadOnly
```

Default:

```text
loanAndFinance
```

Active entity is separate:

```text
localStorage["aggrid.devActiveEntity"] = "loan" | "finance"
```

Change the key(s), reload `/configurable-ssrm`, and inspect the resolved feature.

Do not put role checks inside `ConfigurableSsrmEntityGrid`, the compiler, or access resolver. The development profile name is interpreted only by the current feature/provider boundary.

These localStorage values are not security. Future backend APIs must enforce real authorization independently.

## Application defaults and merge semantics

`configuration.defaults.ts` owns configurable-SSRM application defaults.

Important baseline:

```text
invalidEditValueMode = block
defaultColDef.sortable = false
defaultColDef.filter = false
native multi-row selection
native Cell Selection/fill handle
common one-condition Simple Filter Apply/Reset behavior
```

`sortable=false` and `filter=false` prevent a server-backed configurable grid from exposing query operations that the active adapter never declared.

Merge structure:

```text
application configurable-SSRM defaults
        +
entity.gridOptions
        ↓
resolved GridOptions

resolved defaultColDef
        +
field definition
        ↓
final ColDef
```

Mode-sensitive nested merges remain implemented for selection/cell-selection discriminated unions; arrays replace rather than concatenate.

## Runtime normalization

`configuration.normalizer.ts` accepts `unknown` and validates the reviewed runtime-JSON surface.

It is required when configuration actually crosses an untrusted runtime boundary such as a backend/storage response.

It rejects examples such as:

```text
unknown/unreviewed properties
functions and other non-JSON values
unsupported native enum/union values
duplicate colIds
invalid cell-data-type/filter combinations
unsupported Simple Filter condition shapes
unsupported selection branches
```

The current Review local base definition does not call this normalizer because it is authored and type-checked in frontend source.

## Registries

Frontend registries own executable behavior.

```text
filter/editor/renderer component names
→ validated against allowed names

valueFormatterKey
→ formatter registry → real valueFormatter

valueParserKey
→ parser registry → real valueParser

validationRules[].key
→ validator registry → native editor validation callback
```

Configuration does not contain arbitrary executable JavaScript or AG Grid expressions.

## Query semantics

The compiler does not translate arbitrary configured fields directly into backend query instructions.

A real server-backed entity needs an explicit feature adapter/request mapper:

```text
AG Grid request
        ↓
feature mapper / field allowlist
        ↓
backend API contract
```

The current Review local Loan/Finance loaders do not implement sort/filter semantics, so their base fields leave those capabilities disabled. The existing Transaction mapper remains the reference for real backend sort/filter mapping.

## Editing

Access projection is applied before compilation.

```text
base editable
        +
current-user read/edit access
        ↓
resolved editable
        ↓
final native ColDef.editable
        ↓
AG Grid native edit entry points
        ↓
validation
        ↓
cellValueChanged
        ↓
useGridDraftEditing BASE + LOCAL
```

Configurable Save/read-write mapping is not implemented yet.

## Current deliberately unimplemented contracts

- real authentication/backend authorization;
- backend feature/access metadata provider;
- Save/read-write mapping;
- action configuration/action authorization;
- masking/unmask;
- row-specific access/capability payloads;
- Grid State/access reconciliation;
- runtime schema/version negotiation;
- grouping/tree/pivot/aggregation;
- REMOTE conflict/concurrency/versioning.
