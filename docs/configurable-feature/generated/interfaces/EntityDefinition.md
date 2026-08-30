[**Configurable Feature API**](../README.md)

***

[Configurable Feature API](../README.md) / EntityDefinition

# Interface: EntityDefinition\<TTranslationKey, TFieldDefinition\>

Defined in: [configuration.types.ts:319](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L319)

Reusable configuration for one entity/data context inside a configurable feature.

## Type Parameters

### TTranslationKey

`TTranslationKey` *extends* `string` = `string`

### TFieldDefinition

`TFieldDefinition` *extends* `ConfigurableFieldDefinition`\<`TTranslationKey`\> = `ConfigurableFieldDefinition`\<`TTranslationKey`\>

## Properties

### dataAdapterKey

> **dataAdapterKey**: `string`

Defined in: [configuration.types.ts:326](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L326)

Key of the frontend data adapter for loading/saving and API/grid mapping.

***

### fieldDefaults?

> `optional` **fieldDefaults?**: [`FieldDefaultsDefinition`](FieldDefaultsDefinition.md)

Defined in: [configuration.types.ts:330](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L330)

Optional configurable defaults compiled into AG Grid `defaultColDef`.

***

### fields

> **fields**: readonly `TFieldDefinition`[]

Defined in: [configuration.types.ts:332](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L332)

Fields available for the entity in their configured initial column order.

***

### labelKey

> **labelKey**: `TTranslationKey`

Defined in: [configuration.types.ts:324](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L324)

Full translation key used to resolve the entity label.

***

### rowId

> **rowId**: [`RowIdDefinition`](RowIdDefinition.md)

Defined in: [configuration.types.ts:328](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L328)

Stable business-row identity definition.
