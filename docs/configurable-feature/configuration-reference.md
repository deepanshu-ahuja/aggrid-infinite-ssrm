# Configurable Feature Configuration Reference

This document describes the agreed public configuration contracts for configurable business features that contain a grid/table.

Only finalized design is documented as public contract here. Unresolved ideas stay in `../configurable-feature-config-design-progress.md` until they are decided.

## `FeatureDefinition`

### Purpose

`FeatureDefinition` is the shared top-level configuration contract for one configurable business feature.

Current design shape:

```ts
interface FeatureDefinition<
  TFeatureKey extends string = string,
  TEntityKey extends string = string,
> {
  featureKey: TFeatureKey;
  entities: Record<TEntityKey, EntityDefinition>;
}
```

The TypeScript source contract will be added once `EntityDefinition` has at least one real finalized member. The documentation records the agreed shape without introducing an empty placeholder interface into production code.

### `featureKey`

**Type**

```ts
TFeatureKey
```

**Required:** yes.

A stable programmatic identifier for the business feature represented by this definition.

Example:

```ts
featureKey: "review"
```

The shared contract keeps the key generic so a feature can narrow its own identifier while reusing the same public shape.

### `entities`

**Type**

```ts
Record<TEntityKey, EntityDefinition>
```

**Required:** yes.

Contains the entity configurations available inside the feature. Each record key is the stable identity used to select that entity's definition.

Example:

```ts
entities: {
  loan: loanDefinition,
  finance: financeDefinition,
}
```

Because the record keys already define the supported entity identities, there is no separate `supportedEntities` list.

## `EntityDefinition`

### Purpose

`EntityDefinition` is the shared configuration contract for one entity/data context inside a configurable feature.

For example, a Review feature can contain separate Loan and Finance entity definitions:

```ts
entities: {
  loan: loanDefinition,
  finance: financeDefinition,
}
```

### Entity identity

The entity identity is the key in `FeatureDefinition.entities`.

There is no duplicate `entityKey` property inside `EntityDefinition`.

The remaining members of `EntityDefinition` are still under design and are intentionally not documented here as public contract yet.

## Source ownership

These configuration contracts belong in shared configurable-grid code when the contract shape is independent of a specific business feature, entity, and AG Grid row model.

Feature/entity-specific values and executable behavior remain owned by their feature/entity implementation.

## Documentation conventions

Public TypeScript configuration interfaces will include concise JSDoc suitable for IDE hover. JSDoc should describe only the real contract, and examples should be included only when they materially improve understanding.

This Markdown reference provides the fuller explanation and can be read independently of the source code.