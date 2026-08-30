# Configurable Feature Configuration Reference

Public reference for `frontend/src/shared/grid/configurable/configuration.types.ts`.

The configurable runtime/compiler is not wired yet. This document defines the contract the runtime must implement. Configuration is frontend-designed, JSON-safe application configuration that may later be persisted and returned by the backend; raw backend/storage data is never passed directly to AG Grid.

Quick visual reference: [`type-hierarchy.md`](type-hierarchy.md).

## Core architecture

```text
frontend-supported configuration contract
        ↓
configuration may be stored/returned by backend
        ↓
runtime validation + normalization/adaptation
        ↓
frontend compiler + registries
        ↓
AG Grid GridOptions / ColDef / callbacks / components
```

The backend/storage representation may later use different property names or shapes. A data-adapter/config-normalization boundary may transform that representation once when configuration is loaded. AG Grid consumes only the normalized frontend-supported model.

A backend property that the deployed frontend does not read/normalize/compile has no effect. Unknown required registry keys or invalid supported values must fail in a controlled, diagnosable way rather than being executed or passed through accidentally.

## AG Grid alignment rule

When our configuration exposes the same concept with the same semantics as AG Grid:

- prefer the AG Grid property name;
- reuse/derive the AG Grid TypeScript type where practical;
- avoid writing one-to-one translation code merely to rename the property;
- keep AG Grid-native behavior as the baseline.

Create our own names/types only for concepts that are genuinely application-specific, such as `featureKey`, `dataAdapterKey`, `fieldDefaults`, registry descriptors, access/masking, backend query mapping or save mapping.

This does **not** mean raw `GridOptions` or `ColDef` from the database are trusted wholesale. The supported normalized contract remains bounded and runtime-validated.

## Three categories of AG Grid configuration

```text
1. Native + declarative + JSON-safe
   → keep AG Grid name/type where semantics match
   → validate/normalize
   → merge/pass through when supported

2. Executable/configurable behavior
   → persisted config carries a JSON-safe key (+ params when needed)
   → frontend registry resolves the key
   → registry result uses the real AG Grid callback/component type

3. Runtime/compiler-owned infrastructure
   → constructed by frontend runtime
   → not treated as arbitrary persisted grid configuration
```

Examples of category 2 include custom renderers/editors/formatters/parsers and, if a real use case requires it later, callback behaviors such as a configurable cell-click handler or dynamic row-height function.

Examples of category 3 include the concrete SSRM datasource, runtime `context`, compiled `columnDefs`, API refs and lifecycle handlers. `dataAdapterKey` already identifies the frontend data/API boundary; the runtime creates the datasource from that boundary rather than persisting a datasource object.

## Defaults and merging

Current field relationship:

```text
shared baseDefaultColDef
        +
entity.fieldDefaults
        ↓
AG Grid defaultColDef

entity.fields[]
        ↓
compiled AG Grid columnDefs[]
```

Native AG Grid `ColDef` over `defaultColDef` precedence handles normal field overrides.

A future table/grid-level configuration layer should follow the same principle:

```text
frontend/application defaults
        +
normalized entity configuration
        ↓
resolved supported AG Grid options
```

The schema should not be artificially restricted to only the handful of pagination/cache options used by the current Transaction demo. Conversely, it should not expose executable/runtime-owned AG Grid properties as arbitrary backend JSON. The exact broad declarative SSRM option surface is a later runtime/schema design batch.

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

`featureKey` is stable feature identity. Entity identity is the `entities` record key.

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

- `labelKey`: full translation key.
- `dataAdapterKey`: frontend adapter key for loading/saving/request-response mapping.
- `rowId`: stable business-row identity.
- `fieldDefaults`: bounded common column configuration compiled into `defaultColDef`.
- `fields`: ordered initial field list; `id` remains stable identity.

## `RowIdDefinition`

```ts
interface RowIdDefinition {
  path: string;
}
```

