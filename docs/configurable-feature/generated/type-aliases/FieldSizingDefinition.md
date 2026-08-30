[**Configurable Feature API**](../README.md)

***

[Configurable Feature API](../README.md) / FieldSizingDefinition

# Type Alias: FieldSizingDefinition

> **FieldSizingDefinition** = [`FieldSizingConstraintsDefinition`](../interfaces/FieldSizingConstraintsDefinition.md) & `object` \| [`FieldSizingConstraintsDefinition`](../interfaces/FieldSizingConstraintsDefinition.md) & `object`

Defined in: [configuration.types.ts:121](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/d781783eb0755171f4eb7a9bb74d4049f5bb8cf8/frontend/src/shared/grid/configurable/configuration.types.ts#L121)

Initial field sizing plus continuing constraints.

A field can declare an initial fixed width or an initial flex weight, never both. Runtime JSON
validation must enforce the same rule expressed by this TypeScript union.
