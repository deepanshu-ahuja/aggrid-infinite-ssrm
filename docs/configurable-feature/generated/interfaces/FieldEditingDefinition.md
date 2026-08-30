[**Configurable Feature API**](../README.md)

***

[Configurable Feature API](../README.md) / FieldEditingDefinition

# Interface: FieldEditingDefinition\<TEditorKey, TParserKey\>

Defined in: [configuration.types.ts:241](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L241)

Editing capability for one field.

Presence means the field is eligible for editing; it does not force `editable=true` for every
row. Runtime editability must also satisfy current access/authorization, feature row policy and
tracked-editing conflict rules.

When `editor` is omitted, AG Grid's editor selected by `cellDataType` remains available. When
`parser` is omitted, the compiler does not override `valueParser`, so the parser supplied by the
AG Grid cell data type (if any) remains in effect.

## Type Parameters

### TEditorKey

`TEditorKey` *extends* `string` = `string`

### TParserKey

`TParserKey` *extends* `string` = `string`

## Properties

### editor?

> `optional` **editor?**: [`FieldEditorDefinition`](../type-aliases/FieldEditorDefinition.md)\<`TEditorKey`\>

Defined in: [configuration.types.ts:246](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L246)

Optional registered custom editor.

***

### parser?

> `optional` **parser?**: [`FieldValueParserDefinition`](FieldValueParserDefinition.md)\<`TParserKey`\>

Defined in: [configuration.types.ts:248](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/514125a8f5bbab75523bfa846ba12aa50c66d3d4/frontend/src/shared/grid/configurable/configuration.types.ts#L248)

Optional registered parser override.
