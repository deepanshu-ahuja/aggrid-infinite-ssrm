# Configurable Feature Concepts

Plain-language meanings for the current configurable feature/grid model.

For the visual type tree, see [`type-hierarchy.md`](type-hierarchy.md). For implemented runtime truth, see [`../implementation/configurable-ssrm.md`](../implementation/configurable-ssrm.md).

## Core vocabulary

```text
Feature definition
→ overall configurable business feature.

Entity key
→ stable business/configuration identity inside a feature, e.g. loan / finance / transaction.

Entity definition
→ base grid/field capability definition for one business data context.

Base definition
→ everything an entity can support before current-user access is applied.

Access projection
→ already-resolved allowlist describing what the current user/session may receive/do.

Resolved entity
→ base entity after inaccessible fields/actions are removed and read/edit access is applied.

Active entity
→ which accessible entity is currently open; navigation state, not user identity.

Data adapter key
→ declarative key that selects frontend-owned executable runtime/backend behavior.

Entity runtime
→ rows loader, registries, optional row policy, and action adapter for one entity.

Row identity
→ stable business-record path compiled into AG Grid getRowId and draft tracking.
```

## One Review feature, three entities

The configurable grid is not a Transaction grid and it is not a Loan/Finance switch statement.

```text
Review
├── loan
├── finance
└── transaction
```

Loan and Finance own their own definitions and backend adapters. Transaction participates through a thin Review adapter that reuses the existing rich Transaction configurable definition/API/mappers instead of copying them.

All three reach the same `ConfigurableSsrmEntityGrid` through `dataAdapterKey` runtime lookup.

## One grid does not mean one backend endpoint

Review intentionally proves this separation:

```text
Loan
→ /api/review/loans/query/
→ flat offset/limit/sort/filters contract

Finance
→ /api/review/finance/search/
→ different window/orderBy/criteria contract
→ records/counts response

Transaction
→ existing /api/transactions/query/ contract
```

The generic grid receives a normalized rows-loader result. It does not know the backend vocabulary of the active entity.

## Base definition and current-user access are different things

Base definition answers:

> What can this entity support?

Access projection answers:

> Which parts may this user/session receive or use?

Field rules:

```text
missing field → unavailable
read          → visible but resolved read-only
edit          → preserve base editability; never promote base read-only
```

Review action rules:

```text
missing action → unavailable
action=true    → allowed only if the base entity declares it
```

The access projection is deliberately small. It is **not** another copy of entity configuration and does not contain widths, filters, editors, renderers, parsers, formatters, etc.

Default-deny matters: adding a new base field/action must not silently expose it to every existing profile.

## Development-only profile simulation

There is no real authenticated access provider yet.

```text
aggrid.devAccessProfile
→ loanOnly | financeOnly | transactionOnly | loanAndFinance | allEntities | loanReadOnly | loanRestricted

aggrid.devActiveEntity
→ loan | finance | transaction
```

Default profile is `allEntities`.

Profile and active entity are separate. A profile may expose multiple entities while active entity chooses which one is currently open.

These localStorage values are development tooling only and are not a security boundary.

## Active entity remount

Review resolves the active entity and runtime, then renders the entity subtree with the entity identity as a React key.

Conceptually:

```text
Loan grid instance
        ↓ active entity changes
unmount Loan GridApi/datasource/selection/drafts/mutation
        ↓
mount Finance grid instance fresh
```

Do not hot-swap incompatible entity metadata/data adapters through one live GridApi.

## Native AG Grid alignment

Keep native AG Grid names when the stored semantics genuinely match AG Grid:

```text
rowSelection
cellSelection
invalidEditValueMode
sortable
filter / filterParams
editable
cellEditor / cellEditorParams
cellRenderer
```

Configuration should not become a parallel grid language.

Executable functions, React components, API functions, GridApi refs, datasource instances, event callbacks and row business callbacks remain frontend/runtime-owned.

## Registries

Configuration may select frontend-owned executable behavior through stable keys:

```text
valueFormatterKey → formatter registry
valueParserKey    → parser registry
validation rule   → validator registry
renderer name     → validated component registry
```

Backend/runtime JSON must never provide arbitrary JavaScript/functions/expressions.

## Query mapping

Server query behavior belongs to entity request mappers, not the compiler.

```text
AG Grid sort/filter state
→ explicit entity field allowlist
→ entity mapper
→ entity backend contract
```

This is why Finance can have a completely different API shape without adding Finance logic to the shared grid.

## Common Submit action

The three current Review entities can expose the same primary action identity: `submit`.

Common UI does not imply common endpoint/payload semantics:

```text
Review component
→ owns TanStack mutation state

entity runtime
→ owns endpoint + payload mapping + response normalization

shared grid
→ owns selected target + applied filter model
→ clears selection and refreshes SSRM only after success
```

Loan and Finance therefore render the same Submit button while making different backend requests. Transaction maps that same Review action into its existing selected-action contract.

Entity-specific secondary actions remain a later capability.

## Editing

Current configurable edit flow:

```text
resolved native editable
→ native editor / parser / validation
→ committed cellValueChanged
→ useGridDraftEditing
→ BASE + LOCAL dirty fields
```

This is separate from the Review Submit business action.

Configurable cell-edit persistence (row Save / Save Selected / Discard) is not implemented yet.

## Trust boundaries

Trusted frontend-authored Loan/Finance config:

```text
TypeScript
→ access resolution
→ compiler
```

Future backend/storage config:

```text
unknown JSON
→ runtime validation/normalization
→ access resolution
→ compiler
```

Transaction currently reuses its earlier normalized backend-like configurable definition.

## Current deliberate limits

Not yet implemented on the configurable Review path:

- real backend-authenticated access provider;
- backend-delivered feature/access metadata;
- configurable cell-edit persistence;
- masking/unmask/sensitive-value retrieval;
- entity-specific secondary actions;
- row-specific capability payloads beyond current runtime row interaction policy;
- Grid State/access reconciliation;
- runtime config schema/version negotiation;
- grouping/tree/pivot/aggregation;
- REMOTE conflict/concurrency/versioning.
