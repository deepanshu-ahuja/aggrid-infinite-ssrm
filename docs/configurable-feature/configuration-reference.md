# Configurable Feature Configuration Reference

This document describes the public configuration contracts currently defined in TypeScript for configurable business features that contain a grid/table.

Source: `frontend/src/shared/grid/configurable/configuration.types.ts`.

The contracts are being defined before the configurable runtime/compiler is wired into a concrete grid. Where this reference describes defaults or resolution semantics, those semantics are requirements for that compiler rather than a claim that the configurable grid runtime already exists.

For documentation-quality rules used by this reference and the source JSDoc, see [`documentation-standard.md`](documentation-standard.md).

## `FeatureDefinition`

### Purpose

`FeatureDefinition` is the reusable top-level configuration for one configurable business feature. A concrete feature supplies its own feature key and entity definitions while using this shared shape.

```ts
interface FeatureDefinition<
  TFeatureKey extends string = string,
  TEntityKey extends string = string,
> {
  featureKey: TFeatureKey;
  entities: Record<TEntityKey, EntityDefinition>;
}
```

### `featureKey`

**Type:** `TFeatureKey`  
**Required:** yes

Stable programmatic identity of the feature definition. It gives configuration/application code a durable way to identify the feature without depending on displayed text.

```ts
featureKey: "review"
```

The shared interface keeps this value generic so each feature can narrow its own key without maintaining one central union of every business feature.

### `entities`

**Type:** `Record<TEntityKey, EntityDefinition>`  
**Required:** yes

Map of the entity/data contexts available inside the feature. The record key is the entity's stable programmatic identity and the record value is that entity's configuration.

```ts
entities: {
  loan: loanDefinition,
  finance: financeDefinition,
}
```

For example, selecting the `loan` key gives the Loan `EntityDefinition` for this feature. Because these record keys already define the configured entity identities, there is no separate `supportedEntities` list.

## `EntityDefinition`

### Purpose

`EntityDefinition` is the reusable configuration for one entity/data context inside a feature. For the Review feature, Loan and Finance can each use this same contract while providing different values and field definitions.

```ts
interface EntityDefinition<
  TTranslationKey extends string = string,
  TFieldDefinition extends ConfigurableFieldDefinition<TTranslationKey> =
    ConfigurableFieldDefinition<TTranslationKey>,
> {
  labelKey: TTranslationKey;
  dataAdapterKey: string;
  rowId: RowIdDefinition;
  fields: readonly TFieldDefinition[];
}
```

The entity's identity comes from its key in `FeatureDefinition.entities`. The interface therefore does not repeat that identity with another `entityKey` property.

### `labelKey`

**Type:** `TTranslationKey`  
**Required:** yes

Full translation key used to resolve the entity label shown by the UI.

```ts
labelKey: "review.entities.loan.label"
```

The base contract remains string-compatible for JSON metadata, while a frontend-owned feature can narrow `TTranslationKey` to its valid translation-key union/type and get compile-time checking.

### `dataAdapterKey`

**Type:** `string`  
**Required:** yes

Key used to resolve the registered frontend data adapter for this feature/entity.

```ts
dataAdapterKey: "reviewLoan"
```

The resolved adapter is the feature/entity-specific data boundary. Its responsibility includes the data operations needed by that entity, such as loading rows and saving changes, together with the request/response mapping required to communicate with the backend API.

Conceptually:

```text
"reviewLoan"
    ↓
data-adapter registry
    ↓
Review/Loan adapter
    ├─ load rows
    ├─ save changes
    └─ map grid/API request and response shapes
```

Stronger adapter-key typing remains deferred until the adapter registry contract is designed.

### `rowId`

**Type:** `RowIdDefinition`  
**Required:** yes

Describes how to read the stable unique identifier from every API row for this entity. That identifier gives grid-related state a consistent way to refer to the same business record across data lifecycle changes.

```ts
rowId: {
  path: "id",
}
```

### `fields`

**Type:** `readonly TFieldDefinition[]`  
**Required:** yes

Fields available for the entity in configured default column order.

```ts
fields: [loanNumberField, amountField, statusField]
```

The array controls default presentation order. Identity does not depend on array position because every `FieldDefinition` has its own stable `id`.

## `RowIdDefinition`

### Purpose

Defines where an entity row's stable unique identifier is located in the API row shape.

```ts
interface RowIdDefinition {
  path: string;
}
```

### `path`

**Type:** `string`  
**Required:** yes  
**Default:** none

Field path in each API row that contains the stable unique identifier for that business record.

The common API shape is:

```ts
rowId: {
  path: "id",
}
```

Dot notation is supported when the API places the identifier inside a nested object:

```ts
rowId: {
  path: "loan.id",
}
```

The path is explicit even when the field is simply `id`; there is no implicit `id` default.

