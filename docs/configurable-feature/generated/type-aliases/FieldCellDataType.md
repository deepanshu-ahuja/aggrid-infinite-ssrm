[**Configurable Feature API**](../README.md)

***

[Configurable Feature API](../README.md) / FieldCellDataType

# Type Alias: FieldCellDataType

> **FieldCellDataType** = `Extract`\<`NonNullable`\<`ColDef`\[`"cellDataType"`\]\>, `"text"` \| `"number"` \| `"boolean"` \| `"date"` \| `"dateString"` \| `"dateTime"` \| `"dateTimeString"`\>

Defined in: [configuration.types.ts:40](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/d781783eb0755171f4eb7a9bb74d4049f5bb8cf8/frontend/src/shared/grid/configurable/configuration.types.ts#L40)

Built-in AG Grid cell-data-type names supported by configurable fields.

The public property is intentionally named `cellDataType`, matching AG Grid `ColDef.cellDataType`.
The configurable SSRM compiler sets it explicitly because AG Grid data-type inference only runs
with the Client-Side Row Model. AG Grid's native type-specific parser, formatter, editor, renderer
and filter behavior is therefore the baseline before any configured override is applied.

`date` / `dateTime` represent JavaScript `Date` values. `dateString` / `dateTimeString` represent
values kept as strings, which is the normal representation for dates arriving from JSON APIs.
