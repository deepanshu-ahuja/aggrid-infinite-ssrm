[**Configurable Feature API**](../README.md)

***

[Configurable Feature API](../README.md) / FilterOptionForCellDataType

# Type Alias: FilterOptionForCellDataType\<TCellDataType\>

> **FilterOptionForCellDataType**\<`TCellDataType`\> = `TCellDataType` *extends* `"text"` ? [`TextFilterOption`](TextFilterOption.md) : `TCellDataType` *extends* `"number"` ? [`NumberFilterOption`](NumberFilterOption.md) : `TCellDataType` *extends* `"boolean"` ? [`BooleanFilterOption`](BooleanFilterOption.md) : `TCellDataType` *extends* `"date"` \| `"dateString"` \| `"dateTime"` \| `"dateTimeString"` ? [`DateFilterOption`](DateFilterOption.md) : `never`

Defined in: [configuration.types.ts:76](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L76)

Resolves the shared filter-option vocabulary appropriate for an AG Grid cell data type.

## Type Parameters

### TCellDataType

`TCellDataType` *extends* [`FieldCellDataType`](FieldCellDataType.md)