## `FieldDefinition`

### Purpose

`FieldDefinition` is the reusable contract for one field/column exposed by an entity. It separates stable configuration identity from the API row path and carries the first shared behavior needed to compile that field into grid configuration.

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
}
```

The values remain strings/JSON-compatible at runtime, but the generic parameters let frontend-owned definitions narrow them to useful compile-time types.

### `id`

**Type:** `TFieldId`  
**Required:** yes

Stable configuration identity of the field/column.

```ts
id: "loanAmount"
```

This is deliberately separate from `field`. Other configuration relationships can continue referring to `loanAmount` even if the API response path later moves from `financials.amount` to another location.

### `field`

**Type:** `TFieldPath`  
**Required:** yes

Path in the API row containing the value used by this field.

```ts
field: "amount"
```

Nested response shapes use dot notation:

```ts
field: "financials.amount"
```

A frontend feature that knows its row type can narrow `TFieldPath` to a valid field-path type/union. Backend-supplied JSON is still runtime data and must be validated before it is treated as trusted resolved configuration.

### `labelKey`

**Type:** `TTranslationKey`  
**Required:** yes

Full translation key used to resolve the field/column label.

```ts
labelKey: "review.fields.loanAmount.label"
```

As with entity labels, frontend-owned definitions can narrow the generic to valid translation keys while backend JSON remains subject to runtime configuration validation.

### `dataType`

**Type:** `FieldDataType`  
**Required:** yes

Semantic value category of the field.

Current shared values are:

```ts
"text" | "number" | "boolean" | "date" | "dateTime"
```

The data type provides the shared base filter-operator vocabulary appropriate for the field. More type-specific behavior can be designed later without changing the distinction between field identity, row binding, and semantic value type.

### `sortable`

**Type:** `boolean`  
**Required:** no  
**Default:** `true`

Controls whether users may sort by this field. Omitting it uses the shared sortable default, matching the repository's existing `baseDefaultColDef` behavior.

```ts
sortable: false
```

is used only when a particular field must not be sortable.

### `filter`

**Type:** `FieldFilterDefinition<...>`  
**Required:** no

Filtering is intentionally represented by one capability object rather than by both `filterable` and `filter` properties.

```text
filter omitted
→ field is not filterable

filter present
→ field is filterable with exactly the configured operators
```

Example:

```ts
filter: {
  operators: ["equals", "contains", "startsWith"],
}
```

There is no separate `filterable` boolean because that would duplicate the presence/absence of the filter configuration.

## Filter operator contracts

### `FieldFilterDefinition`

```ts
interface FieldFilterDefinition<TOperator extends string = FilterOperator> {
  operators: readonly [TOperator, ...TOperator[]];
}
```

`operators` is required and non-empty whenever filtering is configured. It is the complete list of operators that the UI may expose for that field.

### Shared operator sets

The base vocabulary follows the operator names already used by the repository's shared server-backed Simple Filter configuration.

Text:

```ts
"contains" | "equals" | "notEqual" | "startsWith" | "endsWith"
```

Number:

```ts
"equals"
| "notEqual"
| "greaterThan"
| "greaterThanOrEqual"
| "lessThan"
| "lessThanOrEqual"
```

Date/date-time:

```ts
"equals" | "notEqual" | "lessThan" | "greaterThan"
```

Boolean base semantics:

```ts
"equals" | "notEqual"
```

A field can expose any subset of its type-appropriate shared operators.

### Feature-specific operators

A feature may extend the shared vocabulary when it has a real extra filter semantic:

```ts
type ReviewExtraFilterOperator = "requiresReview";
```

and use that type as `TAdditionalFilterOperator` for the relevant frontend field definitions.

The string key alone does not implement custom filtering. A custom operator must eventually resolve through a bounded frontend/query mapping and corresponding backend semantics. Backend JSON must never provide executable JavaScript/functions.

## TypeScript typing versus backend JSON

The shared contracts deliberately support both concerns:

```text
frontend-authored definitions
→ narrow generic types for field IDs, row paths, translation keys and custom operator keys

backend JSON metadata
→ ordinary runtime strings/data
→ runtime configuration validation
→ trusted/resolved configuration
```

TypeScript generics improve authoring safety where types are available; they do not replace runtime validation of metadata received from the backend.

## Source ownership

These contracts live in shared configurable-grid code because their shapes are independent of a specific feature, entity, and AG Grid row model. Concrete feature/entity values and executable business behavior remain owned by the relevant feature/entity implementation.

## Documentation contract

The TypeScript declarations provide useful JSDoc for IDE hover, while this reference explains the same public contract in library-style form for readers who may not have the source open.

Non-obvious properties must explain their responsibility and interpretation, not merely restate the property name. Examples are included where they materially improve understanding. See [`documentation-standard.md`](documentation-standard.md) for the durable rules.
