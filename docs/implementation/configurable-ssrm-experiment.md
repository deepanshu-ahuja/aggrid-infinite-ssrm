# Configurable SSRM Experiment

## Status

The repository currently contains one **isolated fourth grid composition path** at `/configurable-ssrm`. It uses the Server-Side Row Model (SSRM) and proves the first JSON-safe configuration-provider / validation / compiler / registry boundary without refactoring the established `/client`, `/infinite`, or `/ssrm` implementations.

This is a boundary experiment, not a claim that the existing three grids have been migrated to metadata-driven composition.

## Current purpose

The implemented flow is:

```text
local JSON-safe table definition
        ↓
async configuration provider
        ↓
runtime schema validation
        ↓
allowlisted frontend registries + compiler
        ↓
normal AG Grid ColDef[]
        ↓
isolated frontend-owned SSRM composition root
        ↓
existing SSRM datasource/query lifecycle
```

The row model is **not** selected by metadata. The `/configurable-ssrm` frontend route explicitly chooses SSRM and continues to own the native SSRM lifecycle.

## Implemented metadata boundary

The current schema supports only intentionally bounded application concepts:

- schema and definition versions;
- table identity;
- explicit `rowIdField`;
- allowlisted feature `dataSourceKey`;
- column `id`, `field`, optional `semanticKey`, and header;
- text/number/date data types;
- bounded width metadata;
- supported sort/filter metadata;
- renderer and formatter registry keys plus JSON-safe parameters;
- editor registry shape for compiler coverage.

Metadata is runtime-validated before AG Grid receives it. Executable values such as functions are rejected. Unknown required renderer/editor/formatter keys fail with a controlled configuration error instead of executing arbitrary code.

## Frontend registries

Executable UI behavior remains frontend code. For the Transaction experiment, registered implementations currently include:

- `transactionAccess` → `TransactionInteractionCell`;
- `transactionStatus` → `TransactionStatusCell`;
- `transactionCurrency` → the existing currency formatter with a JSON-configured currency field;
- `transactionDate` → the existing date formatter;
- `transactions` → the existing Transaction server-query loader.

The metadata chooses among those supported keys only.

## SSRM ownership

`TransactionsConfigurableSsrmGrid.tsx` deliberately reuses established native/runtime mechanics rather than moving them into metadata:

- `rowModelType="serverSide"` is frontend composition;
- `useServerSideRowLoading` owns datasource/error/retry/count lifecycle;
- the existing Transaction request mapper owns backend sort/filter mapping;
- existing SSRM grid defaults remain native AG Grid options;
- existing backend-derived row interaction rules remain the selectability/presentation authority;
- stable row identity is read from the validated `rowIdField` metadata with a safe Transaction `id` fallback.

The established Client, Infinite and SSRM roots remain independently implemented and were not rewritten to make this experiment work.

## Current non-goals

This experiment does **not** currently implement:

- backend-served table metadata;
- role/group/access-projection logic;
- sensitive-field masking or unmask flows;
- tracked-editing / Save / Discard parity on the configurable route;
- metadata-driven business actions;
- migration of the three proven grid roots;
- a JSON clone of the full AG Grid `ColDef` or GridOptions API;
- metadata-driven Client/Infinite/SSRM selection.

## Verification

Focused compiler tests verify:

- valid JSON-safe metadata compiles into expected native `ColDef` values;
- explicit field mapping is preserved;
- unsupported schema versions are rejected;
- executable values inside metadata are rejected;
- unknown required registry keys fail predictably.

A real Playwright scenario opens `/configurable-ssrm`, verifies metadata-compiled columns and backend-driven row eligibility, then sorts the compiled Reference column and confirms the real SSRM backend request contains the expected `reference asc` sort instruction.

CI run #275 at code checkpoint `04a02c63c03f74ef3a08507e3d6f0de9b81cdd3d` passed Frontend lint/typecheck/unit/build, Backend checks/tests, and **98/98** real-browser Playwright scenarios.

Manual verification steps are documented in `testing/configurable-ssrm-manual-testing.md` and must not be treated as completed unless someone actually runs them.

## Implementation map

Shared configuration boundary:

- `frontend/src/shared/grid/configuration/configurableTable.types.ts`
- `frontend/src/shared/grid/configuration/configurableTable.validation.ts`
- `frontend/src/shared/grid/configuration/configurableTable.provider.ts`
- `frontend/src/shared/grid/configuration/compileConfigurableTable.ts`
- `frontend/src/shared/grid/configuration/useCompiledConfigurableTable.ts`

Transaction experiment:

- `frontend/src/features/transactions/configurable/transactionsConfigurableTable.definition.ts`
- `frontend/src/features/transactions/configurable/transactionsConfigurableTable.provider.ts`
- `frontend/src/features/transactions/configurable/transactionsConfigurableTable.registry.ts`
- `frontend/src/features/transactions/grid/TransactionsConfigurableSsrmGrid.tsx`

Verification:

- `frontend/src/shared/grid/configuration/compileConfigurableTable.test.ts`
- `tests/browser/configurable-ssrm.spec.ts`

## Next boundary after this experiment

The next architecture phase, if explicitly chosen after this isolated slice is reviewed, is local resolved access projections: prove that one base definition can safely produce different authorized field/read-only projections without putting role-policy logic into generic grid code. That is a separate expansion and is not implemented by this document.
