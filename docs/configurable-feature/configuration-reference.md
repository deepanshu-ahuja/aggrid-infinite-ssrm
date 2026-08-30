# Configurable Feature Configuration Reference

This document describes the public configuration contracts currently defined in TypeScript for configurable business features that contain a grid/table.

Source: `frontend/src/shared/grid/configurable/configuration.types.ts`.

The contracts are being defined before the configurable runtime/compiler is wired into a concrete grid. Where this reference describes compiler/default semantics, those semantics are requirements for that future compiler rather than a claim that the configurable grid runtime already exists.

For documentation-quality rules used by this reference and the source JSDoc, see [`documentation-standard.md`](documentation-standard.md).

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

`featureKey` is the required stable programmatic feature identity, for example `"review"`. The generic lets each feature narrow its own key without maintaining one central union.

`entities` is the required map of entity/data contexts. The record key is the stable entity identity, so there is no duplicate `entityKey` property inside `EntityDefinition`.

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

**Required:** yes  
**Type:** `TTranslationKey`

Full explicit translation key for the entity label, for example:

```ts
labelKey: "review.entities.loan.label"
```

Frontend-owned definitions may narrow `TTranslationKey`; backend JSON remains runtime data and must later be validated.

### `dataAdapterKey`

**Required:** yes  
**Type:** `string`

Key used to resolve the registered frontend data/API adapter for this entity. The adapter owns the feature/entity-specific loading/saving boundary and the request/response mapping required by those operations.

```ts
dataAdapterKey: "reviewLoan"
```

Stronger adapter-key typing is deferred until the data-adapter registry contract is designed.

### `rowId`

**Required:** yes  
**Type:** `RowIdDefinition`

Defines how the stable business-row identifier is read from API rows.

### `fieldDefaults`

**Required:** no  
**Type:** `FieldDefaultsDefinition`

Optional defaults for fields in this entity. This is the configurable equivalent of adding values to AG Grid's `defaultColDef`.

The resolution model is intentionally simple:

```text
shared baseDefaultColDef
        +
compiled entity.fieldDefaults
        ↓
AG Grid defaultColDef

compiled entity.fields[]
        ↓
AG Grid columnDefs[]
```

AG Grid's normal precedence then applies: when an individual `ColDef` supplies a value, it overrides the same value inherited from `defaultColDef`.

This means the configurable runtime does not need a second custom field-merging framework for ordinary column defaults.

### `fields`

**Required:** yes  
**Type:** `readonly TFieldDefinition[]`

Fields available for this entity in configured initial column order. Stable identity comes from each field's `id`, not from array position.

## `RowIdDefinition`

```ts
interface RowIdDefinition {
  path: string;
}
```

`path` is required and explicit. Common case:

```ts
rowId: { path: "id" }
```

Nested API shapes can use dot notation:

```ts
rowId: { path: "loan.id" }
```

There is no implicit `id` default.

## `FieldDataType`

```ts
type FieldDataType = "text" | "number" | "boolean" | "date" | "dateTime";
```

This is the semantic value category for a field. It currently drives the shared base filter-operator vocabulary. It does not by itself finalize formatting, editing, validation, or rendering behavior.

## `FieldDefinition`

```ts
interface FieldDefinition<
  TFieldId extends string = string,
  TFieldPath extends string = string,
  TTranslationKey extends string = string,
  TDataType extends FieldDataType = FieldDataType,
  TAdditionalFilterOperator extends string = never,
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
}
```

### `id`

Stable configuration identity for the field/column. It is intentionally separate from the API row path so other configuration references can remain stable if the backend response shape changes.

```ts
id: "loanAmount"
```

### `field`

Path to the value in the API row. Direct property and nested dot-path forms are supported:

```ts
field: "amount"
field: "financials.amount"
```

Frontend-owned definitions can narrow the generic to valid row paths. Backend JSON still needs runtime validation.

### `labelKey`

Full explicit translation key for the displayed field/column label:

```ts
labelKey: "review.fields.loanAmount.label"
```

Frontend-owned definitions can narrow this to a valid translation-key type.

### `dataType`

Required semantic field type. Current values are `text`, `number`, `boolean`, `date`, and `dateTime`.

### `sortable`

**Required:** no  
**Type:** `boolean`

