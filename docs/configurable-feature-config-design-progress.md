# Configurable Feature Configuration Design Progress

## Current checkpoint

The configurable Review runtime has moved beyond the PR #44 local-array proof. One generic SSRM composition root now renders Loan, Finance, or Transaction from resolved entity metadata plus an entity runtime selected by `dataAdapterKey`.

Implemented now:

- application configurable-SSRM defaults and deterministic merge semantics;
- allowlisted filters/editors/renderers plus formatter/parser/validator registries;
- `labelKey → headerName`;
- `rowId.path → getRowId` and draft row-ID accessor;
- declarative validation → native AG Grid editor validation;
- fields → native `ColDef[]` and bounded `GridOptions`;
- one generic `ConfigurableSsrmEntityGrid` with no Loan/Finance/Transaction/profile branching;
- Review entities `loan`, `finance`, and `transaction`;
- rich Loan/Finance configs with server sort/filter declarations, editors, parsers, formatters, renderers and validation;
- Transaction reuse through a thin Review adapter rather than a copied Transaction config;
- backend-backed Loan and Finance datasets;
- intentionally different Loan and Finance request/response contracts;
- Transaction reuse of the existing Transaction query API/mapper;
- executable entity runtime registry keyed by `dataAdapterKey`;
- keyed active-entity remount so incompatible GridApi/datasource/selection/draft/mutation state is not hot-swapped;
- default-deny field access plus Review action access;
- frontend-only profile/entity development switching;
- shared SSRM manual/current-page/all-filtered/all-records selection composition;
- common Review primary `Submit` action UI;
- entity-owned Submit API/payload/response mapping for Loan/Finance/Transaction;
- native editing + BASE/LOCAL draft tracking;
- focused Loan/Finance request-mapper tests, backend API tests and real-grid Playwright coverage;
- synchronized implementation/manual/handoff documentation.

## Critical architecture

```text
Review FeatureDefinition
├── loan
├── finance
└── transaction
        +
current-user access projection
        ↓
resolved entity + actions
        ↓
active entity
        ↓
entity.dataAdapterKey
        ↓
ReviewEntityRuntime
        ↓
ConfigurableSsrmEntityGrid
```

No entity-specific grid render branches are required.

## Backend diversity is intentional

```text
Loan
AG Grid request
→ mapLoanGridRequest
→ POST /api/review/loans/query/
→ rows / totalCount / filteredCount

Finance
AG Grid request
→ mapFinanceGridRequest
→ POST /api/review/finance/search/
→ window / orderBy / criteria
→ records / counts

Transaction
AG Grid request
→ existing Transaction mapper
→ POST /api/transactions/query/
```

One configurable grid must not require all business teams/backends to expose one identical wire shape.

## Transaction reuse

Transaction is a Review entity but its large configurable definition remains authoritative in the Transaction feature.

Review owns only a thin adapter under `features/review/entities/transaction/` that:

- reuses the existing Transaction entity definition;
- adds Review action metadata;
- adapts existing Transaction query/action APIs into `ReviewEntityRuntime`.

The obsolete Transaction-only configurable grid root was removed. `TransactionsSsrmNativeEditingGrid` remains intentionally preserved as a native-editing reference.

## Access semantics

Base definition and access remain separate:

```text
base entity
= everything the business entity can support

access projection
= which entities/fields/actions this current user/session may receive/use
```

Current field access:

```text
missing → unavailable
read    → resolved read-only
edit    → preserve base editability
```

Current Review action access:

```text
missing → unavailable
true    → permitted only if base entity declares it
```

Access is not a second grid configuration and must not contain widths/editors/filters/formatters/etc.

Development profiles:

```text
loanOnly
financeOnly
transactionOnly
loanAndFinance
allEntities
loanReadOnly
loanRestricted
```

Default is `allEntities`.

Active entity:

```text
loan | finance | transaction
```

## Common Submit ownership

All current entities can expose primary action `submit`.

```text
Review component
→ TanStack mutation state and action result presentation

entity runtime
→ executable endpoint / payload mapper / backend semantics / response normalization

ConfigurableSsrmEntityGrid
→ selection intent + filter model
→ clear selection + refresh SSRM after success
```

Current action backends deliberately differ:

- Loan `/api/review/loans/submit/`;
- Finance `/api/review/finance/commands/submit/` with command/target vocabulary;
- Transaction existing selected-action API, mapped by the Review adapter.

Entity-specific secondary actions are not implemented yet.

## Masking status

Masking/unmask is **not implemented yet**.

Temporary in-progress sensitive-field metadata from this continuation was removed because there was no complete backend clear-value boundary, unmask API, renderer lifecycle, or authorization enforcement. Do not re-add placeholder masking fields merely to make the config look broader.

A future masking slice must prove that unauthorized clear values are not sent in normal row payloads and that unmask is a separately authorized backend operation.

## Current SSRM parity direction

The configurable root now composes more of the mature SSRM foundation:

- backend loading/query mapping;
- selection controller and counts;
- compact server selection target;
- row runtime policy;
- selected business action lifecycle;
- native editing/validation + BASE/LOCAL draft tracking;
- retry/refresh lifecycle.

Still not at full configurable persistence parity:

- row Save;
- Save Selected;
- Discard;
- backend field-error mapping for configurable entities;
- configurable Grid State/access reconciliation;
- import/export as configurable entity capabilities.

These should be added deliberately rather than copied blindly from Transaction-specific UI.

## Normalization decision

Current trusted Loan/Finance configs:

```text
TypeScript → access → compiler
```

Transaction continues to reuse its normalized backend-like config.

Future backend/storage metadata:

```text
unknown JSON → validate/normalize → access → compiler/runtime
```

## Cleanup completed in this continuation

Removed superseded proof code:

- old all-in-one local-array `reviewConfigurableFeature.ts`;
- old Transaction-only `TransactionsConfigurableSsrmGrid.tsx`.

Do not remove `TransactionsSsrmNativeEditingGrid`.

## Verification requirement

A written test or green compile step is not enough. Before calling the head complete, verify exact-head CI including Browser regression.

Expected frontend checks include:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run docs:configurable
```

Automated coverage/manual docs/coverage matrix/capability tags must stay synchronized with implemented capability footprint. Do not claim manual verification unless it was actually executed.

## Next coherent areas after this PR

After this current continuation is merged and re-inspected from the new baseline, likely next areas are:

```text
configurable cell-edit Save / Save Selected / Discard mapping
entity-specific secondary actions
masking / unmask with a real sensitive-data backend boundary
row-specific capability/access payloads
Grid State/access reconciliation
real authenticated config/access provider
runtime schema/versioning when transport exists
```

Concurrency/conflict/versioning remains separately deferred unless explicitly reopened.
