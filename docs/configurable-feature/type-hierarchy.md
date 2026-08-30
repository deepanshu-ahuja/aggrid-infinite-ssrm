# Configurable Feature Type Hierarchy and AG Grid Mapping

This is the quick visual map for the public configurable-feature contracts in
`frontend/src/shared/grid/configurable/configuration.types.ts`.

It is intentionally hand-maintained while the contract is still being designed. Generated TypeDoc / type-relationship diagrams can be added once the registry, validation, access and runtime/compiler contracts are stable enough that generated output will be useful rather than noisy.

## Type hierarchy

```text
FeatureDefinition
└── entities: Record<entityKey, EntityDefinition>
    ├── labelKey
    ├── dataAdapterKey
    ├── rowId: RowIdDefinition
    │   └── path
    ├── fieldDefaults?: FieldDefaultsDefinition
    │   ├── sortable?
    │   └── layout?: FieldLayoutDefinition
    │       ├── initialVisible?
    │       ├── initialPinned?
    │       └── sizing?: FieldSizingDefinition
    │           ├── initialWidth? XOR initialFlex?
    │           ├── minWidth?
    │           ├── maxWidth?
    │           └── resizable?
    └── fields: FieldDefinition[]
        ├── id
        ├── field
        ├── labelKey
        ├── dataType
        ├── sortable?
        ├── filter?: FieldFilterDefinition
        │   └── operators[]
        ├── layout?: FieldLayoutDefinition
        ├── formatter?: FieldFormatterDefinition
        │   ├── key
        │   └── params?
        ├── renderer?: FieldRendererDefinition
        │   ├── key
        │   └── params?
        └── editing?: FieldEditingDefinition
            ├── editor?: FieldEditorDefinition
            │   ├── key
            │   ├── params?
            │   ├── popup?
            │   └── popupPosition?
            └── parser?: FieldValueParserDefinition
                ├── key
                └── params?
```

## Native-first compiler flow

```text
configuration
    ↓
frontend compiler / bounded registries
    ↓
AG Grid GridOptions / ColDef
```

The compiler must use AG Grid itself wherever AG Grid already owns the required primitive. Registry-backed behavior is an override/extension, not the default answer to every field requirement.

```text
FieldDefinition.dataType
        ↓ explicit mapping (required for SSRM)
AG Grid ColDef.cellDataType
        ↓
AG Grid native type behavior
(parser / formatter / editor / renderer / filter defaults where provided)
        ↓
field-level custom config overrides only when needed
```

AG Grid data-type inference is Client-Side Row Model only. The configurable SSRM compiler therefore sets `cellDataType` explicitly.

## Supported `dataType` mapping

The current public values intentionally map directly to the matching AG Grid cell-data-type names:

```text
text           → cellDataType: "text"
number         → cellDataType: "number"
boolean        → cellDataType: "boolean"
date           → cellDataType: "date"           (JavaScript Date value)
dateString     → cellDataType: "dateString"     (string date value)
dateTime       → cellDataType: "dateTime"       (JavaScript Date value)
dateTimeString → cellDataType: "dateTimeString" (string date-time value)
```

Do not use `date` for an ISO string merely because the value is semantically a date. AG Grid distinguishes the value representation. A JSON API date such as `"2026-08-30"` normally uses `dateString` unless the frontend adapter deliberately converts it to a JavaScript `Date` first.

## Field-to-AG-Grid mapping

```text
entity.fieldDefaults
    → bounded compiler mapping
    → AG Grid defaultColDef (on top of shared baseDefaultColDef)

entity.fields[]
    → one compiled AG Grid ColDef per field
```

```text
field.id                         → ColDef.colId
field.field                      → ColDef.field
field.labelKey                   → translated ColDef.headerName
field.dataType                   → ColDef.cellDataType
field.sortable                   → ColDef.sortable
field.filter                     → ColDef.filter + filterParams
filter omitted                   → ColDef.filter = false
layout.initialVisible            → inverse of ColDef.initialHide
layout.initialPinned             → ColDef.initialPinned
layout.sizing.initialWidth       → ColDef.initialWidth
layout.sizing.initialFlex        → ColDef.initialFlex
layout.sizing.minWidth           → ColDef.minWidth
layout.sizing.maxWidth           → ColDef.maxWidth
layout.sizing.resizable          → ColDef.resizable
formatter.key                    → formatter registry → ColDef.valueFormatter
renderer.key                     → renderer registry → ColDef.cellRenderer
renderer.params                  → ColDef.cellRendererParams
editing presence                 → composed ColDef.editable callback
editing.editor.key               → editor registry → ColDef.cellEditor
editing.editor.params            → ColDef.cellEditorParams
editing.editor.popup             → ColDef.cellEditorPopup
editing.editor.popupPosition     → ColDef.cellEditorPopupPosition
editing.parser.key               → parser registry → ColDef.valueParser
```

## What `params` means

`params` always means **extra declarative configuration**, not a replacement for the runtime information AG Grid already supplies.

### Renderer

```text
configuration renderer.params
        ↓ direct native mapping
AG Grid cellRendererParams
        +
AG Grid normal renderer props
(value, valueFormatted, data, node, column, colDef, api, ...)
        ↓
registered renderer component
```

Do not put row data, current value, GridApi or other normal AG Grid runtime values into configuration params.

### Editor

```text
configuration editor.params
        ↓ direct native mapping
AG Grid cellEditorParams
        +
AG Grid normal editor props
(value, data, node, column, onValueChange, stopEditing, parseValue, formatValue, ...)
        ↓
provided or registered custom editor/input
```

Custom inputs are supported. A registry key may resolve to a React/MUI/domain editor when AG Grid's provided editor is not sufficient. If the native editor selected by `cellDataType` is sufficient, omit `editor` instead of creating a wrapper.

### Formatter and parser

AG Grid has callback params for `valueFormatter` / `valueParser`, but there is no `valueFormatterParams` or `valueParserParams` column property analogous to `cellRendererParams` / `cellEditorParams`.

Therefore our compiler combines the normal AG Grid callback params with the extra declarative config:

```text
AG Grid ValueFormatterParams + formatter.params
    → registered formatter

AG Grid ValueParserParams + parser.params
    → registered parser
```

A custom React editor also receives AG Grid's `parseValue()` / `formatValue()` utilities, which invoke the column's configured parser/formatter.

## Editing/value flow

```text
authoritative API value
        ↓
effective grid value
        ↓
AG Grid cellDataType baseline behavior
        ↓
optional custom formatter / renderer
        ↓
editor (native or custom)
        ↓
optional custom parser override
        ↓
LOCAL draft
        ↓
tracked editing + validation
        ↓
save mapping / backend payload   [designed later]
```

Important: omitting a custom parser does **not** mean "no parsing". The `valueParser` supplied by the AG Grid cell data type may still apply. Likewise, omitting a custom renderer does not mean plain text in every case; for example AG Grid's boolean cell data type supplies checkbox rendering.

## Design guardrail

For every new public configuration property, documentation and source JSDoc must answer:

```text
1. What does the property mean in our configuration?
2. Does AG Grid already provide the required capability natively?
3. What exact GridOptions / ColDef / callback / component property does it map to?
4. What runtime information does AG Grid already supply?
5. What extra information, if any, must our configuration provide?
```

Do not add a configuration property with no real compiler/resolver path, and do not add a registry merely to reproduce a native AG Grid feature.
