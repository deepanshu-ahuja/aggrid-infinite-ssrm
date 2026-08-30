# Configurable Feature Configuration Reference

This document describes the public TypeScript configuration contracts for configurable business features that contain a grid/table.

Source: `frontend/src/shared/grid/configurable/configuration.types.ts`.

The contracts are being defined before the configurable runtime/compiler is wired into a concrete grid. Where this reference describes compiler mappings or defaults, those are requirements for that future runtime rather than a claim that the configurable grid is already implemented.

For documentation-quality rules, see [`documentation-standard.md`](documentation-standard.md).

## `FeatureDefinition`

`FeatureDefinition` is the reusable top-level definition for one configurable business feature.

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

Stable programmatic feature identity, for example:

```ts
featureKey: "review"
```

The generic lets each feature narrow its own key without requiring one central union of every business feature.

### `entities`

**Type:** `Record<TEntityKey, EntityDefinition>`  
**Required:** yes

Map of entity/data contexts available inside the feature. The record key is the entity's stable identity, so there is no duplicate `entityKey` property or `supportedEntities` list.

```ts
entities: {
  loan: loanDefinition,
  finance: financeDefinition,
}
```

## `EntityDefinition`

Reusable configuration for one entity/data context inside a feature.

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

### `labelKey`

**Type:** `TTranslationKey`  
**Required:** yes

Full translation key used to resolve the entity label.

```ts
labelKey: "review.entities.loan.label"
```

Frontend-owned definitions can narrow the generic to valid translation keys. Backend JSON is still runtime data and requires runtime validation.

### `dataAdapterKey`

**Type:** `string`  
**Required:** yes

Key used to resolve the registered frontend data adapter for this feature/entity.

```ts
dataAdapterKey: "reviewLoan"
```

The resolved adapter is the feature/entity data boundary for loading, saving, and the request/response mapping needed by those operations. It is not a container for unrelated business utilities.

### `rowId`

**Type:** `RowIdDefinition`  
**Required:** yes

Defines how the stable business-record ID is read from each API row.

### `fields`

**Type:** `readonly TFieldDefinition[]`  
**Required:** yes

Fields available for the entity in configured default column order. Array order gives the starting column order; stable identity comes from each field's `id`, not its array position.

## `RowIdDefinition`

```ts
interface RowIdDefinition {
  path: string;
}
```

### `path`

**Type:** `string`  
**Required:** yes  
**Default:** none

API-row path containing the stable unique business-record ID.

```ts
rowId: { path: "id" }
```

Nested shapes can use dot notation:

```ts
rowId: { path: "loan.id" }
```

The path stays explicit even for the common `id` case.

## `FieldDefinition`

`FieldDefinition` is the reusable contract for one entity field/column. It separates stable configuration identity from API binding and then composes field capabilities such as filtering and layout.

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

**Type:** `TFieldId`  
**Required:** yes

Stable configuration identity for the field.

```ts
id: "loanAmount"
```

This is intentionally different from `field`. The API response path can change while configuration references continue to use the same stable ID. The compiler should use this stable identity as the AG Grid `colId`.

### `field`

**Type:** `TFieldPath`  
**Required:** yes

Path in the API row containing the field value.

```ts
field: "amount"
```

Nested response shapes can use dot notation:

```ts
field: "financials.amount"
```

AG Grid supports dot-notation `field` paths. Frontend-owned definitions can narrow this generic to valid row-path strings; backend JSON still requires runtime validation.

### `labelKey`

**Type:** `TTranslationKey`  
**Required:** yes

Full translation key for the displayed field/column label.

```ts
labelKey: "review.fields.loanAmount.label"
```

The compiler resolves this key to the AG Grid header text rather than storing user-facing text directly in configuration.

### `dataType`

**Type:** `FieldDataType`  
**Required:** yes

Current shared values:

```ts
"text" | "number" | "boolean" | "date" | "dateTime"
```

The value describes the semantic cell value category and selects the shared base filter vocabulary. The future compiler should also map it to AG Grid cell-data-type behavior where appropriate; AG Grid currently has matching built-in `text`, `number`, `boolean`, `date`, and `dateTime` types. Formatter/editor overrides remain separate design areas.

### `sortable`

**Type:** `boolean`  
**Required:** no  
**Default:** `true`

Controls whether users may sort the field. Omission uses the repository's shared sortable default.

### `filter`

**Type:** `FieldFilterDefinition<...>`  
**Required:** no

There is no duplicate `filterable` boolean.

```text
filter omitted
→ field is not filterable

filter present
→ field is filterable with exactly the listed operators
```

Because the repository's shared `defaultColDef` currently enables filtering globally, the configurable compiler must explicitly compile an omitted `filter` to `filter: false`; otherwise the public contract would be contradicted by the shared AG Grid default.

## Filter contracts

### `FieldFilterDefinition`

```ts
interface FieldFilterDefinition<TOperator extends string = FilterOperator> {
  operators: readonly [TOperator, ...TOperator[]];
}
```

`operators` is required and non-empty whenever filtering is configured.

Shared text operators:

```text
contains, equals, notEqual, startsWith, endsWith
```

Shared number operators:

```text
equals, notEqual, greaterThan, greaterThanOrEqual,
lessThan, lessThanOrEqual
```

Shared date/date-time operators:

```text
equals, notEqual, lessThan, greaterThan
```

Shared boolean semantics:

```text
equals, notEqual
```

