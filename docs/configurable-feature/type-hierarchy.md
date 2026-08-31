# Configurable Feature Type Hierarchy and AG Grid Mapping

Quick architecture/type map for `frontend/src/shared/grid/configurable/configuration.types.ts` and its implemented SSRM compiler.

## Current hierarchy

```text
FeatureDefinition
├── featureKey
└── entities: Record<entityKey, EntityDefinition>
    └── EntityDefinition
        ├── labelKey
        ├── dataAdapterKey
        ├── rowId.path
        ├── gridOptions?: ConfigurableSsrmGridOptions
        │   ├── reviewed Pick<GridOptions, ...>
        │   ├── defaultColDef?: ConfigurableDefaultColDef
        │   ├── rowSelection?: derived flat-SSRM native selection
        │   └── cellSelection?: boolean | derived safe native selection
        └── fields: FieldDefinition[]
            ├── reviewed native ColDef members
            ├── colId
            ├── field
            ├── labelKey
            ├── cellDataType: BaseCellDataType
            ├── filter / typed filterParams
            ├── cellEditor / cellEditorParams
            ├── cellRenderer / cellRendererParams
            ├── validationRules
            ├── valueFormatterKey/config
            └── valueParserKey/config
```

There is deliberately no configurable `editing.editor`, `renderer.key`, or `filtering` wrapper when AG Grid already owns the concept.

## Runtime mapping

```text
unknown backend/storage JSON
        ↓
configuration.normalizer
        ↓
normalized EntityDefinition
        ↓
configurableSsrmGridDefaults
        + entity.gridOptions
        ↓
resolveConfigurableSsrmGridOptions
        ↓
configuration.compiler
        ├── labelKey → headerName
        ├── rowId.path → getRowId
        ├── component names → allowlist validation
        ├── formatter/parser keys → AG Grid callbacks
        ├── validation rule keys → native getValidationErrors
        ├── runtime business editable → final ColDef.editable callback
        └── fields → final ColDef[]
        ↓
concrete AgGridReact SSRM root
```

## Native configuration vs runtime ownership

Persisted/native examples: pagination, cache settings, `defaultColDef`, `rowSelection`, `cellSelection`, `invalidEditValueMode`, sortable/filter/editable booleans, native component names and static params.

Runtime-owned examples: modules, `rowModelType`, datasource, final `columnDefs`, component implementations, GridApi, `getRowId` callback, events, business selection/editability callbacks, and validation callbacks.

## Merge structure

```text
application configurable-SSRM defaults
        +
entity.gridOptions
        ↓
resolved grid options

resolved defaultColDef
        +
field native properties
        ↓
final ColDef
```

Nested merge rules are implemented, not deferred: default/field filter/editor/renderer params merge; rowSelection switches branch when `mode` changes; Cell Selection boolean replaces object; and the selection handle switches branch when range/fill `mode` changes.

## Native server filtering

`field.filter` and `field.filterParams` remain native. Type-specific params derive from AG Grid interfaces, while runtime normalization enforces the current one-condition server-query semantics.

The compiler does **not** translate query fields/operators. The feature data adapter remains that authority.

## Editing and validation

```text
AG Grid native edit entry points
        ↓
final native editable policy
        ↓
editor getValidationErrors
        ↓
valid commit
        ↓
cellValueChanged
        ↓
useGridDraftEditing BASE + LOCAL
```

Executable validation/formatter/parser behavior comes only from frontend registries.

## Stable identity

`field.colId` is AG Grid column/Grid State identity. `field.field` is the row/API value path. `entity.rowId.path` compiles to `getRowId` plus the draft row-ID accessor.

## Current consumer

The isolated `/configurable-ssrm` route uses the Transaction feature as the first real consumer while reusing the existing Transaction request mapper and SSRM loading lifecycle.

See `docs/configurable-feature/configuration-reference.md` and `docs/implementation/configurable-ssrm.md`.
