# Configurable Feature Configuration Reference

Public reference for contracts in `frontend/src/shared/grid/configurable/configuration.types.ts`.

The configurable runtime/compiler is not wired yet. Compiler mappings described here are requirements for that runtime. Backend configuration is runtime JSON and must be validated before use; executable functions/components remain frontend-owned.

## Configuration flow

```text
shared baseDefaultColDef + entity.fieldDefaults
                    ↓
            AG Grid defaultColDef

entity.fields[] → compiled AG Grid columnDefs[]
```

Native AG Grid `ColDef` precedence handles normal field-over-default overrides.

## `FeatureDefinition`

```ts
interface FeatureDefinition<
  TFeatureKey extends string = string,
  TEntityKey extends string = string,
> {
  featureKey: TFeatureKey;
  entities: Record<TEntityKey, EntityDefinition>;
}
```

`featureKey` is stable feature identity. `entities` is keyed by stable entity identity, so entity identity is not duplicated inside `EntityDefinition`.

## `EntityDefinition`

```ts
interface EntityDefinition<...> {
  labelKey: TTranslationKey;
  dataAdapterKey: string;
  rowId: RowIdDefinition;
  fieldDefaults?: FieldDefaultsDefinition;
  fields: readonly TFieldDefinition[];
}
```

- `labelKey`: required full translation key for the entity label.
- `dataAdapterKey`: required key resolving the feature/entity data adapter for loading, saving and request/response mapping.
- `rowId`: required stable business-row identity definition.
- `fieldDefaults`: optional bounded common field config compiled into AG Grid `defaultColDef` on top of shared defaults.
- `fields`: required ordered field list; order is initial column order, while field `id` is stable identity.

`fieldDefaults` is not an unrestricted AG Grid `ColDef`; only deliberately supported configurable options belong there.

## `RowIdDefinition`

```ts
interface RowIdDefinition {
  path: string;
}
```

`path` is explicit, supports dot notation, and has no implicit `id` default.

## `FieldDefinition`

```ts
interface FieldDefinition<
  TFieldId extends string = string,
  TFieldPath extends string = string,
  TTranslationKey extends string = string,
  TDataType extends FieldDataType = FieldDataType,
  TAdditionalFilterOperator extends string = never,
  TFormatterKey extends string = string,
  TRendererKey extends string = string,
  TEditingDefinition extends FieldEditingDefinition = FieldEditingDefinition,
> {
  id: TFieldId;
  field: TFieldPath;
  labelKey: TTranslationKey;
  dataType: TDataType;
  sortable?: boolean;
  filter?: FieldFilterDefinition<...>;
  layout?: FieldLayoutDefinition;
  formatter?: FieldFormatterDefinition<TFormatterKey>;
  renderer?: FieldRendererDefinition<TRendererKey>;
  editing?: TEditingDefinition;
}
```

### Identity/binding

`id` is stable configuration identity. `field` is the API row value path. They intentionally may differ. Frontend types may narrow valid paths; backend JSON still requires runtime validation.

### Label/type

`labelKey` is a full explicit translation key. `dataType` is one of:

```ts
"text" | "number" | "boolean" | "date" | "dateTime"
```

`dataType` provides semantic value category and the shared filter vocabulary; it does not automatically choose custom formatter/editor/validator behavior.

### `sortable`

Optional. Omission inherits the resolved AG Grid `defaultColDef`; an individual value overrides the corresponding default natively.

## Filtering

```ts
interface FieldFilterDefinition<TOperator extends string = FilterOperator> {
  operators: readonly [TOperator, ...TOperator[]];
}
```

```text
filter omitted → not filterable
filter present → filterable with exactly the configured non-empty operator list
```

No duplicate `filterable` boolean.

Shared operators:

```text
text:    contains, equals, notEqual, startsWith, endsWith
number:  equals, notEqual, greaterThan, greaterThanOrEqual,
         lessThan, lessThanOrEqual
date:    equals, notEqual, lessThan, greaterThan
boolean: equals, notEqual
```

Feature-specific operator keys may extend these, but require bounded frontend/query mapping plus matching backend semantics.

## Layout/sizing

```ts
interface FieldLayoutDefinition {
  initialVisible?: boolean;
  initialPinned?: "left" | "right";
  sizing?: FieldSizingDefinition;
}
```

Compiler mapping:

```text
initialVisible → inverse of AG Grid initialHide
initialPinned  → AG Grid initialPinned
initialWidth   → AG Grid initialWidth
initialFlex    → AG Grid initialFlex
minWidth       → AG Grid minWidth
maxWidth       → AG Grid maxWidth
resizable      → AG Grid resizable
```

`initialWidth` and `initialFlex` are mutually exclusive. Runtime validation must reject the same invalid combination that TypeScript rejects. Initial settings seed column state; they do not continuously override later Grid State/user choices. `minWidth`, `maxWidth`, `resizable` remain continuing constraints.

## `FieldDefaultsDefinition`

```ts
interface FieldDefaultsDefinition {
  sortable?: boolean;
  layout?: FieldLayoutDefinition;
}
```

These settings compile into `defaultColDef` on top of shared defaults. Individual fields compile into `columnDefs` and naturally override matching properties.

Not every field property is automatically defaultable. A defaulted behavior needs clean inheritance and clean explicit override/disable semantics.

