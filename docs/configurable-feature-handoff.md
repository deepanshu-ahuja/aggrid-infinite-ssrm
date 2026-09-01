# Configurable Feature Handoff

Repository: `deepanshu-ahuja/aggrid-infinite-ssrm`

Current continuation branch/PR at the time of this update: `configurable-feature-grid` / PR #45.

Always inspect GitHub again before continuing. Do not assume branch/PR state or SHA from this document is still current.

## Durable reading order

1. root `AGENTS.md`;
2. `docs/implementation/README.md`;
3. `docs/grid-backlog.md`;
4. this file;
5. `docs/configurable-feature-config-design-progress.md`;
6. `docs/configurable-feature/configuration-reference.md`;
7. `docs/configurable-feature/type-hierarchy.md`;
8. `docs/configurable-feature/concepts.md`;
9. `docs/implementation/configurable-ssrm.md`;
10. `docs/implementation/testing/configurable-ssrm-manual-testing.md`;
11. `frontend/src/shared/grid/configurable/configuration.types.ts`;
12. `frontend/src/shared/grid/configurable/configuration.access.ts`;
13. `frontend/src/shared/grid/configurable/ConfigurableSsrmEntityGrid.tsx`;
14. `frontend/src/features/review/configurable/reviewFeature.definition.ts`;
15. `frontend/src/features/review/configurable/reviewAccess.profiles.ts`;
16. `frontend/src/features/review/configurable/reviewAccess.resolver.ts`;
17. `frontend/src/features/review/configurable/reviewRuntime.registry.ts`;
18. `frontend/src/features/review/entities/loan/`;
19. `frontend/src/features/review/entities/finance/`;
20. `frontend/src/features/review/entities/transaction/`;
21. `frontend/src/features/review/ReviewConfigurableSsrmFeature.tsx`.

For native-editing comparison, inspect `TransactionsSsrmNativeEditingGrid`. It is intentionally retained as a reference and is not cleanup debt.

## Current architecture checkpoint

The configurable Review route now has three business entities and real server-backed loaders:

```text
Review FeatureDefinition
├── loan
├── finance
└── transaction
        +
frontend simulated current-user access projection
        ↓
resolveReviewFeatureAccess
        ↓
resolved fields + permitted action identities
        ↓
active entity
        ↓
entity.dataAdapterKey
        ↓
Review runtime registry
        ↓
keyed entity subtree
        ↓
ConfigurableSsrmEntityGrid
```

The generic grid does not branch on Loan/Finance/Transaction/profile names.

## Entity/backend ownership

Do not collapse Review into one polymorphic backend endpoint merely because one UI can render several entities.

Current contracts deliberately differ:

```text
Loan
POST /api/review/loans/query/
→ offset / limit / sort / filters

Finance
POST /api/review/finance/search/
→ window / orderBy / criteria
→ records / counts response

Transaction
POST /api/transactions/query/
→ existing Transaction contract
```

Entity-specific request mappers/allowlists own AG Grid → backend translation. Runtime adapters normalize backend results into `GridRowsLoader` results.

Finance is intentionally wire-incompatible with Loan to prove the shared grid is not coupled to one backend shape.

## Transaction inside Review

Transaction **is** a Review entity.

It lives visibly under:

```text
frontend/src/features/review/entities/transaction/
```

but Review does not copy the large Transaction configurable column definition. The thin Review adapter reuses `transactionsConfigurableFeature.entities.transaction` and adds only Review-specific business-action metadata/runtime adaptation.

The obsolete `TransactionsConfigurableSsrmGrid` root has been removed. `TransactionsSsrmNativeEditingGrid` remains intentionally preserved.

## Base definition versus current-user access

Keep these layers separate:

```text
BASE FEATURE / ENTITY DEFINITION
= what the business entity can support

CURRENT-USER ACCESS PROJECTION
= which entities/fields/actions this user/session may receive/use

RUNTIME ROW POLICY
= row-specific behavior based on authoritative row data where applicable
```

Field access remains default-deny (`read | edit`, missing = unavailable). Review also narrows declared action identities (`true`, missing = unavailable).

The access object is not a partial grid config override. Do not put widths/editors/filters/formatters/parsers/etc. into role/profile projections.

## Development profiles

