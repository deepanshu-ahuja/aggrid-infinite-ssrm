# Configurable SSRM runtime

The repository now has an isolated fourth route, `/configurable-ssrm`, that proves the first real consumer of the configurable feature contract.

The implementation is deliberately SSRM-only. Existing `/client`, `/infinite`, `/ssrm`, and `/ssrm-native-editing` remain independent and are not refactored through this path.

## Ownership

```text
backend-like/raw JSON
        ↓
runtime validation + normalization
        ↓
application configurable-SSRM defaults
        +
normalized entity.gridOptions
        ↓
deterministic merge
        ↓
component / formatter / parser / validator registries
        ↓
compile fields → native ColDef[]
compile grid options → native GridOptions
compile rowId.path → getRowId
        ↓
concrete AgGridReact SSRM root
        ↓
existing Transaction request mapper + datasource lifecycle
        ↓
AG Grid native editing / Cell Selection / Fill Handle / clipboard
        ↓
cellValueChanged
        ↓
shared useGridDraftEditing BASE + LOCAL state
```

AG Grid owns native grid behavior. The configurable compiler does not create a replacement grid API.

## Defaults

`configuration.defaults.ts` defines application policy for the configurable SSRM path.

The defaults reuse the existing server-backed pagination/cache values, use `invalidEditValueMode = "block"`, enable native multi-row selection and Cell Selection, and provide the common one-condition Apply/Reset Simple Filter behavior.

The configurable defaults explicitly set `defaultColDef.sortable = false` and `defaultColDef.filter = false`. This is intentional: the application-wide AG Grid defaults enable sorting/filtering, but a server-backed configurable column must not expose a query operation unless the normalized metadata and active server adapter explicitly support that operation.

## Merge semantics

`entity.gridOptions` overrides application defaults.

- scalar/array native values replace the application default;
- `defaultColDef` merges, including nested `filterParams`, `cellEditorParams`, and `cellRendererParams`;
- `rowSelection` merges only while the native discriminated `mode` is unchanged; switching `singleRow`/`multiRow` replaces the branch;
- `cellSelection: boolean` replaces the object form completely;
- object `cellSelection` merges; the handle merges only when its native `mode` stays the same;
- field properties then override the resolved `defaultColDef`;
- field `filterParams`, `cellEditorParams`, and `cellRendererParams` merge with inherited static params.

Arrays are replacement values rather than concatenated configuration.

## Runtime normalization

`configuration.normalizer.ts` is the mandatory trust boundary for backend/storage JSON. It rejects unsupported properties, executable/non-JSON values, invalid filter/data-type combinations, more than one Simple Filter condition, unsupported flat-SSRM selection branches, executable Fill Handle values, and duplicate column IDs.

Successful normalization returns a deep JSON clone typed as the normalized frontend contract. TypeScript types do not replace this check.

## Registries and native component names

Native named AG Grid components stay on `filter`, `cellEditor`, and `cellRenderer`. Frontend registries maintain explicit allowlists and supply custom component implementations through AG Grid's `components` registration.

Executable behavior that cannot safely be persisted uses frontend-owned keys: `valueFormatterKey`, `valueParserKey`, and `validationRules[].key`. Unknown keys fail compilation before the grid is rendered.

## Field compilation

Each normalized field becomes a normal `ColDef`. The compiler maps `labelKey` to `headerName`, keeps declarative native properties native, resolves formatter/parser functions, resolves validation rules, merges native `getValidationErrors` into static `cellEditorParams`, and composes runtime business editability only when metadata has `editable: true`.

Business/access policy is executable runtime code, not persisted configuration. One final native `ColDef.editable` callback is therefore used by normal editing, Fill Handle, clipboard and other native edit entry points instead of implementing separate application filters for each interaction.

## Stable row identity

`rowId.path` is declarative configuration. The compiler converts the dot path into native AG Grid `getRowId` and a direct row-ID accessor used by `useGridDraftEditing`. The resolved value must be a non-empty string or number. Displayed row index is never used as durable identity.

## First Transaction consumer

`transactionsConfigurableFeature.ts` supplies the first backend-like raw configuration and immediately passes it through the same unknown-input normalization boundary intended for a future backend response.

Transaction-specific runtime ownership remains outside the shared compiler: `mapTransactionGridRequest` remains the explicit sort/filter field/operator allowlist, `listTransactions` remains the API boundary, row/cell eligibility remains feature-owned, and Transaction renderers/validators are registered in frontend code.

The compiler does not infer backend query semantics from `ColDef`.

## Editing

The configurable route composes the lightweight PR #42 draft primitives. AG Grid owns normal committed cell editing, provided editor lifecycle, native validation blocking, Cell Selection, Fill Handle, clipboard/paste, and `cellValueChanged`.

`useGridDraftEditing` owns only dirty BASE + LOCAL fields keyed by stable row ID and restores LOCAL values after SSRM RowNode/store recreation. The configurable runtime does not copy full API rows/blocks into React state and does not use a React Query original-row cache.

## Current limits

This foundation does **not** yet implement configurable Save/read/write mapping, selected business actions, access/security/masking metadata, Grid State/access reconciliation, backend runtime schema/version negotiation, grouping/tree/pivot/aggregation, or REMOTE/conflict/concurrency/versioning.

Those are separate contracts. The route intentionally shows local draft counts but no Save controls.

## Source and verification

Shared runtime: `frontend/src/shared/grid/configurable/`.

First consumer: `frontend/src/features/transactions/configurable/transactionsConfigurableFeature.ts` and `frontend/src/features/transactions/grid/TransactionsConfigurableSsrmGrid.tsx`.

Focused frontend tests cover normalization, merge semantics, registry resolution, stable row ID, validation callback composition, and compiler behavior. Playwright covers the real `/configurable-ssrm` browser/API integration for compiled server sorting and native validation + draft tracking.

Manual regression steps are in [`testing/configurable-ssrm-manual-testing.md`](testing/configurable-ssrm-manual-testing.md).

Do not treat documented manual steps as executed unless they were actually run.
