# Configurable Feature Handoff

Repository: `deepanshu-ahuja/aggrid-infinite-ssrm`

Working branch: `configurable-feature-grid`

Always inspect GitHub again before continuing. Do not assume the branch SHA in this document is still HEAD.

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
14. `frontend/src/features/review/configurable/reviewConfigurableFeature.ts`;
15. `frontend/src/features/review/ReviewConfigurableSsrmFeature.tsx`.

When editing is involved, also inspect the merged native-first SSRM editing reference (PR #42) and the current `gridDraftEditing.ts` / `useGridDraftEditing.ts`.

## Current architecture checkpoint

PR #43 established the native-first public configurable type contract. PR #44 originally added defaults/normalization/compiler and a Transaction proof consumer. The current branch advances that experiment to the intended feature/entity/access boundary.

Current route flow:

```text
frontend base Review FeatureDefinition
        │
        ├── loan EntityDefinition + LoanReviewRow runtime
        └── finance EntityDefinition + FinanceReviewRow runtime
        +
frontend-only simulated current-user access profile
        ↓
resolveFeatureAccess
        ↓
resolved feature / entity set / field set / read-vs-edit access
        ↓
separate active entity choice
        ↓
ConfigurableSsrmEntityGrid<TData>
        ↓
application configurable-SSRM defaults + compiler + registries
        ↓
native GridOptions + ColDef[] + getRowId
        ↓
AG Grid SSRM lifecycle + entity-specific rows loader
        ↓
native validation/editing
        ↓
useGridDraftEditing BASE + LOCAL
```

The configurable runtime stays isolated from `/client`, `/infinite`, `/ssrm`, and `/ssrm-native-editing`.

## Critical business-agnostic rule

The configurable grid is **not a Transaction grid**.

`FeatureDefinition` owns a feature key and a set of entity definitions. Entity keys carry business identity such as `loan`, `finance`, `builder`, etc. The shared types/compiler/grid must not hard-code Transaction, Loan, Finance, or any other domain.

`ConfigurableSsrmEntityGrid<TData>` receives an already-resolved entity plus its runtime adapters. It has no role/profile/localStorage/domain-name branching.

The current Review route deliberately proves two different row types and different field sets. Do not create `LoanGrid`, `FinanceGrid`, etc. as separate grid frameworks.

## Base definition versus current-user access

Keep these concepts separate:

```text
BASE FEATURE / ENTITY DEFINITION
= everything the business view can support

CURRENT-USER ACCESS PROJECTION
= what this user/session may actually receive/do

RUNTIME ROW/FIELD CAPABILITIES
= per-row restrictions when required later
```

The current frontend-only access resolver supports feature/entity/field removal plus `read`/`edit` field projection. `read` can downgrade a base editable field. `edit` cannot promote a field whose base definition is read-only.

Do not duplicate an entire feature/entity configuration per role/profile. Resolve a small access projection against the shared base definition.

## Development-only localStorage profiles

Real auth/backend access metadata does not exist yet. For local verification, the Review feature simulates already-resolved user access.

Profile selector:

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

Default:

```text
loanAndFinance
```

Active entity selector:

```text
aggrid.devActiveEntity = loan | finance
```

The profile and active entity are deliberately separate. A user/profile with access to both Loan and Finance may open either entity without changing identity/access.

Change the key(s) in browser localStorage and reload `/configurable-ssrm`.

These values are development tooling only. They are not a security boundary and must not become production authorization logic.

## Trusted local configuration versus backend JSON

Do **not** force trusted frontend-authored configuration through runtime `unknown` normalization merely to simulate a backend that does not exist yet.

Current local path:

```text
frontend-authored typed config
        ↓
TypeScript (`satisfies FeatureDefinition`)
        ↓
access resolution
        ↓
compiler
```

Future backend/storage path:

```text
backend/storage JSON (`unknown`)
        ↓
runtime validation / normalization
        ↓
normalized frontend config
        ↓
access/compiler/runtime
```

`configuration.normalizer.ts` remains the real trust boundary when runtime JSON eventually crosses an API/storage boundary. The earlier Transaction proof may continue using it, but new local configuration does not need to pretend it is untrusted transport data.

## Native-first rules still apply

Use AG Grid-native configuration wherever the persisted meaning is native. Keep native names such as `filter`, `filterParams`, `cellEditor`, `cellRenderer`, `rowSelection`, and `cellSelection`.

Do not accept executable functions/expressions from backend JSON. Use frontend registry keys only where executable behavior genuinely needs selection.

Runtime infrastructure remains runtime-owned: `modules`, `rowModelType`, datasource objects, component implementations, `GridApi` refs, `getRowId` callbacks, events and row/business callbacks.

## Data ownership in the current Review proof

Loan and Finance currently use small frontend-only in-memory `GridRowsLoader` adapters. This is deliberate because the current work is proving feature/entity/access composition, not inventing fake backend Loan/Finance APIs.

The local loaders do not implement server sort/filter semantics, so Review fields do not expose sort/filter. When a real entity backend appears, add an explicit feature adapter/request mapper rather than inferring arbitrary backend query fields from column metadata.

The old Transaction configurable consumer remains reference/history for real Transaction request mapping but is no longer the `/configurable-ssrm` route owner.

## Editing ownership

AG Grid owns normal editing and supported native alternate edit entry points.

Access projection narrows field editability before compilation. The generic root then composes the final native `ColDef.editable` behavior and `useGridDraftEditing` BASE + LOCAL tracking.

Do not copy complete API rows/SSRM blocks into React state. Do not introduce a React Query original-row cache. REMOTE conflict/concurrency/versioning remains a separate later decision.

## Current deliberate limits

The configurable Review route intentionally does not yet implement:

- real authentication/authorization;
- backend feature/access metadata;
- configurable persistence/read-write/save mapping;
- business actions/action authorization;
- masking/unmask;
- row-specific access/capability payloads;
- Grid State/access reconciliation;
- runtime config schema/version negotiation;
- grouping/tree/pivot/aggregation;
- REMOTE conflict/concurrency/versioning.

## Verification requirement

Do not claim the current branch is green unless the exact head actually executes:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run docs:configurable
```

Also run applicable Playwright/manual verification before claiming browser completion.

Generated TypeDoc may still be stale until `npm run docs:configurable` actually runs successfully on the current head.

## Workflow

Stay on `configurable-feature-grid` unless the user explicitly asks for another branch. Do not merge a PR unless explicitly requested. Do not refactor the proven Transaction row-model routes merely to make the configurable experiment look more shared.
