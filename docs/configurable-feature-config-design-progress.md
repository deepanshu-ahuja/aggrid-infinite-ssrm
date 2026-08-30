# Configurable Feature Configuration Design Progress

## Purpose

Living continuation file for the interface-by-interface configuration design on `configurable-feature-grid`. Use it when a chat/session changes so the next discussion resumes from the exact design point.

Primary architecture context remains `docs/configurable-feature-handoff.md`. Public library-style docs live under `docs/configurable-feature/`.

## Working rules for this design

- Keep work on `configurable-feature-grid`; do not create another branch unless explicitly requested.
- Design parent concepts first, then related child properties/interfaces in coherent batches rather than stopping after every property.
- Preserve every important unresolved item here as **Provisional** or **Deferred**; do not rely on chat memory.
- TypeScript source exposes finalized contracts only.
- Public interfaces/non-obvious properties require useful JSDoc for IDE hover.
- JSDoc describes only the real contract; no irrelevant comparisons/speculation.
- Separate Markdown docs provide the deeper library-style explanation.
- Group related source/docs; avoid one giant file and avoid one file per tiny interface.
- Shared configuration contracts must be feature-, entity-, and row-model-neutral in shape. Concrete values and executable business behavior remain feature/entity owned.
- Frontend-authored configuration should use strong generic/type narrowing where it improves safety without making the public API unusable.
- Backend JSON remains runtime data even when it represents the same logical contract. TypeScript generics do not replace runtime configuration validation.

### Durable documentation-quality rule

Follow `docs/configurable-feature/documentation-standard.md` for every current and future public configuration interface.

The standard is intentionally stronger than merely requiring a comment:

- an obvious property may have short JSDoc;
- a non-obvious property must explain its actual responsibility/interpretation well enough that IDE hover is useful without opening another file;
- examples belong in JSDoc when they materially clarify the real contract;
- comments must not contain irrelevant comparisons, speculative future behavior, or filler;
- the library-style `configuration-reference.md` must be understandable without source access and must give non-obvious interfaces/properties enough purpose, type/required/default information, interpretation, constraints, and examples where useful;
- source JSDoc and the Markdown reference must stay synchronized whenever a public contract changes.

Do not accept weak comments that merely restate names such as "key of the adapter" when the developer still would not know what that adapter is responsible for.

## Overall design coverage snapshot

This is a progress map, not a promise that every future shape is already known.

```text
FeatureDefinition                    DONE (source + docs)
EntityDefinition                     PARTIAL, core + fields connection done
RowIdDefinition                      DONE (source + docs)
FieldDefinition core                 DONE (source + docs)
  identity / API binding / label     DONE
  semantic data type                 DONE
  sortable capability                DONE
  filter capability/operators        DONE
Field presentation/defaults          NOT YET DESIGNED
Formatting/rendering                 NOT YET DESIGNED
Editing/editor/value conversion      NOT YET DESIGNED
Validation declarations              NOT YET DESIGNED
Server sort/filter/search mapping    NOT YET DESIGNED
Access/security/masking              NOT YET DESIGNED
Data-adapter registry contract       NOT YET DESIGNED
Actions/business operations          NOT YET DESIGNED
Grid State/preferences reconciliation NOT YET DESIGNED
Config validation/versioning         NOT YET DESIGNED
Final runtime/compiler composition   NOT YET DESIGNED
```

## Implemented/finalized type contracts

Source: `frontend/src/shared/grid/configurable/configuration.types.ts`.

### `FeatureDefinition`

```ts
interface FeatureDefinition<
  TFeatureKey extends string = string,
  TEntityKey extends string = string,
> {
  featureKey: TFeatureKey;
  entities: Record<TEntityKey, EntityDefinition>;
}
```

Finalized:

- `featureKey` is required and generic over a string key.
- `entities` is the required entity-definition map.
- Entity identity is the `entities` record key.
- Separate `supportedEntities` is rejected as duplicate information.
- `EntityDefinition` does not duplicate identity with an `entityKey` member.

### `EntityDefinition`

Current source shape now includes the field collection:

```ts
interface EntityDefinition<
  TTranslationKey extends string = string,
  TFieldDefinition extends ConfigurableFieldDefinition<TTranslationKey> =
    ConfigurableFieldDefinition<TTranslationKey>,
> {
  labelKey: TTranslationKey;
  dataAdapterKey: string;
  rowId: RowIdDefinition;
  fields: readonly TFieldDefinition[];
}
```

Finalized:

