[**Configurable Feature API**](../README.md)

***

[Configurable Feature API](../README.md) / FieldFilterDefinition

# Interface: FieldFilterDefinition\<TFilterOption\>

Defined in: [configuration.types.ts:88](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/d781783eb0755171f4eb7a9bb74d4049f5bb8cf8/frontend/src/shared/grid/configurable/configuration.types.ts#L88)

Filtering capability for one field.

## Type Parameters

### TFilterOption

`TFilterOption` *extends* `string` = [`FilterOption`](../type-aliases/FilterOption.md)

## Properties

### filterOptions

> **filterOptions**: readonly \[`TFilterOption`, `TFilterOption`\]

Defined in: [configuration.types.ts:96](https://github.com/deepanshu-ahuja/aggrid-infinite-ssrm/blob/d781783eb0755171f4eb7a9bb74d4049f5bb8cf8/frontend/src/shared/grid/configurable/configuration.types.ts#L96)

Complete non-empty list of AG Grid Simple Filter choices exposed for this field.

The name intentionally matches AG Grid `filterParams.filterOptions`. The configurable compiler
combines this field-level list with the resolved shared/entity filter defaults rather than
inventing a second operator vocabulary.
