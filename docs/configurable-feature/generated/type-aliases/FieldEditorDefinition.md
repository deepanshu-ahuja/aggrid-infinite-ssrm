[**Configurable Feature API**](../README.md)

***

[Configurable Feature API](../README.md) / FieldEditorDefinition

# Type Alias: FieldEditorDefinition\<TEditorKey\>

> **FieldEditorDefinition**\<`TEditorKey`\> = `FieldEditorBaseDefinition`\<`TEditorKey`\> & `object` \| `FieldEditorBaseDefinition`\<`TEditorKey`\> & `object`

Defined in: [configuration.types.ts:205](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/d781783eb0755171f4eb7a9bb74d4049f5bb8cf8/frontend/src/shared/grid/configurable/configuration.types.ts#L205)

Registered editor configuration for one editable field.

Popup position is valid only when popup editing is explicitly enabled. The union gives
frontend-authored config the same rule that runtime JSON validation must enforce.

## Type Parameters

### TEditorKey

`TEditorKey` *extends* `string` = `string`
