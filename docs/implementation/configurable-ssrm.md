# Configurable SSRM runtime

The `/configurable-ssrm` route implements one business-agnostic Review SSRM runtime that can render three different business entities: Loan, Finance, and Transaction.

Existing `/client`, `/infinite`, `/ssrm`, and `/ssrm-native-editing` remain independent Transaction reference routes. `TransactionsSsrmNativeEditingGrid` is intentionally preserved as the native-editing reference; the older Transaction-only configurable grid root has been removed because Review now owns the configurable route.

## Current implemented flow

```text
Review base FeatureDefinition
├── loan
├── finance
└── transaction
        +
frontend-only simulated current-user access projection
        ↓
resolveReviewFeatureAccess
        ↓
resolved entities + resolved fields + permitted action identities
        ↓
active entity choice
        ↓
entity.dataAdapterKey
        ↓
Review runtime registry
        ↓
keyed ReviewResolvedEntity
        ↓
ConfigurableSsrmEntityGrid
        ↓
compiler + executable registries
        ↓
native GridOptions + ColDef[] + getRowId
        ↓
AG Grid SSRM datasource / selection / editing lifecycle
        ↓
entity-owned backend adapter
```

Changing the active entity creates a keyed Review entity subtree. The previous GridApi, datasource, selection, mutation state, and BASE + LOCAL draft state are therefore destroyed instead of hot-swapping a live SSRM instance between business entities.

## Feature/entity boundary

`FeatureDefinition` and `ConfigurableSsrmEntityGrid` remain business-agnostic. Business identity is carried by the `entities` record keys and the resolved entity metadata.

Current Review entities:

```text
review
├── loan
│   ├── rowId.path = id
│   ├── dataAdapterKey = review-loans
│   └── Loan-specific fields / validation / query metadata
│
├── finance
│   ├── rowId.path = recordKey
│   ├── dataAdapterKey = review-finance
│   └── Finance-specific fields / validation / query metadata
│
└── transaction
    ├── reuses the existing rich Transaction configurable entity definition
    ├── dataAdapterKey = transactions
    └── Review adds only its common Submit action metadata
```

Transaction is intentionally visible under `features/review/entities/transaction/`, but its large column/grid configuration is not copied. Review composes the existing Transaction definition so there is one authoritative Transaction configurable config.

The generic grid never branches on `loan`, `finance`, or `transaction`.

## Backend/data adapter ownership

One Review grid does **not** imply one polymorphic Review endpoint.

The three entities intentionally prove different backend ownership:

```text
Loan
POST /api/review/loans/query/
request  → offset / limit / sort / filters
response → rows / totalCount / filteredCount

Finance
POST /api/review/finance/search/
request  → window / orderBy / criteria
response → records / counts

Transaction
POST /api/transactions/query/
request/response → existing Transaction server-query contract
```

Loan and Finance each have feature-owned request mappers with explicit field allowlists. Finance deliberately uses a wire vocabulary unrelated to the shared grid request/result shape. Its runtime adapter normalizes `records/counts` into the `GridRowsLoader` result expected by shared SSRM code.

This boundary is the important rule:

```text
AG Grid request
        ↓
entity request mapper / allowlist
        ↓
entity backend contract
        ↓
entity runtime normalizes response
        ↓
shared GridRowsLoader result
```

The compiler never infers backend field semantics from arbitrary configured columns.

## Rich configurable field behavior

Loan and Finance now exercise the same configurable compiler surface used by Transaction, including applicable combinations of:

- server-side `sortable` metadata;
- text/number/date filters and filter parameters;
- native text/number/select editors;
- parser registry keys;
- formatter registry keys;
- renderer registry keys;
- declarative validation rules;
- native sizing and selection options;
- different stable row-ID paths.

Executable functions and React components remain frontend-owned registry entries. Configuration contains stable keys, not arbitrary executable JavaScript.

## Base definition versus current-user projection

The base entity definition says what the business entity can support. The access projection says which parts this current user/session may receive or use.

Field rules remain default-deny:

```text
feature omitted → feature unavailable
entity omitted  → entity unavailable
field omitted   → field removed
field = read    → field present and resolved editable=false
field = edit    → preserve base editability; never promote base read-only
```

Review extends the shared access projection with action identities:

```text
action omitted       → unavailable
actions[action]=true → permitted if the base entity actually declares that action
```

The access object is **not** a partial `EntityDefinition` override. It does not repeat column widths, editors, formatters, filters, or other grid configuration.

Unknown entity/field/action references fail controlledly.

## Development-only access profiles

There is still no real authentication/access backend for Review. localStorage selects a frontend development access fixture only.

Profile key:

```text
aggrid.devAccessProfile
```

Supported values:

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

