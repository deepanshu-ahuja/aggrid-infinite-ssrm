[**Configurable Feature API**](../README.md)

***

[Configurable Feature API](../README.md) / FieldDefinition

# Interface: FieldDefinition\<TFieldId, TFieldPath, TTranslationKey, TCellDataType, TAdditionalFilterOption, TFormatterKey, TRendererKey, TEditingDefinition\>

Defined in: [configuration.types.ts:258](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L258)

Reusable configuration for one field/column exposed by an entity.

Native AG Grid concepts deliberately keep AG Grid names and compatible types where the semantics
are the same. Executable formatting/rendering/editing/parsing behavior stays frontend-owned behind
registries; persisted/backend configuration carries only keys and JSON-safe parameters.

## Type Parameters

### TFieldId

`TFieldId` *extends* `string` = `string`

### TFieldPath

`TFieldPath` *extends* `string` = `string`

### TTranslationKey

`TTranslationKey` *extends* `string` = `string`

### TCellDataType

`TCellDataType` *extends* [`FieldCellDataType`](../type-aliases/FieldCellDataType.md) = [`FieldCellDataType`](../type-aliases/FieldCellDataType.md)

### TAdditionalFilterOption

`TAdditionalFilterOption` *extends* `string` = `never`

### TFormatterKey

`TFormatterKey` *extends* `string` = `string`

### TRendererKey

`TRendererKey` *extends* `string` = `string`

### TEditingDefinition

`TEditingDefinition` *extends* [`FieldEditingDefinition`](FieldEditingDefinition.md) = [`FieldEditingDefinition`](FieldEditingDefinition.md)

## Properties

### cellDataType

> **cellDataType**: `TCellDataType`

Defined in: [configuration.types.ts:281](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L281)

AG Grid cell data type/representation, passed to `ColDef.cellDataType`.

The configurable SSRM compiler sets this explicitly. Native type behavior is the baseline: do
not require formatter, renderer, editor or parser registry entries when AG Grid already provides
the required behavior.

***

### editing?

> `optional` **editing?**: `TEditingDefinition`

Defined in: [configuration.types.ts:304](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L304)

Optional editing capability. Omit to make this field non-editable; presence makes it potentially
editable, but the compiled AG Grid `editable` callback still composes row/access/conflict policy.

***

### field

> **field**: `TFieldPath`

Defined in: [configuration.types.ts:271](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L271)

API row path containing the value. Dot notation supports nested response shapes.

***

### filter?

> `optional` **filter?**: [`FieldFilterDefinition`](FieldFilterDefinition.md)\<`TAdditionalFilterOption` \| [`FilterOptionForCellDataType`](../type-aliases/FilterOptionForCellDataType.md)\<`TCellDataType`\>\>

Defined in: [configuration.types.ts:287](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L287)

Omit when not filterable; when present, `filterOptions` are the exact allowed choices.

***

### formatter?

> `optional` **formatter?**: [`FieldFormatterDefinition`](FieldFormatterDefinition.md)\<`TFormatterKey`\>

Defined in: [configuration.types.ts:295](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L295)

Optional custom display formatter compiled to AG Grid `valueFormatter`.

***

### id

> **id**: `TFieldId`

Defined in: [configuration.types.ts:269](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L269)

Stable configuration identity independent of the API row path.

#### Example

```ts
"loanAmount"
```

***

### labelKey

> **labelKey**: `TTranslationKey`

Defined in: [configuration.types.ts:273](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L273)

Full translation key used to resolve the field/column label.

***

### layout?

> `optional` **layout?**: [`FieldLayoutDefinition`](FieldLayoutDefinition.md)

Defined in: [configuration.types.ts:292](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L292)

Optional initial layout/sizing; supplied values override corresponding default column values.

***

### renderer?

> `optional` **renderer?**: [`FieldRendererDefinition`](FieldRendererDefinition.md)\<`TRendererKey`\>

Defined in: [configuration.types.ts:298](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L298)

Optional custom rich cell renderer compiled to AG Grid `cellRenderer`.

***

### sortable?

> `optional` **sortable?**: `boolean`

Defined in: [configuration.types.ts:284](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L284)

Whether users can sort; omitted values inherit the resolved AG Grid `defaultColDef`.
