# Configurable Feature Configuration Reference

This document describes the public TypeScript contracts currently defined for configurable business features containing a grid/table.

Source: `frontend/src/shared/grid/configurable/configuration.types.ts`.

The configurable runtime/compiler is not wired yet. Compiler mappings described here are requirements for that runtime, not a claim that the configurable grid already exists.

## Configuration flow

```text
shared baseDefaultColDef
        +
EntityDefinition.fieldDefaults
        ↓
AG Grid defaultColDef

EntityDefinition.fields[]
        ↓
compiled AG Grid columnDefs[]
```

AG Grid column definitions naturally override matching properties from `defaultColDef`. The configurable layer should use that native precedence rather than inventing a second general-purpose merge engine.

Backend-provided configuration remains runtime JSON data and must be validated before compilation. Executable functions and React components never come from backend metadata.

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

`featureKey` is the stable programmatic identity of the business feature, for example `"review"`. `entities` is keyed by stable entity identity, so `EntityDefinition` does not duplicate an `entityKey` member.

## `EntityDefinition`

```ts
interface EntityDefinition<
  TTranslationKey extends string = string,
  TFieldDefinition extends ConfigurableFieldDefinition<TTranslationKey> =
    ConfigurableFieldDefinition<TTranslationKey>,
> {
  labelKey: TTranslationKey;
  dataAdapterKey: string;
  rowId: RowIdDefinition;
  fieldDefaults?: FieldDefaultsDefinition;
  fields: readonly TFieldDefinition[];
}
```

### `labelKey`

Required full translation key for the displayed entity label, for example `review.entities.loan.label`. Frontend-owned definitions may narrow the generic to valid translation keys; backend JSON still requires runtime validation.

### `dataAdapterKey`

Required key resolving the frontend data adapter for this feature/entity. The adapter owns loading/saving plus request/response mapping needed by those data operations. It is not a bucket for unrelated business actions.

### `rowId`

Required definition of stable business-row identity.

### `fieldDefaults`

Optional defaults shared by configured fields in this entity. These values are compiled on top of the repository's shared `baseDefaultColDef` and passed through AG Grid `defaultColDef`.

An individual `FieldDefinition` compiles into its own `ColDef`; where it supplies the same property, AG Grid's normal column-definition precedence wins.

This contract intentionally exposes only configurable defaults that have been designed and have clean default/override semantics. It is not an alias for AG Grid `ColDef` and does not imply that every AG Grid column property can be placed here.

### `fields`

Required ordered field list. Array order is the initial column order; stable identity comes from each field's `id`, not array position.

## `RowIdDefinition`

```ts
interface RowIdDefinition {
  path: string;
}
```

`path` is required and identifies the stable unique ID in each API row. Direct `id` is the common case; dot notation such as `loan.id` supports nested response shapes. There is no implicit `id` default.

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
> {
  id: TFieldId;
  field: TFieldPath;
  labelKey: TTranslationKey;
  dataType: TDataType;
  sortable?: boolean;
  filter?: FieldFilterDefinition<
    FilterOperatorForDataType<TDataType> | TAdditionalFilterOperator
  >;
  layout?: FieldLayoutDefinition;
  formatter?: FieldFormatterDefinition<TFormatterKey>;
  renderer?: FieldRendererDefinition<TRendererKey>;
}
```

### `id`

Required stable configuration identity for the field/column, such as `loanAmount`. It is deliberately independent of the API row path so references to this configured field can remain stable if the backend response shape changes.

### `field`

Required API row path containing the field value, such as `amount` or `financials.amount`. Frontend-owned config may narrow this generic to valid row-path strings.

### `labelKey`

Required full translation key for the column heading, for example `review.fields.loanAmount.label`.

### `dataType`

Required semantic value category:

```ts
"text" | "number" | "boolean" | "date" | "dateTime"
```

It supplies the type-appropriate shared filter vocabulary. It does not by itself choose a custom formatter, renderer, editor or validator.

### `sortable`

Optional. Omission means inherit the resolved AG Grid `defaultColDef`: configurable `fieldDefaults.sortable` when supplied, otherwise the shared grid default. Supplying a value on the field overrides that default through normal AG Grid precedence.

### `filter`

Optional capability object. There is no separate `filterable` boolean.

```text
filter omitted
→ this field is not filterable

