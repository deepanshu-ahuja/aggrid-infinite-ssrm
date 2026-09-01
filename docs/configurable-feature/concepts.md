# Configurable Feature Concepts

Plain-language meanings for the configurable feature/grid model and the current configurable SSRM runtime.

For the visual type tree, see [`type-hierarchy.md`](type-hierarchy.md). For implemented runtime truth, see [`../implementation/configurable-ssrm.md`](../implementation/configurable-ssrm.md).

## Core vocabulary

```text
Feature definition
→ overall configurable business feature.

Entity key
→ stable business/configuration identity inside a feature, e.g. "loan" or "finance".

Entity definition
→ reusable configuration for one data context; shared code does not hard-code Transaction, Loan,
  Finance, Builder, etc.

Base definition
→ everything a feature/entity can support before current-user access is applied.

Access projection
→ already-resolved answer describing what the current user/session may actually receive/do.

Resolved feature/entity
→ the base definition after inaccessible entities/fields are removed and read/edit access is applied.

Active entity
→ which accessible entity the user is currently viewing; this is navigation/state, not user identity.

Data adapter / rows loader
→ frontend boundary that supplies one entity's row data and owns backend request/response mapping when
  a real backend exists.

Row identity
→ stable business-record field/path compiled into AG Grid getRowId and the draft row-ID accessor.

Grid options
→ bounded native AG Grid options supported by the configurable SSRM runtime.

Field definition
→ one configurable field/column, using native ColDef names where persisted semantics match AG Grid.
```

## One feature can contain multiple business entities

The configurable grid is not a Transaction grid.

```text
Review feature
├── loan
│   └── EntityDefinition
├── finance
│   └── EntityDefinition
└── future entities such as builder / portfolio / etc.
```

The `FeatureDefinition.entities` record key is the business/config identity. `EntityDefinition` itself remains generic.

The current `/configurable-ssrm` route proves this with different row shapes:

```text
LoanReviewRow
→ borrower / principal / status / internalScore

FinanceReviewRow
→ facility / counterparty / exposure / currency / reviewStatus
```

Both are rendered through `ConfigurableSsrmEntityGrid<TData>`.

## Base definition and current-user access are separate

A base definition answers:

> What can this feature/entity support?

An access projection answers:

> What may this user/session actually receive or do?

Current implemented resolution:

```text
base FeatureDefinition
        +
ConfigurableApplicationAccessProjection
        ↓
resolveFeatureAccess
        ↓
resolved feature/entity/field set
```

Current field access vocabulary:

```text
read
→ field is present but resolved editable = false

edit
→ preserve base editability
→ cannot promote a base read-only field

missing field
→ field is unavailable and removed
```

Missing feature/entity entries mean that feature/entity is unavailable.

Do not duplicate the entire Loan/Finance configuration for every role/profile. Keep one base definition and small access projections.

## Current FE-only profile simulation

Real authentication/backend authorization is not implemented for the configurable experiment yet.

The current Review feature therefore simulates an already-resolved user/session projection in frontend code.

Profile selector:

```text
aggrid.devAccessProfile
```

Current profiles:

```text
loanOnly
financeOnly
loanAndFinance
loanReadOnly
```

Active entity selector:

```text
aggrid.devActiveEntity = loan | finance
```

Change localStorage and reload `/configurable-ssrm`.

Profile and active entity are deliberately independent. A user with `loanAndFinance` access may open either entity without changing their simulated identity/access.

These localStorage values are development tooling only and are not authorization/security.

## Future authorization ownership

The long-term ownership rule remains:

```text
Backend/policy layer
→ decides WHAT the current user/session may receive/do

Frontend
→ decides HOW supported metadata becomes React + AG Grid behavior
```

A future backend may resolve access using roles, groups, entitlements, ownership, region, classifications, temporary grants, or another policy engine. Generic frontend grid code should not know those internals.

The backend must also enforce access independently. Hiding/removing UI configuration is not a security boundary.

## Trusted local configuration versus backend JSON

There are now two intentionally different trust paths.

### Current local configuration

```text
frontend-authored config
        ↓
TypeScript (`satisfies FeatureDefinition`)
        ↓
access resolution
        ↓
compiler
```

Trusted local constants do not need a large runtime `unknown` validator merely to pretend a backend exists.

### Future backend/storage configuration

```text
backend/storage response (`unknown`)
        ↓
runtime validation / normalization
        ↓
normalized frontend config
        ↓
access / compiler / runtime
```

TypeScript cannot validate runtime API JSON. `configuration.normalizer.ts` therefore remains useful and necessary when configuration actually crosses an untrusted runtime boundary.

## Native AG Grid alignment

Use native AG Grid vocabulary when the concept and stored value semantics are genuinely the same.

Examples:

```text
gridOptions.pagination
gridOptions.rowSelection
gridOptions.cellSelection
gridOptions.invalidEditValueMode
field.sortable
field.filter
field.filterParams
field.editable
field.cellEditor
field.cellEditorParams
field.cellRenderer
```

Do not wrap native semantics in parallel shapes merely to call them metadata.

Runtime/executable values remain frontend-owned, including datasource objects, GridApi refs, event callbacks, React components, business callbacks and AG Grid lifecycle objects.

## Registries

Configuration may safely select frontend-owned executable behavior by stable keys where required.

Examples:

```text
valueFormatterKey
→ frontend formatter registry
→ real ColDef.valueFormatter

valueParserKey
→ frontend parser registry
→ real ColDef.valueParser

validationRules[].key
→ frontend validator registry
→ AG Grid editor validation
```

Native registered AG Grid component names can stay on `filter`, `cellEditor`, and `cellRenderer`, with the frontend validating allowed names.

Backend JSON must never supply arbitrary JavaScript/functions/expressions.

## Editing

Native editing flow remains:

```text
normal edit / Fill Handle / paste / other supported native entry point
        ↓
final native ColDef.editable
        ↓
AG Grid editor validation
        ↓
cellValueChanged for committed value
        ↓
useGridDraftEditing
        ↓
BASE + LOCAL dirty fields
```

Current-user `read` access is applied before compilation, so all native edit entry points see the same final read-only decision.

The configurable route still does not implement Save/read-write mapping yet.

## Query behavior and data adapters

The compiler does not infer backend query semantics from arbitrary `colId` or `field` values.

A real server-backed entity must own explicit request mapping between AG Grid sort/filter models and the backend contract.

The current Loan/Finance Review proof uses tiny frontend-only row loaders and intentionally exposes no sort/filter because those adapters do not implement server query semantics.

The older Transaction configurable proof remains a useful reference for explicit real backend request mapping.

## Runtime infrastructure is not configuration

Examples that remain frontend/runtime-owned:

```text
modules
rowModelType
serverSideDatasource
columnDefs application
GridApi refs
event handlers
getRowId executable callback
row-specific business callbacks
React lifecycle
BASE + LOCAL draft state
```

Configuration chooses declarative supported behavior. It does not become a second programming language or a remote grid framework.

## Current deliberate limits

Not yet implemented on the configurable Review path:

- real backend authentication/authorization;
- backend-provided feature/access metadata;
- configurable Save/read-write mapping;
- business actions/action access;
- sensitive-data masking/unmask;
- row-specific access/capability payloads;
- Grid State/access reconciliation;
- runtime config schema/version negotiation;
- grouping/tree/pivot/aggregation;
- REMOTE conflict/concurrency/versioning.