A feature can extend the shared vocabulary with a typed custom operator key when it has a real extra business semantic. The key itself is not executable behavior; it must later resolve through bounded frontend/query mapping and corresponding backend semantics.

## Field layout and sizing

Layout is a bounded field-level contract for **initial column state and sizing constraints**. It is not a renamed copy of AG Grid `ColDef`, and it is intentionally separate from formatter/renderer/editor design.

```ts
interface FieldLayoutDefinition {
  defaultVisible?: boolean;
  defaultPinned?: "left" | "right";
  sizing?: FieldSizingDefinition;
}
```

### `layout`

**Type:** `FieldLayoutDefinition`  
**Required:** no

Omitting `layout` uses normal shared grid defaults.

Layout values describe starting user-facing column state. They are not authorization rules. Persisted user Grid State may later override these defaults; current access/masking constraints will be resolved separately and must take precedence when that contract is designed.

### `defaultVisible`

**Type:** `boolean`  
**Required:** no  
**Default:** `true`

Whether the field starts visible.

Compiler mapping:

```text
defaultVisible: true  → initialHide: false
defaultVisible: false → initialHide: true
```

The compiler uses AG Grid's **initial** visibility property so reapplying column definitions does not reset visibility chosen/restored by the user.

### `defaultPinned`

**Type:** `"left" | "right"`  
**Required:** no  
**Default:** unpinned

Initial pin side for the field.

Compiler mapping:

```text
defaultPinned → initialPinned
```

Again, `initialPinned` is intentional: later user pin/unpin state should not be overwritten simply because column definitions are rebuilt.

## `FieldSizingDefinition`

`FieldSizingDefinition` combines an initial width strategy with constraints that remain authoritative after creation.

```ts
type FieldSizingDefinition =
  | (FieldSizingConstraintsDefinition & {
      defaultWidth?: number;
      defaultFlex?: never;
    })
  | (FieldSizingConstraintsDefinition & {
      defaultWidth?: never;
      defaultFlex?: number;
    });
```

The TypeScript union makes `defaultWidth` and `defaultFlex` mutually exclusive for frontend-authored configuration. Runtime validation must enforce the same rule for backend JSON.

### `defaultWidth`

**Type:** `number`  
**Required:** no

Initial fixed width in pixels.

Compiler mapping:

```text
defaultWidth → initialWidth
```

It deliberately does **not** map to the stateful AG Grid `width`, because updating a stateful width can overwrite a width the user changed or restored from Grid State.

### `defaultFlex`

**Type:** `number`  
**Required:** no

Initial AG Grid flex weight. Flex columns share remaining available width in proportion to their flex values.

Compiler mapping:

```text
defaultFlex → initialFlex
```

A field cannot declare both `defaultWidth` and `defaultFlex`. AG Grid itself treats width and flex as incompatible for the same column. Flex still respects `minWidth` and `maxWidth`.

### `minWidth`

**Type:** `number`  
**Required:** no  
**Default:** shared grid behavior (currently the repository's `baseDefaultColDef` supplies `120`)

Persistent minimum-width constraint.

```text
minWidth → minWidth
```

### `maxWidth`

**Type:** `number`  
**Required:** no  
**Default:** no field-specific maximum

Persistent maximum-width constraint.

```text
maxWidth → maxWidth
```

AG Grid applies `maxWidth` to both fixed and flex-sized columns.

### `resizable`

**Type:** `boolean`  
**Required:** no  
**Default:** `true`

Controls whether the user may manually resize the field.

```text
resizable → resizable
```

### Runtime validation requirements

TypeScript cannot prove numeric validity for JSON. The runtime configuration validator must reject invalid layout/sizing data, including at least:

- `defaultWidth` and `defaultFlex` both present;
- non-positive width/flex/min/max values;
- `minWidth > maxWidth`;
- a fixed default width outside declared min/max bounds when both are supplied.

The exact validation library/schema remains a later design decision.

## Compiler mapping principle

The configurable public API must stay business/config oriented, but every accepted field-level property needs a deliberate implementation path into AG Grid or a bounded frontend resolver/registry.

Current expected mapping is:

```text
FieldDefinition.id                     → ColDef.colId
FieldDefinition.field                  → ColDef.field
FieldDefinition.labelKey               → translated ColDef.headerName
FieldDefinition.dataType               → ColDef.cellDataType / type-specific compiler behavior
FieldDefinition.sortable               → ColDef.sortable
FieldDefinition.filter                 → filter + filterParams; absent → filter: false
layout.defaultVisible                  → ColDef.initialHide
layout.defaultPinned                   → ColDef.initialPinned
layout.sizing.defaultWidth             → ColDef.initialWidth
layout.sizing.defaultFlex              → ColDef.initialFlex
layout.sizing.minWidth                 → ColDef.minWidth
layout.sizing.maxWidth                 → ColDef.maxWidth
layout.sizing.resizable                → ColDef.resizable
```

This mapping is not permission to expose every AG Grid `ColDef` property. New public configuration should be added only when it represents a real stable product need.

## TypeScript typing versus backend JSON

```text
frontend-authored definitions
→ narrow generic types where useful
→ compile-time checking

backend JSON metadata
→ ordinary runtime data
→ runtime schema/registry validation
→ trusted resolved configuration
→ compiler
```

TypeScript generics improve authoring safety; they do not validate backend data.

## Source ownership

These shapes live in shared configurable-grid code because they are independent of a specific feature/entity and row model. Concrete values, registries, mapping, business validation, actions, and other executable behavior remain feature/entity/front-end owned as appropriate.
