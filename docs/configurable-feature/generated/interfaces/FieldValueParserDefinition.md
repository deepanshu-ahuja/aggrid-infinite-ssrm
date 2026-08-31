[**Configurable Feature API**](../README.md)

***

[Configurable Feature API](../README.md) / FieldValueParserDefinition

# Interface: FieldValueParserDefinition\<TParserKey\>

Defined in: [configuration.types.ts:217](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/d781783eb0755171f4eb7a9bb74d4049f5bb8cf8/frontend/src/shared/grid/configurable/configuration.types.ts#L217)

Registered parser overriding the value parser provided by the field's AG Grid cell data type.

## Type Parameters

### TParserKey

`TParserKey` *extends* `string` = `string`

## Properties

### key

> **key**: `TParserKey`

Defined in: [configuration.types.ts:219](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/d781783eb0755171f4eb7a9bb74d4049f5bb8cf8/frontend/src/shared/grid/configurable/configuration.types.ts#L219)

Stable parser registry key.

***

### params?

> `optional` **params?**: [`ConfigurationJsonObject`](ConfigurationJsonObject.md)

Defined in: [configuration.types.ts:227](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/d781783eb0755171f4eb7a9bb74d4049f5bb8cf8/frontend/src/shared/grid/configurable/configuration.types.ts#L227)

Extra JSON-safe configuration for the registered parser.

AG Grid invokes `valueParser` with normal `ValueParserParams`; the compiler combines those
callback params with this declarative configuration. Custom React editors may also use AG Grid's
supplied `parseValue()` utility when they need to apply the column parser explicitly.