`path` is explicit, supports dot notation, and has no implicit `id` default.

## `FieldDefinition`

```ts
interface FieldDefinition<...> {
  id: TFieldId;
  field: TFieldPath;
  labelKey: TTranslationKey;
  cellDataType: TCellDataType;
  sortable?: ColDef['sortable'];
  filter?: FieldFilterDefinition<...>;
  layout?: FieldLayoutDefinition;
  formatter?: FieldFormatterDefinition<TFormatterKey>;
  renderer?: FieldRendererDefinition<TRendererKey>;
  editing?: TEditingDefinition;
}
```

### Identity and API binding

```text
field.id    → stable configurable identity / future colId / editing state key
field.field → API row value path
```

They may differ. Dot notation is supported for the API path.

### `cellDataType`

The name intentionally matches AG Grid `ColDef.cellDataType`. Current supported built-ins are:

```text
text
number
boolean
date           (JavaScript Date)
dateString     (string date)
dateTime       (JavaScript Date)
dateTimeString (string date-time)
```

The type is derived from `ColDef['cellDataType']` and narrowed to the built-in values currently supported by this contract.

The first configurable proof uses SSRM, so the compiler sets `cellDataType` explicitly; AG Grid cell-data-type inference is Client-Side Row Model only. Native AG Grid type behavior is the baseline. Do not require custom formatter/renderer/editor/parser registry entries when the native type already gives the required behavior.

A JSON API value such as `"2026-08-30"` normally uses `dateString`; AG Grid `date` expects a JavaScript `Date` value unless an adapter converts the representation first.

### `sortable`

Same name/semantics as AG Grid. The type derives from `ColDef['sortable']`. Omission inherits the resolved `defaultColDef`.

## Filtering

```ts
interface FieldFilterDefinition<TFilterOption extends string = FilterOption> {
  filterOptions: readonly [TFilterOption, ...TFilterOption[]];
}
```

The name intentionally matches AG Grid `filterParams.filterOptions`.

```text
filter omitted → field is not filterable
filter present → exact non-empty allowed filterOptions
```

Shared server-query vocabulary currently supports:

```text
text:    contains, equals, notEqual, startsWith, endsWith
number:  equals, notEqual, greaterThan, greaterThanOrEqual,
         lessThan, lessThanOrEqual
date/dateString/dateTime/dateTimeString:
         equals, notEqual, lessThan, greaterThan
boolean: equals, notEqual
```

The current Transaction server-backed grids also prove common Simple Filter behavior such as Apply/Reset buttons, one condition and close-on-apply. That common behavior should inform the later filter-default/grid-option design rather than being repeated on every field.

Do not expose an AG Grid filter feature merely because AG Grid supports it if the active server-query/data-adapter contract cannot represent the same semantics. Examples include multiple conditions, `inRange`, `blank`, `notBlank`, Set Filter and Multi Filter until their full end-to-end semantics are designed.

## Layout and sizing

```ts
interface FieldLayoutDefinition {
  initialHide?: ColDef['initialHide'];
  initialPinned?: ...derived from ColDef['initialPinned'];
  sizing?: FieldSizingDefinition;
}
```

Native names are retained where semantics match:

```text
initialHide   → ColDef.initialHide
initialPinned → ColDef.initialPinned
initialWidth  → ColDef.initialWidth
initialFlex   → ColDef.initialFlex
minWidth      → ColDef.minWidth
maxWidth      → ColDef.maxWidth
resizable     → ColDef.resizable
```

`initialWidth` and `initialFlex` are mutually exclusive in our public contract. Runtime JSON validation must enforce the same rule. Initial properties seed column state; persistent constraints such as min/max/resizable continue to apply.

## `FieldDefaultsDefinition`

```ts
interface FieldDefaultsDefinition {
  sortable?: ColDef['sortable'];
  layout?: FieldLayoutDefinition;
}
```

