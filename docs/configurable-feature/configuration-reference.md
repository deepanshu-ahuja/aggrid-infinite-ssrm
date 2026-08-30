# Configurable Feature Configuration Reference

This document describes the public configuration contracts currently implemented for configurable business features that contain a grid/table.

Source: `frontend/src/shared/grid/configurable/configuration.types.ts`.

## `FeatureDefinition`

Shared top-level configuration for one configurable business feature.

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

Required stable programmatic identifier for the feature.

```ts
featureKey: "review"
```

The generic key lets each feature narrow its own identifier without maintaining one central union of all business features.

### `entities`

Required map of entity definitions, keyed by stable entity identity.

```ts
entities: {
  loan: loanDefinition,
  finance: financeDefinition,
}
```

The record keys already identify supported entities, so there is no separate `supportedEntities` list.

## `EntityDefinition`

Shared configuration for one entity/data context inside a configurable feature.

```ts
interface EntityDefinition {
  labelKey: string;
  dataAdapterKey: string;
  rowId: RowIdDefinition;
}
```

The entity identity is the key in `FeatureDefinition.entities`; there is no duplicate `entityKey` property inside `EntityDefinition`.

### `labelKey`

Required translation key for the entity's displayed label.

```ts
labelKey: "review.entities.loan.label"
```

Full translation keys are explicit rather than being automatically constructed from feature/entity identity.

### `dataAdapterKey`

Required key of the registered frontend adapter used for the entity's data/API operations.

```ts
dataAdapterKey: "reviewLoan"
```

The adapter is the data boundary for operations such as loading/saving and the request/response mapping required by those operations. It is not a container for unrelated entity utilities.

### `rowId`

Required row-identity definition.

```ts
rowId: {
  path: "id",
}
```

## `RowIdDefinition`

Defines where the stable unique business-row identifier is found in the API row.

```ts
interface RowIdDefinition {
  path: string;
}
```

### `path`

Required field path containing the stable unique row ID. The common case is `"id"`; dot notation supports nested API shapes when needed.

```ts
path: "id"
```

```ts
path: "loan.id"
```

## Source ownership

These contracts live in shared configurable-grid code because their shape is independent of a specific feature, entity, and AG Grid row model. Concrete feature/entity values and executable business behavior remain feature/entity owned.

## Documentation conventions

Public interfaces include concise JSDoc for IDE hover. This document is the deeper library-style reference. Examples are included where they materially improve understanding.