# Configurable Feature Concepts

Plain-language meanings for the configurable feature/grid model.

For the visual type tree and AG Grid mapping, see [`type-hierarchy.md`](type-hierarchy.md).

```text
Feature definition
→ overall configurable business feature.

Entity key
→ stable business/configuration identity inside a feature, e.g. "transaction" or "loan".

Entity definition
→ reusable configuration for one data context; the shared type itself does not hard-code Transaction, Loan, Finance, etc.

Data adapter
→ frontend data/API boundary for normalization, loading, saving and request/response mapping.

Row identity
→ API row field/path containing the stable business-record ID; runtime code uses it to build AG Grid getRowId behavior.

Grid options
→ bounded JSON-safe native AG Grid options for the configurable SSRM root.

Field definition
→ one normalized field/column definition, using native ColDef names wherever the stored value has native semantics.

colId
→ stable AG Grid Column ID and application field identity used for Grid State/API/draft/validation identity.

field
→ actual value path in the normalized API row; may differ from colId.

filtering
→ application/server-query capability descriptor. It remains custom because backend query support is part of its meaning.

valueFormatterKey / valueParserKey
→ safe frontend registry selectors for executable AG Grid functions.
```

## Where Transaction/Loan identity actually lives

The business entity name comes from the `FeatureDefinition.entities` record key:

```text
Review feature
├── "transaction" → EntityDefinition
└── "loan"        → EntityDefinition
```

A TypeDoc heading such as:

```text
EntityDefinition<TLabelKey, TFieldDefinition>
```

only describes TypeScript constraints. `TLabelKey` narrows translation keys and `TFieldDefinition` narrows the field shape. Neither identifies the business entity.

## Frontend-designed, backend-stored configuration

The persistence/runtime flow remains:

```text
frontend-supported config design
        ↓
may be stored/managed by backend/database
        ↓
backend response
        ↓
validate + normalize/adapt ALWAYS
        ↓
normalized frontend config
        ↓
compiler/registries/runtime policy
        ↓
AG Grid
```

Normalization does not disappear when backend/storage keys happen to match normalized frontend keys. If storage later renames `gridOptions` or one nested property, the adapter maps it once and downstream code keeps consuming the same normalized model.

## Native AG Grid alignment

Use native AG Grid vocabulary when the concept **and persisted value semantics** are genuinely the same:

```text
same concept + same value semantics
→ same AG Grid property name
→ reuse/derive AG Grid TypeScript type where practical
```

This applies at both levels:

```text
GridOptions level
→ pagination
→ cacheBlockSize
→ cellSelection
→ invalidEditValueMode
→ suppressClipboardPaste
→ defaultColDef
→ ...

ColDef level
→ colId
→ field
→ cellDataType
→ editable
→ cellEditor
→ cellEditorParams
→ cellEditorPopup
→ cellEditorPopupPosition
→ cellRenderer
→ cellRendererParams
→ suppressPaste
→ suppressFillHandle
→ ...
```

`defaultColDef` now lives inside `entity.gridOptions` because AG Grid itself defines it as a GridOptions property.

## Why `cellEditor` and `cellRenderer` can stay native

AG Grid supports selecting provided or registered components by string name. That means persisted normalized config can safely carry:

```ts
{
  cellEditor: "transactionAccountEditor",
  cellRenderer: "statusChip"
}
```

The frontend/runtime still owns the actual React/component registrations. Backend JSON chooses only from names that the deployed frontend allows.

This is why the previous custom shapes are gone:

```text
editing.editor.key
renderer.key
```

They duplicated a native JSON-safe AG Grid capability.

## Why parser/formatter still need explicit registry keys

AG Grid `valueParser` and `valueFormatter` are executable function/expression properties, not component-name references.

Persisting arbitrary AG Grid expression strings would turn backend configuration into executable frontend logic, which this architecture does not allow.

Therefore:

```text
valueParserKey
→ frontend registry
→ real AG Grid valueParser function

valueFormatterKey
→ frontend registry
→ real AG Grid valueFormatter function
```

Optional `valueParserConfig` / `valueFormatterConfig` are extra JSON-safe data interpreted by those registered implementations. AG Grid still supplies its normal runtime callback params.

## Native-first editing learned from the merged SSRM spike

The merged `/ssrm-native-editing` spike is the editing architecture reference for configurable design. It demonstrated that AG Grid should own interactions it already implements:

