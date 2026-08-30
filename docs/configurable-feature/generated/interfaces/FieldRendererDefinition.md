[**Configurable Feature API**](../README.md)

***

[Configurable Feature API](../README.md) / FieldRendererDefinition

# Interface: FieldRendererDefinition\<TRendererKey\>

Defined in: [configuration.types.ts:172](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L172)

Registered frontend cell renderer selected by declarative configuration.

## Type Parameters

### TRendererKey

`TRendererKey` *extends* `string` = `string`

## Properties

### key

> **key**: `TRendererKey`

Defined in: [configuration.types.ts:174](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L174)

Stable renderer registry key.

#### Example

```ts
"statusChip"
```

***

### params?

> `optional` **params?**: [`ConfigurationJsonObject`](ConfigurationJsonObject.md)

Defined in: [configuration.types.ts:181](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L181)

Extra JSON-safe props for the registered renderer, compiled to AG Grid `cellRendererParams`.

AG Grid still supplies its normal renderer props such as `value`, `valueFormatted`, `data`,
`node`, `column`, `colDef` and `api`. Configuration should not duplicate those runtime values.
