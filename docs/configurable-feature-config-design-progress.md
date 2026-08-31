# Configurable Feature Configuration Design Progress

## Current checkpoint

The public configurable type contract from PR #43 remains the contract. The first real configurable SSRM runtime foundation is now implemented on `configurable-feature-grid`.

Implemented in the current foundation batch:

- application configurable-SSRM defaults;
- deterministic `entity.gridOptions` merge semantics;
- nested `defaultColDef`, filter/editor/renderer param, row-selection and Cell Selection merges;
- mandatory `unknown` runtime JSON validation/normalization;
- native filter/editor/renderer name allowlists;
- formatter/parser/validator frontend registries;
- `labelKey → headerName`;
- `rowId.path → getRowId` plus draft row-ID accessor;
- `validationRules → cellEditorParams.getValidationErrors`;
- fields → final native `ColDef[]`;
- resolved native `GridOptions`;
- isolated `/configurable-ssrm` Transaction consumer;
- existing Transaction server request mapper/datasource reuse;
- `useGridDraftEditing` BASE + LOCAL composition;
- focused unit tests and real-grid Playwright coverage;
- current implementation/manual documentation.

## Ownership that remains unchanged

AG Grid owns native editing, Cell Selection, Fill Handle, clipboard, filtering UI, editor validation lifecycle and SSRM lifecycle.

The compiler does not own backend query translation, business access rules, datasource objects, GridApi refs, React lifecycle, or business actions.

The Transaction consumer keeps `mapTransactionGridRequest`, `listTransactions`, `isTransactionCellEditable`, and `isTransactionRowSelectable` as feature/runtime boundaries.

## Validation status

The branch must not be called green until the exact head has actually run:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run build
npm run docs:configurable
```

The GitHub CI workflow currently runs only for pull requests to `main` and pushes to `main`, so a plain working-branch commit does not itself produce CI.

Generated TypeDoc was stale at the pre-implementation checkpoint. The public type file was not changed by this runtime batch, but stale generated output still needs regeneration on an executable checkout before it can be treated as current.

## Next coherent areas

Do not reopen the whole public contract speculatively. Extend only when a real runtime requirement proves a type change is needed.

The larger next areas remain:

```text
server sort/filter/search mapping beyond the current Transaction adapter
read/write/save mapping
access/security/masking
business actions
Grid State/access reconciliation
runtime config schema/versioning
```

Concurrency/conflict/versioning remains a separate later decision; do not automatically restore the old REMOTE reconciliation architecture.

## Durable current implementation reference

See `docs/configurable-feature/configuration-reference.md`, `docs/configurable-feature/type-hierarchy.md`, `docs/configurable-feature/concepts.md`, `docs/implementation/configurable-ssrm.md`, and `docs/implementation/testing/configurable-ssrm-manual-testing.md`.
