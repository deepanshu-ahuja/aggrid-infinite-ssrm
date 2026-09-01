# Configurable Feature Configuration Design Progress

## Current checkpoint

The public configurable type contract from PR #43 remains the base contract. The branch now proves the next intended layer: one configurable feature can contain multiple business entities and can be narrowed by a simulated current-user access projection before the generic SSRM grid receives it.

Implemented now:

- application configurable-SSRM defaults;
- deterministic `entity.gridOptions` merge semantics;
- native filter/editor/renderer name allowlists and executable registries;
- `labelKey → headerName`;
- `rowId.path → getRowId` plus draft row-ID accessor;
- declarative validation rules → native editor validation;
- fields → final native `ColDef[]`;
- resolved native `GridOptions`;
- generic `ConfigurableSsrmEntityGrid<TData>` runtime with no Transaction/Loan/Finance/profile knowledge;
- frontend Review base feature with separate `loan` and `finance` entities and different row data types;
- frontend-only current-user access projections that can remove entities/fields or downgrade field editing;
- separate active-entity selection for a profile that can access multiple entities;
- localStorage development switching for access profile and active entity;
- frontend-only local rows loaders for Loan/Finance so the access experiment does not invent backend APIs;
- `useGridDraftEditing` BASE + LOCAL composition;
- focused access resolver tests and real-grid Playwright coverage;
- current implementation/manual/handoff documentation.

Earlier `configuration.normalizer.ts` / normalization tests remain available for a real backend/storage `unknown` JSON trust boundary and for the earlier backend-like Transaction proof.

## Critical clarified architecture

The configurable runtime is not Transaction-shaped.

```text
FeatureDefinition
└── entities
    ├── loan    → EntityDefinition + LoanReviewRow runtime
    ├── finance → EntityDefinition + FinanceReviewRow runtime
    └── future business entities
```

The feature/entity base definition answers what the business feature **can** support.

A separate access projection answers what the current user/session **may** receive/do.

```text
base feature definition
        +
resolved current-user access
        ↓
resolved feature/entities/fields
        ↓
active entity
        ↓
generic configurable SSRM root
```

Do not duplicate full configurations per role/profile. Do not make profile identity also mean active navigation/entity.

## FE-only access simulation

There is no real auth/backend metadata system yet.

Development profile key:

```text
aggrid.devAccessProfile
```

Current values:

```text
loanOnly
financeOnly
loanAndFinance
loanReadOnly
```

Active entity key:

```text
aggrid.devActiveEntity = loan | finance
```

Change localStorage and reload `/configurable-ssrm` to verify different user projections without creating real users.

These values simulate an already-resolved authorization result. Generic grid/access code must never infer permissions from those profile names.

## Normalization decision

Do not overbuild runtime normalization for trusted frontend-authored configuration merely because the same shape may later come from the backend.

Current local path:

```text
typed frontend configuration (`satisfies FeatureDefinition`)
        ↓
access projection
        ↓
compiler
```

Future backend/storage path:

```text
runtime JSON (`unknown`)
        ↓
validate / normalize
        ↓
normalized frontend configuration
        ↓
access / compiler
```

Runtime normalization remains necessary when a real untrusted API/storage boundary exists. It is not required to make local constants pretend to be backend payloads.

## Ownership that remains unchanged

AG Grid owns native editing, Cell Selection, Fill Handle, clipboard, editor validation lifecycle and SSRM lifecycle.

The compiler does not own backend query translation, datasource objects, GridApi refs, React lifecycle, authorization policy generation, or business actions.

Current Review Loan/Finance loaders are frontend-only proof adapters and intentionally do not support server sort/filter semantics. Real server-backed entities must supply explicit feature adapters/request mappers later.

## Validation status

The branch must not be called green until the exact head has actually run:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run docs:configurable
```

Also run applicable Playwright/manual verification before claiming browser completion.

Generated TypeDoc may remain stale until `npm run docs:configurable` actually regenerates it on the current head.

## Next coherent areas

First verify/harden the current generic feature/entity/access runtime. Do not immediately add more metadata surface.

After that, larger areas remain:

```text
real feature-owned server sort/filter/search mapping when an entity backend needs it
read/write/save mapping
business actions + action access
masking/unmask + sensitive-data access
row-specific runtime access/capabilities
Grid State/access reconciliation
backend config/access provider integration
runtime config schema/versioning when transport exists
```

Concurrency/conflict/versioning remains a separate later decision; do not automatically restore the old REMOTE reconciliation architecture.

## Durable current implementation reference

See:

- `docs/configurable-feature-handoff.md`;
- `docs/configurable-feature/configuration-reference.md`;
- `docs/configurable-feature/type-hierarchy.md`;
- `docs/configurable-feature/concepts.md`;
- `docs/implementation/configurable-ssrm.md`;
- `docs/implementation/testing/configurable-ssrm-manual-testing.md`.
