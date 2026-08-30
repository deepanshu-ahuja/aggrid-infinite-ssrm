[**Configurable Feature API**](../README.md)

***

[Configurable Feature API](../README.md) / FieldDefaultsDefinition

# Interface: FieldDefaultsDefinition

Defined in: [configuration.types.ts:149](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/d781783eb0755171f4eb7a9bb74d4049f5bb8cf8/frontend/src/shared/grid/configurable/configuration.types.ts#L149)

Configurable defaults applied to every field in one entity.

The compiler adds these values to shared `baseDefaultColDef` and supplies the result to AG Grid
`defaultColDef`. Individual compiled columns then use AG Grid's normal override precedence.

## Properties

### layout?

> `optional` **layout?**: [`FieldLayoutDefinition`](FieldLayoutDefinition.md)

Defined in: [configuration.types.ts:153](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/d781783eb0755171f4eb7a9bb74d4049f5bb8cf8/frontend/src/shared/grid/configurable/configuration.types.ts#L153)

Default layout/sizing settings inherited by fields that do not override them.

***

### sortable?

> `optional` **sortable?**: `boolean`

Defined in: [configuration.types.ts:151](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/d781783eb0755171f4eb7a9bb74d4049f5bb8cf8/frontend/src/shared/grid/configurable/configuration.types.ts#L151)

Default sortable setting; same semantics/type as AG Grid `ColDef.sortable`.