## Formatter

```ts
interface FieldFormatterDefinition<TFormatterKey extends string = string> {
  key: TFormatterKey;
  params?: ConfigurationJsonObject;
}
```

A formatter is registered frontend value-presentation behavior. Backend config supplies only key + JSON-safe params.

```text
formatter key/params → formatter registry → resolved function → AG Grid valueFormatter
```

It does not mutate raw row data, redefine edit/save values or redefine server sort/filter semantics. AG Grid can apply `valueFormatter` to clipboard/export, so configurable export integration must preserve the intended policy deliberately.

## Renderer

```ts
interface FieldRendererDefinition<TRendererKey extends string = string> {
  key: TRendererKey;
  params?: ConfigurationJsonObject;
}
```

A renderer selects richer frontend cell UI.

```text
renderer key → renderer registry → React component → AG Grid cellRenderer
renderer params → registered renderer input / cellRendererParams
```

No renderer means normal AG Grid rendering. Formatter and renderer may coexist; a renderer can use both raw and formatted values. Plain text formatting should use a formatter rather than a renderer.

## Editing

### Capability semantics

```text
editing omitted
→ field is not editable

editing present
→ field is eligible/potentially editable
→ actual row/cell editability still must satisfy runtime policy
```

Presence of `editing` must **not** compile to unconditional `editable: true`. The compiler's AG Grid `editable` callback must compose:

- current resolved authorization/access;
- feature/entity row-edit eligibility policy;
- tracked-editing conflict rules;
- any other current hard runtime constraint.

This preserves the existing architecture where the feature decides which fields/rows may edit while shared editing owns change tracking, reconciliation, conflict handling and lifecycle.

### `FieldEditingDefinition`

```ts
interface FieldEditingDefinition<
  TEditorKey extends string = string,
  TParserKey extends string = string,
> {
  editor?: FieldEditorDefinition<TEditorKey>;
  parser?: FieldValueParserDefinition<TParserKey>;
}
```

An empty editing object is valid:

```ts
editing: {}
```

and means the field is editable using the editor AG Grid selects from the semantic data type, subject to runtime editability policy.

### `FieldEditorDefinition`

Custom editors are registry-selected; configuration never carries React components/functions.

```ts
editor: {
  key: "transactionDate",
  params: { /* JSON-safe */ },
  popup: true,
  popupPosition: "under",
}
```

Compiler mapping:

```text
editor.key    → frontend editor registry → AG Grid cellEditor
editor.params → AG Grid cellEditorParams / registered editor input
popup         → AG Grid cellEditorPopup
popupPosition → AG Grid cellEditorPopupPosition
```

Popup position is valid only when `popup: true`; TypeScript and runtime validation must enforce this. Supported positions are `over` and `under`.

When `editor` is omitted, use AG Grid's data-type-selected provided editor where suitable instead of registering trivial wrappers merely to reproduce native behavior.

### `FieldValueParserDefinition`

```ts
interface FieldValueParserDefinition<TParserKey extends string = string> {
  key: TParserKey;
  params?: ConfigurationJsonObject;
}
```

Parser purpose:

```text
editor/import candidate
        ↓
registered parser
        ↓
local draft value
```

The compiler maps it to AG Grid `valueParser`. It is **not** the backend save-payload mapper.

If no parser is configured, the editor-produced value becomes the local draft unchanged.

AG Grid can reuse `valueParser` for clipboard/fill/import-style operations depending grid configuration. That behavior must be deliberate in the configurable runtime.

### Value stages

Keep these stages distinct:

```text
1. authoritative API row value
2. effective grid value (authoritative or LOCAL draft overlay)
3. formatted display value
4. editor-produced candidate
5. parser output = LOCAL draft value
6. validation of LOCAL draft
7. save mapping → backend payload        [designed later]
```

Do not collapse these into one "value" concept.

### Stable editing identity

Configurable tracked-editing state must key edits/conflicts/validation by `FieldDefinition.id`, not by the API path. The compiler/adaptor reads/writes through `FieldDefinition.field` (or a later bounded accessor) while stable state references use `id`.

The existing Transactions implementation can use property names directly because its editable field names and row properties happen to match; the reusable configurable design must not depend on that coincidence.

### Parser vs normalizer

`valueParser` only covers the AG Grid editor/import candidate path. Programmatic bulk/current-page edits can bypass it. Therefore this contract does **not** pretend parser is a universal normalizer. If a real requirement needs canonicalization across every local edit source, design a separate normalization stage later and route every edit source through it explicitly.

## JSON-safe parameters

`ConfigurationJsonValue`/`ConfigurationJsonObject` allow JSON primitives, arrays and nested objects only. Registered formatter/renderer/editor/parser infrastructure must validate both key existence and the allowed parameter schema for that key.

## Strong frontend typing vs runtime JSON

Frontend definitions may narrow field IDs, row paths, translation keys, extra filter keys, formatter/renderer keys, and the editing-definition type. Backend JSON remains runtime data and requires schema + registry validation before compilation.

## Separate future contracts

Still separate from the contracts above:

- validation declarations;
- server sort/filter/search key mapping and searchability;
- save/request mapping;
- access/masking resolution;
- action/business-operation columns;
- exact registry implementations;
- runtime config versioning/validation;
- final compiler composition.