When supplied on the field, it overrides the resolved default-column value. When omitted, the field inherits `fieldDefaults.sortable` if configured, otherwise the shared grid default from `baseDefaultColDef`.

So omission means **inherit**, not hard-coded `true` at the field-contract level.

### `filter`

**Required:** no

Filtering is represented by one capability object rather than a separate `filterable` boolean.

```text
filter omitted
→ field is not filterable

filter present
→ field is filterable using exactly the listed operators
```

Because the existing shared AG Grid `baseDefaultColDef` currently has `filter: true`, the future configurable compiler must explicitly compile a field without `filter` to a non-filterable `ColDef`. That is a contract mapping requirement, not runtime repair of invalid configuration.

### `layout`

**Required:** no  
**Type:** `FieldLayoutDefinition`

Initial visibility/pinning plus optional sizing. Individual field values override corresponding values inherited through AG Grid's `defaultColDef` behavior.

## `FieldDefaultsDefinition`

```ts
interface FieldDefaultsDefinition {
  sortable?: boolean;
  layout?: FieldLayoutDefinition;
}
```

This is deliberately bounded rather than a copy of AG Grid `ColDef`. It contains only configurable field-level defaults that have been designed so far.

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

A field can override only the values it needs:

```ts
{
  id: "amount",
  field: "amount",
  labelKey: "review.fields.amount.label",
  dataType: "number",
  sortable: false,
  layout: {
    sizing: {
      minWidth: 180,
    },
  },
}
```

Conceptually, the final AG Grid behavior is:

```text
minWidth: 180   ← field overrides configurable default 140
resizable: true ← inherited
sortable: false ← field overrides true
```

AG Grid performs the `defaultColDef` versus `ColDef` precedence; the configurable layer's job is to compile each side correctly.

## Field filter contracts

```ts
interface FieldFilterDefinition<TOperator extends string = FilterOperator> {
  operators: readonly [TOperator, ...TOperator[]];
}
```

`operators` is required and non-empty whenever filtering is configured. It is the complete operator list the UI may expose for that field.

Shared operator sets currently align with the repository's existing server-backed filter vocabulary.

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

A feature can add a typed custom operator key through `TAdditionalFilterOperator`, but that key must later resolve through a bounded query/filter registry and matching backend semantics. Backend JSON never supplies executable JavaScript.

## Field layout and sizing

### `FieldLayoutDefinition`

```ts
interface FieldLayoutDefinition {
  initialVisible?: boolean;
  initialPinned?: "left" | "right";
  sizing?: FieldSizingDefinition;
}
```

The `initial*` naming is intentional: these values seed AG Grid column state rather than continuously forcing it.

Compiler mapping:

```text
initialVisible
→ AG Grid initialHide (inverse boolean)

initialPinned
→ AG Grid initialPinned
```

Persisted/current Grid State may later override initial visibility and pinning where current authorization allows it.

### `FieldSizingDefinition`

A field can specify an initial fixed width or an initial flex weight, never both.

Fixed-width shape:

```ts
{
  initialWidth?: number;
  initialFlex?: never;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
}
```

Flex shape:

```ts
{
  initialWidth?: never;
  initialFlex?: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
}
```

Compiler mapping:

```text
initialWidth → AG Grid initialWidth
initialFlex  → AG Grid initialFlex
minWidth     → AG Grid minWidth
maxWidth     → AG Grid maxWidth
resizable    → AG Grid resizable
```

`minWidth`/`maxWidth` remain persistent column constraints. `initialWidth`/`initialFlex` are initial state.

Frontend-authored TypeScript prevents `initialWidth` and `initialFlex` from appearing together. Runtime configuration validation must reject backend JSON that violates the same contract, as well as invalid numeric combinations such as non-positive widths/flex or `minWidth > maxWidth`.

## TypeScript typing versus backend JSON

```text
frontend-authored definitions
→ narrow generics/types where useful
→ compile-time checking

backend JSON metadata
→ runtime values
→ configuration/schema/registry validation
→ trusted resolved configuration
```

Do not weaken every TypeScript property to unconstrained `string` merely because metadata can arrive from JSON. Do not pretend TypeScript validates JSON at runtime either.

## Source ownership

These contracts live in shared configurable-grid code because their shapes are feature-, entity-, and row-model-neutral. Concrete values and executable business behavior remain feature/entity owned.