```text
normal cell edit
Cell Selection
Ctrl/Cmd+D Copy Range Down
Ctrl/Cmd+Enter selected-cell edit
Fill Handle
clipboard/paste
        ↓
AG Grid applies native editable rules
        ↓
cellValueChanged for committed changes
```

We therefore do **not** create configurable alternatives such as `applyLastEdit`, `bulkCurrentPageEdit` or a generic custom range-edit engine.

Native configuration drives those interactions:

```text
gridOptions.cellSelection
gridOptions.invalidEditValueMode
gridOptions.suppressClipboardPaste
field.editable
field.suppressPaste
field.suppressFillHandle
```

Non-editable targets are already skipped by native Fill Handle/paste editing. Application row/access policy must be composed into AG Grid `editable` rather than reimplemented separately inside every native operation.

## Validation is declarative policy adapted into native editor lifecycle

The spike also changed the expected validation integration.

Provided AG Grid editors can receive executable `getValidationErrors` through runtime `cellEditorParams`. Custom React/MUI editors communicate validation with `useGridCellEditor`, including `getValidationErrors` and `getValidationElement`.

Those callbacks are **not configuration**. A future configurable validation declaration should remain data, for example rule keys + params/messages, and runtime code adapts those rules into the native AG Grid editor validation lifecycle.

The grid-level native option:

```text
invalidEditValueMode: "block"
```

can then prevent invalid editor input from committing and becoming a dirty draft.

## Lightweight draft editing is runtime infrastructure

The merged spike's generic draft state keeps only genuinely dirty fields:

```text
rowId
└── field
    ├── baseValue
    └── value
```

This BASE+LOCAL state exists so unsaved values survive SSRM RowNode/store recreation. It does not copy complete API responses or server blocks into React state.

These are runtime/shared mechanics rather than backend metadata:

```text
baseValue/value storage
dirty row/cell counts
revert-to-BASE cleanup
selected ∩ dirty payload construction
safe save acknowledgement/rebase
SSRM LOCAL restore
Discard → clear draft + authoritative refresh
```

The previous REMOTE/conflict layer is not automatically part of configurable editing. Concurrency/conflict/versioning remains a separate product decision.

## Grid-level config vs runtime-owned React props

`AgGridReact` accepts many values as props, but that does not make every prop suitable for persisted configuration.

Configurable native examples:

```text
pagination
paginationPageSize
cacheBlockSize
cellSelection
invalidEditValueMode
undoRedoCellEditing
rowHeight
```

Runtime-owned examples:

```text
modules
serverSideDatasource
columnDefs
context
getRowId callback
event handlers
GridApi refs
```

`CellSelectionModule` and `ClipboardModule` are required runtime/bundle capabilities for the native editing features proved by the spike. They are not backend configuration values.

## Defaults and merging

```text
application configurable-SSRM defaults
        +
entity.gridOptions overrides
        ↓
resolved GridOptions
```

Then:

```text
resolved gridOptions.defaultColDef
        +
individual FieldDefinition properties
        ↓
final ColDef
```

The later compiler/normalizer must define the exact nested merge semantics. The normalized model keeps AG Grid property names either way.

## Filtering remains intentionally application-specific

```text
filtering omitted
→ field is not exposed as server-filterable

filtering present
→ compiler selects the appropriate AG Grid filter
→ filterOptions become filterParams.filterOptions
```

This is one place where blindly renaming the descriptor to `filter` would be misleading: the persisted meaning includes server-query support, not only filter component selection.

## Cell data types

Supported normalized AG Grid built-in names now include:

```text
text
number
bigint
boolean
date
dateString
dateTime
dateTimeString
object
```

SSRM requires explicit types. `bigint` and complex `object` rows may require data-adapter conversion or registered formatter/parser behavior before AG Grid receives values in the representation that the selected cell data type expects.

## Example

```ts
{
  colId: "transactionDate",
  field: "transactionDate",
  labelKey: "review.fields.transactionDate.label",
  cellDataType: "dateString",
  editable: true,
  initialWidth: 180,
  cellEditor: "transactionDateEditor",
  cellEditorPopup: true,
  cellEditorPopupPosition: "under",
  valueFormatterKey: "date"
}
```

And the entity can configure native grid editing behavior separately:

```ts
{
  gridOptions: {
    invalidEditValueMode: "block",
    cellSelection: {
      enableHeaderHighlight: true,
      handle: { mode: "fill", direction: "y" }
    }
  }
}
```

Both objects still pass through runtime validation/normalization before compilation.