There is still no real authenticated access provider. Current localStorage development fixtures are:

```text
aggrid.devAccessProfile
→ loanOnly
→ financeOnly
→ transactionOnly
→ loanAndFinance
→ allEntities
→ loanReadOnly
→ loanRestricted
```

Default:

```text
allEntities
```

Separate active entity:

```text
aggrid.devActiveEntity = loan | finance | transaction
```

These values simulate an already-resolved access result for development only. They are not a security boundary.

## Active entity lifecycle

The Review entity subtree is keyed by active entity identity.

Do not hot-swap a live GridApi/datasource between Loan, Finance, and Transaction. An entity change should destroy previous grid/datasource/selection/draft/mutation state and mount the next entity fresh.

## Common primary action

Current entities expose the same Review action identity when access permits it:

```text
submit
```

Ownership:

```text
Review component
→ TanStack mutation lifecycle / UI result

entity runtime
→ endpoint / payload mapping / backend semantics / response normalization

ConfigurableSsrmEntityGrid
→ selection intent / filter model / successful refresh lifecycle
```

Current endpoints differ for Loan, Finance, and Transaction. Do not move those API details into the generic grid.

Entity-specific secondary actions are not implemented yet; do not add placeholder action config without runtime/UI support.

## Current configurable SSRM capability level

The generic grid now composes materially more of the mature SSRM mechanics:

- server-backed loading;
- explicit entity sort/filter mapping;
- stable row IDs;
- manual/current-page/all-filtered/all-records selection semantics;
- selected count/compact selection target;
- optional row runtime policy;
- common selected business action lifecycle;
- rich configurable columns/editors/renderers/parsers/formatters/validation;
- native editing plus BASE + LOCAL draft tracking;
- load retry/refresh lifecycle.

It does **not** yet have configurable cell-edit persistence parity (row Save / Save Selected / Discard), masking/unmask, configurable Grid State reconciliation, or REMOTE conflict/concurrency.

## Masking decision for the current merge slice

Earlier in-progress PR #45 code briefly declared sensitive fields/unmask entitlements without a complete backend/runtime/UI unmask flow. Those placeholders were removed before merge rather than documenting half-implemented security behavior.

Masking/unmask remains explicitly planned for a dedicated coherent slice. When implemented, normal row APIs must not send unauthorized clear sensitive values merely for frontend masking.

## Trusted config versus runtime JSON

Current Loan/Finance config is trusted typed frontend source:

```text
TypeScript → access → compiler
```

Transaction reuses its earlier normalized backend-like configurable definition.

Future real backend/storage metadata:

```text
unknown JSON → runtime validate/normalize → access → compiler/runtime
```

Do not remove the runtime normalizer from actual untrusted transport boundaries, and do not force trusted local constants through it unnecessarily.

## Current cleanup state

Removed as superseded:

- `frontend/src/features/review/configurable/reviewConfigurableFeature.ts` (old local-array all-in-one Review proof);
- `frontend/src/features/transactions/grid/TransactionsConfigurableSsrmGrid.tsx` (old Transaction-only configurable grid root).

Preserve:

- the existing rich Transaction configurable definition used by Review;
- `TransactionsSsrmNativeEditingGrid` as native-editing reference;
- mature `/client`, `/infinite`, `/ssrm` Transaction references.

## Verification requirement

Do not call a PR/head green until the exact head has actually passed the repository CI gates, including browser regression.

Current expected frontend checks include:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run docs:configurable
```

Also maintain/update Playwright coverage, manual verification docs, capability tags, and the coverage matrix when capability footprint changes.

Never claim manual verification unless it was actually executed.

## Deferred topics

Still separate/later unless explicitly reopened:

- configurable cell-edit persistence mapping;
- masking/unmask;
- entity-specific secondary actions;
- real backend-authenticated access provider;
- backend-delivered config/access metadata;
- row-specific access/capability payloads beyond current runtime policy;
- Grid State/access reconciliation;
- schema/version negotiation;
- grouping/tree/pivot/aggregation;
- REMOTE conflict/concurrency/versioning.

## Workflow

Inspect actual `main`, `grid-foundation`, open/recent PRs, and CI before making further changes. Do not create another branch automatically. Do not merge a PR unless the user explicitly asks.
