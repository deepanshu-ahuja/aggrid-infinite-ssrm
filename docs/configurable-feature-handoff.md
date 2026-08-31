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
10. `frontend/src/shared/grid/configurable/configuration.types.ts`.

When editing is involved, also inspect the merged native-first SSRM editing reference (PR #42) and the current `gridDraftEditing.ts` / `useGridDraftEditing.ts`.

## Current architecture checkpoint

PR #43 established the native-first public configurable type contract.

The subsequent runtime foundation implements:

```text
raw/backend-like JSON
        ↓
validate + normalize
        ↓
application configurable-SSRM defaults + entity.gridOptions
        ↓
deterministic merge
        ↓
component/formatter/parser/validator registries
        ↓
compile GridOptions + ColDef[] + getRowId
        ↓
/configurable-ssrm
        ↓
existing Transaction SSRM loader/request mapper
        ↓
AG Grid native editing / Cell Selection / Fill Handle / clipboard
        ↓
cellValueChanged
        ↓
useGridDraftEditing BASE + LOCAL
```

The configurable runtime stays isolated from `/client`, `/infinite`, `/ssrm`, and `/ssrm-native-editing`.

## Native-first rules still apply

Use AG Grid-native configuration wherever the persisted meaning is native. Keep native names such as `filter`, `filterParams`, `cellEditor`, `cellRenderer`, `rowSelection`, and `cellSelection`.

Do not accept executable functions/expressions from backend JSON. Use frontend registry keys only where executable behavior genuinely needs selection, currently formatter/parser/validator functions.

Do not use broad `Omit<ColDef>`/`Omit<GridOptions>` persisted surfaces. Keep reviewed positive allowlists.

Runtime infrastructure remains runtime-owned: `modules`, `rowModelType`, `serverSideDatasource`, `columnDefs`, component implementations, `GridApi` refs, `getRowId` callbacks, events and business callbacks.

## Editing ownership

AG Grid owns normal editing and all supported native alternate edit entry points.

Shared runtime owns only dirty BASE + LOCAL field state, first-edit BASE capture, revert cleanup, selected ∩ dirty payload derivation, acknowledgement/rebase, LOCAL restoration after SSRM RowNode recreation, and discard mechanics when wired by a consumer.

Do not copy complete API rows/SSRM blocks into React state. Do not introduce a React Query original-row cache. Do not restore the old Apply Last Edit mechanics. REMOTE conflict/concurrency/versioning is a separate later decision.

## Current deliberate limits

The first configurable route proves loading, configuration compilation, native sort/filter UI, native editing validation, stable row identity, business editability, and BASE + LOCAL draft composition.

It intentionally does not yet wire configurable persistence/actions, Grid State reconciliation, security/masking metadata, runtime config schema/version negotiation, grouping/tree/pivot/aggregation, or conflict/versioning.

## Verification requirement

Do not claim the current branch is green unless the exact head actually executes:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run docs:configurable
```

Also run the applicable Playwright/manual verification before claiming browser completion.

The generated TypeDoc tree was stale at the previous checkpoint. Because this runtime batch does not change `configuration.types.ts`, it does not create new public-type drift, but the pre-existing stale generated output still needs a real `npm run docs:configurable` regeneration.

## Workflow

Stay on `configurable-feature-grid` unless the user explicitly asks for another branch. Do not merge a PR unless explicitly requested. Do not refactor the proven Transaction row-model routes merely to make the configurable experiment look more shared.
