# Configurable Feature Configuration Reference

Public reference for `frontend/src/shared/grid/configurable/configuration.types.ts` and the first implemented configurable SSRM runtime.

The normalized public configuration contract remains native-first. Raw backend/storage JSON is never passed directly to AG Grid.

## Runtime boundary

```text
frontend-supported configuration design
        ↓
backend/database representation may differ
        ↓
runtime JSON (`unknown`)
        ↓
validate + normalize/adapt ALWAYS
        ↓
normalized frontend configuration
        ↓
application configurable-SSRM defaults + entity.gridOptions
        ↓
deterministic merge
        ↓
component / formatter / parser / validator registries
        ↓
compile GridOptions + ColDef[] + getRowId
        ↓
concrete configurable SSRM root
        ↓
AG Grid
```

Current runtime entry points are `configuration.defaults.ts`, `configuration.normalizer.ts`, `configuration.registries.ts`, and `configuration.compiler.ts` beside `configuration.types.ts`.

## Native naming and typing

Use the AG Grid property name when the concept and safely-persisted semantics are native. Prefer a precise exported AG Grid type, `Pick<AGGridType, ReviewedKeys>`, or `Extract`/`Omit` of only an unsafe executable union branch. Do not use a broad persisted `Omit<ColDef, UnsafeKeys>` or `Omit<GridOptions, UnsafeKeys>` because an AG Grid upgrade must not silently expose new runtime members.

## Feature/entity shape

```text
FeatureDefinition
└── entities: Record<entityKey, EntityDefinition>
    ├── labelKey
    ├── dataAdapterKey
    ├── rowId.path
    ├── gridOptions?: ConfigurableSsrmGridOptions
    └── fields: FieldDefinition[]
```

The entity record key is business/config identity. `dataAdapterKey` selects a frontend API/request-mapping registry entry; it is not an AG Grid datasource object. `rowId.path` is compiled into native `getRowId` and a direct draft row-ID accessor.

## Grid-level configuration

`ConfigurableSsrmGridOptions` is a reviewed native `GridOptions` surface plus bounded `defaultColDef`, `rowSelection`, and `cellSelection`.

Runtime-owned values remain outside persisted configuration: modules, `rowModelType`, datasource, final `columnDefs`, component implementation objects, context, GridApi refs, callbacks/events, business callbacks and validation callbacks.

`readOnlyEdit` remains excluded because the current native-first draft architecture observes normal mutation + `cellValueChanged`; `readOnlyEdit` would transfer ownership to `cellEditRequest`.

Grouping/tree/pivot/aggregation remain unsupported until the server contract owns their semantics.

## Application defaults and merge behavior

`configurableSsrmGridDefaults` reuses server-backed pagination/cache defaults and establishes the configurable SSRM editing/selection baseline.

The defaults explicitly set `defaultColDef.sortable = false` and `defaultColDef.filter = false`. The application-wide AG Grid defaults are broader; the configurable server-backed path must not expose sort/filter until the field opts in and the active feature adapter can execute the same server meaning.

Exact merge semantics:

- top-level scalar and array values: entity value replaces application default;
- `defaultColDef`: merge;
- nested `defaultColDef.filterParams`, `cellEditorParams`, `cellRendererParams`: merge;
- `rowSelection`: merge only within the same native `mode`; changing mode replaces the branch;
- `cellSelection` boolean: complete replacement;
- object `cellSelection`: merge;
- range/fill handle: merge only when `mode` is unchanged; changing mode replaces the handle;
- resolved `defaultColDef` + field: field wins;
- field filter/editor/renderer params: nested merge.

Arrays are replacement values rather than concatenated values.

## Runtime validation/normalization

The normalizer treats backend JSON as `unknown`, checks the reviewed contract, and deep-clones accepted JSON. It rejects unsupported properties, non-JSON values, invalid native enum branches, duplicate `colId`s, unsupported filter option/data-type pairs, more than one Simple Filter condition, invalid flat-SSRM selection branches, and executable values.

Matching backend/frontend property names do not bypass normalization.

## Native filters

There is no application `filtering` wrapper. `filter` and `filterParams` remain native. Type-specific params derive from AG Grid Text/Number/BigInt/Date interfaces, while the accepted operator vocabulary stays deliberately bounded to what the active server query contract can map.

JSON-safe is necessary but not sufficient: a native option that changes server semantics is exposed only when the adapter/backend can execute that meaning.

## Native editor/filter/renderer names

AG Grid already supports named provided/registered components, so configuration keeps `filter`, `cellEditor`, and `cellRenderer`. Frontend registries maintain explicit allowlists. Functions/components never come from JSON.

## Formatter/parser registries

Persisted JSON uses `valueFormatterKey` / `valueFormatterConfig` and `valueParserKey` / `valueParserConfig` because native string expressions can be executable. The frontend resolves those keys to functions typed from the real AG Grid callback branches. Unknown keys fail compilation.

## Validation

`validationRules` reuses the shared `GridValidationRule` shape (`key`, `params`, `message`). The frontend validator registry owns executable functions.

For the current provided-editor consumer: `validationRules → validateGridValue → cellEditorParams.getValidationErrors → AG Grid editor validation`. Static configured editor params are preserved while the runtime callback is merged in.

`invalidEditValueMode = "block"` means invalid editor values do not commit and therefore do not enter BASE + LOCAL draft state.

## Native-first editing

```text
normal edit / Cell Selection / Ctrl+D / Ctrl+Enter / Fill Handle / paste
        ↓
AG Grid editable + validation lifecycle
        ↓
cellValueChanged
        ↓
useGridDraftEditing
```

Shared draft state retains only genuinely dirty BASE + LOCAL fields keyed by stable row ID. It does not copy SSRM blocks into React state and does not introduce a React Query original-row cache.

## First real consumer

`transactionsConfigurableFeature.ts` is the first backend-like configuration. It goes through the same `unknown → normalize` boundary intended for a future backend response.

The Transaction feature still owns label resolution, `dataAdapterKey` lookup, the existing `mapTransactionGridRequest` server field/operator allowlist, API loading, business row/cell eligibility, custom renderers, and feature-specific validator/formatter/parser registrations. The shared compiler does not infer business/query behavior from metadata.

## Current scope

Implemented now: defaults/merge, runtime normalization, component allowlists, formatter/parser/validator resolution, labels, row ID, native validation callbacks, final native columns/grid options, isolated configurable SSRM root, existing SSRM datasource/request mapping composition, and BASE + LOCAL draft composition.

Not implemented yet: configurable read/write/save mapping, selected business actions, access/security/masking metadata, Grid State/access reconciliation, runtime config schema/version negotiation, grouping/tree/pivot/aggregation, and concurrency/version/conflict semantics.

See `docs/implementation/configurable-ssrm.md` for current implemented behavior and verification.