Active entity is independent navigation state:

```text
aggrid.devActiveEntity = loan | finance | transaction
```

If the stored active entity is not accessible under the selected profile, Review falls back to the first actually accessible entity.

These localStorage values are development tooling only and are not a security boundary.

## Common Review Submit action

Loan, Finance, and Transaction currently declare the same primary Review action identity:

```text
submit
```

The ownership split is deliberate:

```text
ReviewConfigurableSsrmFeature
→ owns TanStack mutation state / success / error presentation

active ReviewEntityRuntime
→ owns endpoint, payload mapping, backend semantics, response normalization

ConfigurableSsrmEntityGrid
→ owns selected target + applied filter model
→ clears selection only after successful action
→ refreshes its own SSRM store after successful action
```

Current entity mappings:

```text
Loan Submit
→ POST /api/review/loans/submit/

Finance Submit
→ POST /api/review/finance/commands/submit/
→ deliberately different command payload/response vocabulary

Transaction Submit
→ existing Transaction selected-action API
→ Review adapter maps the common Submit meaning to Transaction status Pending
```

A failed action Promise keeps the user's selection intact and does not refresh the store.

Entity-specific secondary actions are not implemented in the current Review UI yet.

## SSRM selection currently composed by the configurable root

`ConfigurableSsrmEntityGrid` composes the proven SSRM selection controller rather than inventing a Review-only selection model.

Current controls/semantics include:

- normal row/manual selection;
- explicit **Select current page**;
- explicit **Select all filtered**;
- native SSRM header checkbox for **All records**;
- compact include/exclude selection intent for unloaded rows;
- selected-row count using total/filtered count ownership;
- clear selection;
- runtime row-selectability policy when supplied by an entity.

Transaction preserves its backend-derived row interaction policy when rendered through Review.

## Editing and validation

Resolved field access is applied before compilation, so AG Grid receives the final `editable` behavior.

The configurable root currently composes:

```text
native AG Grid editor
        ↓
native configurable validation
        ↓
committed cellValueChanged
        ↓
useGridDraftEditing
        ↓
BASE + LOCAL dirty fields by stable row ID
```

This route does **not** yet implement configurable row Save/Save Selected/Discard persistence. The common Submit action is a selected business action, not the persistence path for cell edits.

REMOTE conflict/concurrency/versioning remains deliberately separate.

## Trusted local configuration versus runtime JSON

Current Review Loan/Finance base definitions are trusted typed frontend source and therefore go directly through access resolution/compiler checks.

Transaction continues to reuse its earlier normalized backend-like configurable definition.

When real backend/storage configuration arrives:

```text
runtime JSON (`unknown`)
        ↓
validate / normalize
        ↓
FeatureDefinition-compatible value
        ↓
access resolution
        ↓
compiler/runtime
```

Do not pass raw runtime JSON to AG Grid, and do not force every trusted local constant through `unknown` normalization merely to imitate a transport boundary that does not exist.

## Current limits

The configurable Review runtime does not yet implement:

- real authentication/backend-authoritative user access;
- backend-provided feature/access metadata;
- configurable Save/Save Selected/Discard write mapping for cell drafts;
- masking/unmask/sensitive-value retrieval;
- entity-specific secondary action rendering/execution;
- row-specific authorization/capability payloads beyond current runtime row interaction policy;
- configurable Grid State/access reconciliation;
- runtime config schema/version negotiation;
- grouping/tree/pivot/aggregation;
- REMOTE conflict/concurrency/versioning.

Do not add placeholder metadata for these to current entities until the corresponding runtime/API contract is actually implemented.

## Key source

- `frontend/src/features/review/ReviewConfigurableSsrmFeature.tsx`
- `frontend/src/features/review/configurable/reviewFeature.definition.ts`
- `frontend/src/features/review/configurable/reviewAccess.profiles.ts`
- `frontend/src/features/review/configurable/reviewAccess.resolver.ts`
- `frontend/src/features/review/configurable/reviewRuntime.registry.ts`
- `frontend/src/features/review/entities/loan/`
- `frontend/src/features/review/entities/finance/`
- `frontend/src/features/review/entities/transaction/`
- `frontend/src/shared/grid/configurable/ConfigurableSsrmEntityGrid.tsx`
- `frontend/src/shared/grid/configurable/configuration.compiler.ts`
- `backend/apps/review/`

Focused mapper/backend tests cover the entity wire contracts. Playwright covers the real Review route, three entity runtimes, access projection, native validation/draft tracking, and Loan/Finance Submit payload delegation.

Manual verification steps are in [`testing/configurable-ssrm-manual-testing.md`](testing/configurable-ssrm-manual-testing.md). A documented manual checklist is not a claim that those steps have been executed.
