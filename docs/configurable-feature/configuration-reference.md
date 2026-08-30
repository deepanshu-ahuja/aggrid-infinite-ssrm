# Configurable Feature Configuration Reference

This document describes the public configuration contracts currently implemented for configurable business features that contain a grid/table.

Source: `frontend/src/shared/grid/configurable/configuration.types.ts`.

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

`EntityDefinition` is the reusable configuration for one entity/data context inside a feature. For the Review feature, Loan and Finance can each use this same interface while providing different configuration values.

```ts
interface EntityDefinition {
  labelKey: string;
  dataAdapterKey: string;
  rowId: RowIdDefinition;
}
```

The entity's identity comes from its key in `FeatureDefinition.entities`. The interface therefore does not repeat that identity with another `entityKey` property.

### `labelKey`

**Type:** `string`  
**Required:** yes

Full translation key used to resolve the entity label shown by the UI.

```ts
labelKey: "review.entities.loan.label"
```

The value is stored explicitly in configuration. This lets the configuration point at the exact translation resource that supplies the displayed entity name.

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

The current public type is `string`. Stronger typing of adapter keys is intentionally preserved in the design-progress document for review when the adapter registry contract is designed.

### `rowId`

**Type:** `RowIdDefinition`  
**Required:** yes

Describes how to read the stable unique identifier from every API row for this entity. That identifier gives grid-related state a consistent way to refer to the same business record across data lifecycle changes.

```ts
rowId: {
  path: "id",
}
```

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

## Source ownership

These contracts live in shared configurable-grid code because their shapes are independent of a specific feature, entity, and AG Grid row model. Concrete feature/entity values and executable business behavior remain owned by the relevant feature/entity implementation.

## Documentation contract

The TypeScript declarations provide useful JSDoc for IDE hover, while this reference explains the same public contract in library-style form for readers who may not have the source open.

Non-obvious properties must explain their responsibility and interpretation, not merely restate the property name. Examples are included where they materially improve understanding. See [`documentation-standard.md`](documentation-standard.md) for the durable rules.