filter present
→ field is filterable with exactly the configured operators
```

The operator list is required and non-empty.

## Filter operators

Shared operator vocabulary currently follows the repository's existing server-backed Simple Filter contract.

Text:

```text
contains, equals, notEqual, startsWith, endsWith
```

Number:

```text
equals, notEqual, greaterThan, greaterThanOrEqual,
lessThan, lessThanOrEqual
```

Date/date-time:

```text
equals, notEqual, lessThan, greaterThan
```

Boolean:

```text
equals, notEqual
```

Feature-specific operators can extend the shared vocabulary through `TAdditionalFilterOperator`, but each custom key must eventually resolve through a bounded query/operator registry and matching backend semantics. A string key is configuration identity, not executable behavior.

## Field layout and sizing

### `FieldLayoutDefinition`

```ts
interface FieldLayoutDefinition {
  initialVisible?: boolean;
  initialPinned?: "left" | "right";
  sizing?: FieldSizingDefinition;
}
```

These are initial-state values, not permanent enforcement rules.

Compiler mapping:

```text
initialVisible → inverse of AG Grid initialHide
initialPinned  → AG Grid initialPinned
```

Using AG Grid's `initial*` column properties seeds initial state without repeatedly overwriting later user/Grid-State choices when column definitions are rebuilt.

### `FieldSizingDefinition`

A field may declare either `initialWidth` or `initialFlex`, never both. The TypeScript union prevents that combination for frontend-authored definitions; runtime validation must reject the same invalid combination in backend JSON.

```text
initialWidth → AG Grid initialWidth
initialFlex  → AG Grid initialFlex
minWidth     → AG Grid minWidth
maxWidth     → AG Grid maxWidth
resizable    → AG Grid resizable
```

`minWidth`/`maxWidth` remain continuing constraints and may bound flex sizing. Numeric validation must reject invalid values such as non-positive width/flex or `minWidth > maxWidth`.

## `FieldDefaultsDefinition`

```ts
interface FieldDefaultsDefinition {
  sortable?: boolean;
  layout?: FieldLayoutDefinition;
}
```

`fieldDefaults` is the configurable equivalent of “common settings for these configured fields”; it compiles into AG Grid `defaultColDef`, but it is not itself named `defaultColDef` because it is not AG Grid's unrestricted `ColDef` contract.

Example:

```ts
fieldDefaults: {
  sortable: true,
  layout: {
    sizing: {
      minWidth: 140,
      resizable: true,
    },
  },
}
```

An individual field can then override the relevant setting in its own definition.

## Formatter contract

### `FieldFormatterDefinition`

```ts
interface FieldFormatterDefinition<TFormatterKey extends string = string> {
  key: TFormatterKey;
  params?: ConfigurationJsonObject;
}
```

A formatter is for value presentation. Configuration supplies a stable registry key and optional JSON-safe parameters; it never supplies a JavaScript function.

Example:

```ts
formatter: {
  key: "currency",
  params: {
    currencyField: "currency",
  },
}
```

Conceptual compiler flow:

```text
formatter.key + formatter.params
        ↓
frontend formatter registry
        ↓
resolved safe formatter function
        ↓
AG Grid valueFormatter
```

The formatter must not mutate the row or redefine the raw business value used for editing/saving. Server sorting/filtering continues to use its query mapping rather than formatted display text.

AG Grid can use `valueFormatter` for clipboard/CSV/Excel output depending grid/export configuration. The configurable runtime must preserve the project's intended export policy deliberately rather than assuming formatting is visible-cell-only.

No explicit custom formatter means the compiler does not add one for the field; normal AG Grid/cell-data-type behavior can still apply.

## Renderer contract

### `FieldRendererDefinition`

```ts
interface FieldRendererDefinition<TRendererKey extends string = string> {
  key: TRendererKey;
  params?: ConfigurationJsonObject;
}
```

A renderer selects richer cell UI such as a status chip, link-like interaction, or another bounded presentation component. Backend metadata contains only the renderer key and declarative JSON-safe params; the React component stays frontend-owned.

Example:

```ts
renderer: {
  key: "statusChip",
}
```

Conceptual compiler flow:

```text
renderer.key
    ↓
frontend renderer registry
    ↓
React renderer component
    ↓
AG Grid cellRenderer

renderer.params
    ↓
AG Grid cellRendererParams / registered renderer input
```

No renderer means normal AG Grid cell rendering.

### Formatter + renderer together

They are not mutually exclusive. AG Grid renderer params can expose both raw and formatted values, so a renderer may deliberately render a formatter's output.

```text
raw value
   ↓
formatter (optional) → formatted value
   ↓
renderer (optional) can use raw and/or formatted value
```

Do not use a renderer merely to format plain text when a formatter is sufficient. Conversely, do not force rich React UI into a formatter.

The existing Transactions grid demonstrates the distinction: amount/date use `valueFormatter`, while Status uses a React `cellRenderer`.

## JSON-safe params

Formatter/renderer parameters use the recursive `ConfigurationJsonValue`/`ConfigurationJsonObject` types. They may contain JSON primitives, arrays and nested objects, but never functions, class instances or React elements.

The future registry/runtime validation layer must validate not only that a key exists but also that its parameter shape is accepted by that registered behavior.

## Strong typing vs runtime JSON

```text
frontend-authored config
→ generics can narrow field IDs, row paths, translation keys,
  custom filter keys, formatter keys and renderer keys

backend JSON config
→ runtime values
→ schema + registry/capability validation
→ trusted resolved configuration
→ compiler
```

TypeScript does not validate backend JSON. Runtime validation is mandatory.

## Boundaries still intentionally separate

Formatter/renderer configuration does not finalize:

- editing/editor selection;
- parser/normalizer/value conversion;
- validation declarations;
- server sort/filter/search field mapping;
- request/save mapping;
- access/masking rules;
- action columns or other non-data business operations.

Those are separate contracts and should not be smuggled into renderer params merely because a renderer is executable on the frontend.
