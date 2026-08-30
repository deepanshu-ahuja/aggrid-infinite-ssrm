[**Configurable Feature API**](../README.md)

***

[Configurable Feature API](../README.md) / FieldFormatterDefinition

# Interface: FieldFormatterDefinition\<TFormatterKey\>

Defined in: [configuration.types.ts:157](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L157)

Registered frontend value formatter selected by declarative configuration.

## Type Parameters

### TFormatterKey

`TFormatterKey` *extends* `string` = `string`

## Properties

### key

> **key**: `TFormatterKey`

Defined in: [configuration.types.ts:159](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L159)

Stable formatter registry key.

#### Example

```ts
"currency"
```

***

### params?

> `optional` **params?**: [`ConfigurationJsonObject`](ConfigurationJsonObject.md)

Defined in: [configuration.types.ts:168](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L168)

Extra JSON-safe configuration for the registered formatter.

AG Grid already supplies normal `ValueFormatterParams` when it invokes `valueFormatter`. These
values are additional declarative inputs interpreted by the registered formatter; the compiler
combines them with the AG Grid callback params. AG Grid has no `valueFormatterParams` ColDef
property analogous to `cellRendererParams`.
