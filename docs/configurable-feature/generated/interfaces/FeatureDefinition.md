[**Configurable Feature API**](../README.md)

***

[Configurable Feature API](../README.md) / FeatureDefinition

# Interface: FeatureDefinition\<TFeatureKey, TEntityKey\>

Defined in: [configuration.types.ts:4](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L4)

Reusable configuration root for one configurable business feature.

## Type Parameters

### TFeatureKey

`TFeatureKey` *extends* `string` = `string`

### TEntityKey

`TEntityKey` *extends* `string` = `string`

## Properties

### entities

> **entities**: `Record`\<`TEntityKey`, [`EntityDefinition`](EntityDefinition.md)\>

Defined in: [configuration.types.ts:12](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L12)

Entity definitions keyed by their stable entity identifier.

***

### featureKey

> **featureKey**: `TFeatureKey`

Defined in: [configuration.types.ts:9](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L9)

Stable programmatic identifier for this feature definition.

#### Example

```ts
"review"
```