- `labelKey` is required and is now generic so frontend-owned feature definitions can narrow it to valid translation keys.
- Use a full explicit translation key, e.g. `review.entities.loan.label`; do not derive it automatically from feature/entity identity.
- `dataAdapterKey` is required and resolves the registered frontend data/API adapter for that feature/entity.
- A data adapter covers loading/saving and request/response mapping required by those data operations; it is not a bucket for unrelated entity utilities.
- `rowId` is required.
- `fields` is required and is a readonly array.
- Field array order represents configured default column order; stable field identity comes from each field's `id`, not from array position.

### `RowIdDefinition`

```ts
interface RowIdDefinition {
  path: string;
}
```

Finalized:

- `path` identifies the stable unique ID in the API row.
- Common case is `id`.
- Dot notation such as `loan.id` is supported for nested API shapes.
- No implicit `id` default; the configuration stays explicit.

## `FieldDefinition` core — finalized

The initial field contract is now source-backed rather than provisional.

Conceptual shape:

```ts
interface FieldDefinition<
  TFieldId extends string = string,
  TFieldPath extends string = string,
  TTranslationKey extends string = string,
  TDataType extends FieldDataType = FieldDataType,
  TAdditionalFilterOperator extends string = never,
> {
  id: TFieldId;
  field: TFieldPath;
  labelKey: TTranslationKey;
  dataType: TDataType;
  sortable?: boolean;
  filter?: FieldFilterDefinition<
    FilterOperatorForDataType<TDataType> | TAdditionalFilterOperator
  >;
}
```

### `id`

Finalized:

- required stable configuration identity for the field/column;
- intentionally independent of the API row path;
- generic so feature-owned types can narrow valid field IDs;
- intended to remain stable when API response paths change and to become the safe identity referenced by later field-related configuration.

### `field`

Finalized:

- required path to the value in the API row;
- direct property (`amount`) is the common case;
- dot notation (`financials.amount`) supports nested response shapes;
- generic so a typed frontend feature can narrow it to valid row-path strings instead of accepting every string;
- backend JSON still requires runtime validation and cannot gain compile-time safety merely from the TypeScript contract.

Important distinction:

```text
id
→ stable configuration identity

field
→ API row value location
```

### `labelKey`

Finalized:

- required full explicit translation key for the field/column label;
- generic so frontend-owned definitions can narrow it to a valid translation-key type;
- do not derive it automatically from feature/entity/field identity.

### `dataType`

Finalized required union:

```ts
type FieldDataType = "text" | "number" | "boolean" | "date" | "dateTime";
```

Purpose:

- communicates the semantic value category of the field;
- provides the shared base filter-operator vocabulary appropriate to the field type;
- does not by itself finalize formatter/editor/validation behavior, which are still separate design areas.

### `sortable`

Finalized:

- optional boolean;
- omitted means the shared sortable default (`true`), matching the existing `baseDefaultColDef`;
- explicit `false` disables sorting for the field.

### `filter`

Finalized capability shape:

```ts
interface FieldFilterDefinition<TOperator extends string = FilterOperator> {
  operators: readonly [TOperator, ...TOperator[]];
}
```

Semantics:

- no separate `filterable` boolean;
- `filter` omitted means the field is not filterable;
- `filter` present means filtering is available;
- `operators` is required and non-empty and is the exact list of filter choices allowed for the field.

This avoids contradictory duplicate configuration such as `filterable: false` plus a populated filter object.

### Shared filter operators

The base names align with the repository's existing shared server-backed filter vocabulary.

Text:

```text
contains, equals, notEqual, startsWith, endsWith
```

Number:

```text
equals, notEqual, greaterThan, greaterThanOrEqual,
lessThan, lessThanOrEqual
```

Date/date-time:

```text
equals, notEqual, lessThan, greaterThan
```

Boolean base semantics:

```text
equals, notEqual
```

`FilterOperatorForDataType<TDataType>` selects the shared operator union appropriate for the semantic type.

### Feature-specific filter operators

Finalized extensibility rule:

- a field can list a subset of the shared type-appropriate operators;
- a feature can add typed operator keys through `TAdditionalFilterOperator` when a real business-specific filter semantic exists;
- a custom operator string is only configuration identity; it must later resolve through a bounded frontend/query mapping and matching backend semantics;
- never accept executable JavaScript/functions from backend JSON configuration.

Example concept only:

```ts
type ReviewExtraFilterOperator = "requiresReview";
```

The exact custom-operator registry/query-mapper contract remains deferred until the filtering/query infrastructure is designed.

## TypeScript typing versus backend JSON

This is a durable architecture rule:

```text
frontend-owned definitions
→ use generic/type narrowing where useful
→ compile-time checking for field IDs, row paths, translation keys and custom operator keys

backend JSON metadata
→ ordinary runtime values
→ validate against configuration schema + registries/capabilities
→ only then compile/resolve into trusted grid inputs
```

Do not weaken every public TypeScript property to an unconstrained `string` merely because metadata can also arrive from JSON. Do not pretend TypeScript generics validate runtime JSON either.

## Provisional / must be revisited

These items are intentionally preserved so a new chat does not lose them:

- Revisit strong generic typing of `dataAdapterKey` when the data-adapter registry is designed.
- Row-ID path typing could be narrowed in frontend-owned definitions if the later row-type/path design makes that useful without generic overload; current source remains `string`.
- Row-ID accessor/resolver support should be added only if a real entity cannot expose stable identity through a simple field path.
- Exact translation resource/module layout still waits for translation infrastructure; resources should remain feature-oriented rather than one giant global file.
- Runtime configuration validation/schema is mandatory before backend JSON becomes trusted resolved configuration; exact validation library/schema/versioning is not yet designed.
- Filter custom-operator registry/query mapping is still required before feature-specific operator keys can execute real semantics.
- Easy concept documentation is required and should grow only as concepts are actually finalized. Current glossary is `docs/configurable-feature/concepts.md`.

## Field areas still to design

Do not forget or silently collapse these into the current core:

- default visibility and presentation controls that truly belong in public config;
- width/min/max width and other column sizing defaults where appropriate;
- formatter/display-value behavior;
- renderer selection and renderer registry contract;
- editor/editability and editor registry contract;
- parser/normalizer/value-conversion stages where required;
- validation declarations;
- searchability where the product needs it;
- server sort/filter/search keys when query/API field names differ from displayed/API-row paths;
- request/save mapping for fields whose read and write shapes differ;
- access/security/masking integration;
- accessor/resolver support only if a real field cannot be represented by a simple row path.

## Documentation tooling requirement

The configuration design strategy does **not** change for documentation tooling. Design correct reusable TypeScript contracts first; tooling must adapt to the contracts, never the other way around.

Once the public configuration tree is large enough to make generated output useful, add tooling for both:

- **TypeDoc** (or an equivalent TypeScript API documentation generator) for searchable generated API/type documentation and type hierarchy navigation;
- **TsUML2 or an equivalent TypeScript relationship-diagram generator** for a generated SVG/visual type-composition hierarchy.

The visual artifact should make the configuration tree easy to understand, e.g. `FeatureDefinition -> EntityDefinition -> FieldDefinition / RowIdDefinition`, and should be generated from TypeScript as much as practical so it does not silently drift from source.

Where the chosen documentation UI allows it, expose the hierarchy/relationship visualization alongside the detailed interface reference so developers can see both structure and property documentation together. A committed/generated diagram under `docs/configurable-feature/` is required once this tooling is introduced.

Do not distort interface inheritance/composition merely to satisfy a visualization tool. If one tool cannot accurately represent the architecture, replace or supplement the tool rather than changing the contracts for documentation convenience.

## Deferred configuration areas beyond fields

Review one by one; do not infer final shapes from earlier chat examples:

- Renderer/editor/formatter/parser/normalizer/accessor registries.
- Datasource/data-adapter registry contract and operations.
- Query/request/save mapping.
- Validation declarations.
- Actions/business operations.
- Resolved access/security/masking.
- Routing/view manifest.
- Page-level configuration.
- Translation infrastructure and fallbacks.
- User preferences/Grid State reconciliation.
- Configuration versioning and runtime configuration validation.
- Exact top-level configuration envelope/runtime compiler.

## CI / push cadence

Batch several related decisions before ordinary pushes where practical; explicit user request to push sooner overrides this. There is currently no open PR. If a PR is opened during config-design/types/docs work, Playwright/browser regression may be temporarily paused while normal non-browser checks remain; restore Playwright before runtime/grid integration where browser coverage is materially needed.

## Exact resume point

The **core `FieldDefinition` contract is now finalized and added to source/docs**.

Resume with the next coherent field batch rather than reopening already-settled identity/filter questions unless a concrete issue is found.

Recommended next sequence:

1. field presentation/defaults: visibility plus width/min/max width and whether these belong directly on `FieldDefinition` or in a bounded presentation child object;
2. formatter/display behavior and renderer selection/registries;
3. editing/editor plus parser/normalizer/value-conversion boundaries;
4. validation declarations;
5. server sort/filter/search mapping and request/save field mapping;
6. access/security/masking integration.

Keep each batch substantial enough to make progress, record unresolved decisions here, and update source + JSDoc + reference + concepts together whenever a contract is finalized.