`fieldDefaults` is our bounded grouping concept; native leaves keep AG Grid names/types. Not every future field behavior automatically belongs in defaults: defaultability requires clear inheritance and explicit override/disable semantics.

## Formatter

```ts
interface FieldFormatterDefinition<TFormatterKey extends string = string> {
  key: TFormatterKey;
  params?: ConfigurationJsonObject;
}
```

This is a custom descriptor because executable functions cannot be persisted in JSON.

```text
formatter.key
→ formatter registry
→ AG Grid-compatible valueFormatter function
→ ColDef.valueFormatter
```

AG Grid supplies `ValueFormatterParams`. Configured `params` are only extra declarative inputs combined by our compiler. There is no native `valueFormatterParams` ColDef property analogous to `cellRendererParams`.

## Renderer

```ts
interface FieldRendererDefinition<TRendererKey extends string = string> {
  key: TRendererKey;
  params?: ConfigurationJsonObject;
}
```

```text
renderer.key    → renderer registry → AG Grid-compatible component → cellRenderer
renderer.params → cellRendererParams
```

AG Grid still supplies its normal renderer props (`value`, `valueFormatted`, `data`, `node`, `column`, `colDef`, `api`, etc.). Config params should not duplicate those runtime values.

Registry implementations should use/return the real AG Grid component/callback types where practical rather than inventing parallel function signatures.

## Editing

```text
editing omitted → field is not editable
editing present → field is potentially editable
```

Actual `ColDef.editable` must still compose access/authorization, row policy, tracked-edit conflict policy and other hard runtime constraints.

### Editor

```text
editor.key      → editor registry → AG Grid-compatible cell editor → cellEditor
editor.params   → cellEditorParams
popup           → cellEditorPopup
popupPosition   → cellEditorPopupPosition
```

AG Grid supplies normal editor props including `value`, row/column information, `onValueChange`, `stopEditing`, `parseValue` and `formatValue`. Custom React/MUI/domain inputs are fully supported. If the editor supplied by `cellDataType` is sufficient, omit the custom editor.

### Parser

```text
parser.key → parser registry → AG Grid-compatible valueParser → ColDef.valueParser
```

Configured params are compiler-owned extra inputs combined with AG Grid `ValueParserParams`. If no custom parser is configured, the compiler leaves AG Grid's cell-data-type parser intact when one exists.

Parser output is the LOCAL draft value, not the backend save payload.

## Value stages

```text
1. authoritative API value
2. effective grid value (API or LOCAL overlay)
3. AG Grid cellDataType baseline behavior
4. optional custom formatted/rendered display
5. editor-produced candidate
6. native/custom valueParser output = LOCAL draft
7. validation
8. save mapping → backend payload          [later]
```

Do not collapse these stages.

## JSON-safe params and registries

Configuration params allow JSON primitives, arrays and nested objects only. Functions, React components, class instances and runtime AG Grid objects are not persisted config.

General rule:

```text
AG Grid already supplies runtime value/context
→ do not duplicate it in config params

config needs extra declarative input
→ JSON-safe params

config needs executable behavior
→ stable key → frontend registry → real AG Grid-compatible implementation
```

Later registry contracts should associate each key with its valid params type and the corresponding AG Grid implementation type.

## Strong frontend typing vs runtime data

Frontend-authored definitions can be strongly narrowed. Data loaded from backend/storage is still runtime data and must pass schema/version/registry validation and any required normalization before compilation.

Storage/backend shape and normalized frontend shape do not have to be identical. If they differ, transform once at the configuration boundary rather than scattering backend-shape checks through grid code.

## Separate future contracts

Still to design:

- broad table/grid-level SSRM declarative option surface and app/entity merge rules;
- filter defaults beyond the already-finalized field `filterOptions` core;
- validation declarations;
- server sort/filter/search mapping and searchability;
- save/request mapping;
- access/masking resolution;
- action/business-operation configuration;
- exact registry key-to-params and AG Grid implementation typing;
- runtime config versioning/validation/normalization;
- final compiler composition.
