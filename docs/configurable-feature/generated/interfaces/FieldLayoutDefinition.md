[**Configurable Feature API**](../README.md)

***

[Configurable Feature API](../README.md) / FieldLayoutDefinition

# Interface: FieldLayoutDefinition

Defined in: [configuration.types.ts:134](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L134)

Initial layout configuration for one field.

## Properties

### initialHide?

> `optional` **initialHide?**: `boolean`

Defined in: [configuration.types.ts:136](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L136)

Whether the column starts hidden; same semantics/type as AG Grid `ColDef.initialHide`.

***

### initialPinned?

> `optional` **initialPinned?**: [`FieldPinnedPosition`](../type-aliases/FieldPinnedPosition.md)

Defined in: [configuration.types.ts:138](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L138)

Initial pinned side; same semantics/type as AG Grid `ColDef.initialPinned`.

***

### sizing?

> `optional` **sizing?**: [`FieldSizingDefinition`](../type-aliases/FieldSizingDefinition.md)

Defined in: [configuration.types.ts:140](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L140)

Optional initial sizing and persistent size constraints.
