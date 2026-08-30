# Configurable Feature Configuration Design Progress

## Purpose

Living continuation file for the interface-by-interface configuration design on `configurable-feature-grid`. Use it when a chat/session changes so the next discussion resumes from the exact design point.

Primary architecture context remains `docs/configurable-feature-handoff.md`. Public library-style docs live under `docs/configurable-feature/`.

## Working rules for this design

- Keep work on `configurable-feature-grid`; do not create another branch unless explicitly requested.
- Design parent concepts first, then related child properties/interfaces in coherent batches.
- Preserve every important unresolved item here as **Provisional** or **Deferred**; do not rely on chat memory.
- TypeScript source exposes finalized contracts only.
- Public interfaces/non-obvious properties require useful JSDoc for IDE hover.
- Follow `docs/configurable-feature/documentation-standard.md` for source/docs synchronization.
- Shared configuration contracts must be feature-, entity-, and row-model-neutral in shape. Concrete values and executable business behavior remain feature/entity owned.
- Frontend-authored configuration should use strong generic/type narrowing where it improves safety without making the public API unusable.
- Backend JSON remains runtime data. TypeScript generics do not replace runtime configuration validation.
- Prefer native AG Grid semantics where they already solve the problem. The configurable layer should compile into AG Grid rather than recreate AG Grid behavior unnecessarily.

## Overall design coverage snapshot

```text
FeatureDefinition                     DONE (source + docs)
EntityDefinition                      PARTIAL, core + field defaults/fields done
RowIdDefinition                       DONE (source + docs)
FieldDefinition core                  DONE (source + docs)
  identity / API binding / label      DONE
  semantic data type                  DONE
  sortable capability                 DONE
  filter capability/operators         DONE
Field defaults/defaultColDef mapping  DONE (source + docs)
Field presentation/layout             DONE (source + docs)
  initial visibility/pinning          DONE
  initial width/flex                  DONE
  min/max/resizable constraints       DONE
Formatting/rendering                  NOT YET DESIGNED
Editing/editor/value conversion       NOT YET DESIGNED
Validation declarations               NOT YET DESIGNED
Server sort/filter/search mapping     NOT YET DESIGNED
Access/security/masking               NOT YET DESIGNED
Data-adapter registry contract        NOT YET DESIGNED
Actions/business operations           NOT YET DESIGNED
Grid State/preferences reconciliation PARTIAL semantics established, full contract not designed
Config validation/versioning          NOT YET DESIGNED
Final runtime/compiler composition    NOT YET DESIGNED
```

## Finalized core contracts

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

```ts
interface EntityDefinition<
  TTranslationKey extends string = string,
  TFieldDefinition extends ConfigurableFieldDefinition<TTranslationKey> =
    ConfigurableFieldDefinition<TTranslationKey>,
> {
  labelKey: TTranslationKey;
  dataAdapterKey: string;
  rowId: RowIdDefinition;
  fieldDefaults?: FieldDefaultsDefinition;
  fields: readonly TFieldDefinition[];
}
```

Finalized:

- `labelKey` is required, explicit, and generic so frontend-owned feature definitions can narrow valid translation keys.
- `dataAdapterKey` is required and resolves the registered frontend data/API adapter for that feature/entity.
- `rowId` is required.
- `fieldDefaults` is optional and compiles into AG Grid `defaultColDef` on top of the shared `baseDefaultColDef`.
- `fields` is required and readonly.
- Field array order represents initial column order; stable field identity comes from each field's `id`.

### `RowIdDefinition`

```ts
interface RowIdDefinition {
  path: string;
}
```

Finalized:

- common case is `id`;
- nested dot notation is supported;
- no implicit default.

## `FieldDefinition` core — finalized

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
  layout?: FieldLayoutDefinition;
}
```

### Identity / binding / translation

Finalized:

- `id` is the stable configuration identity and is intentionally independent of API path.
- `field` is the API row path; dot notation is supported.
- `labelKey` is a full explicit translation key.
- frontend-owned config can narrow these with useful generic types;
- backend JSON still requires runtime validation.

### `dataType`

```ts
type FieldDataType = "text" | "number" | "boolean" | "date" | "dateTime";
```

Finalized semantic value category. It currently determines the shared filter-operator vocabulary; it does not itself settle formatter/editor/validation behavior.

### `sortable`

Finalized semantics changed from the earlier simplistic wording:

```text
field sortable supplied
→ field/ColDef value wins

field sortable omitted
→ inherit resolved AG Grid defaultColDef value
```

The resolved default column definition comes from the shared `baseDefaultColDef` plus any configurable `EntityDefinition.fieldDefaults`.

Do not document omission as merely hard-coded `true` at the field-contract level. The shared base currently provides `sortable: true`, but configurable defaults may override that before AG Grid applies individual field precedence.

### `filter`

Finalized:

- no separate `filterable` boolean;
- `filter` omitted means field is not filterable;
- `filter` present means filtering is available;
- `operators` is required/non-empty and is the exact allowed operator list;
- base operator names align with the repository's current server-backed text/number/date vocabulary;
- feature-specific operator keys are allowed only through typed extension and must later resolve to bounded query/backend semantics.

Important compiler consequence: current shared `baseDefaultColDef` has `filter: true`, but configurable `FieldDefinition.filter` omission means not filterable. The future compiler therefore must emit the appropriate non-filterable column configuration for fields without `filter`. This is contract translation, not repair of invalid metadata.

## Field defaults and native AG Grid precedence — finalized

The user explicitly clarified that configurable defaults should mirror AG Grid's own `defaultColDef` + `columnDefs` behavior rather than introduce a custom runtime field-merging framework.

Final model:

```text
shared baseDefaultColDef
        +
compiled EntityDefinition.fieldDefaults
        ↓
AG Grid defaultColDef

compiled EntityDefinition.fields[]
        ↓
AG Grid columnDefs[]

AG Grid rule
→ individual ColDef value overrides matching defaultColDef value
```

Public contract:

```ts
interface FieldDefaultsDefinition {
  sortable?: boolean;
  layout?: FieldLayoutDefinition;
}
```

This type is intentionally bounded to the field defaults designed so far; it is not a copy of AG Grid `ColDef`.

Do not accept invalid configuration and silently repair it with clever merge logic. TypeScript should prevent invalid frontend-authored shapes where practical, and runtime validation must reject invalid backend JSON.

## Field layout/sizing — finalized

### Naming correction

The first pushed layout draft used `defaultVisible`, `defaultPinned`, `defaultWidth`, and `defaultFlex`. That naming was reconsidered immediately because the values describe initial AG Grid column state, not the higher-level `fieldDefaults` concept.

Final public names are:

```text
initialVisible
initialPinned
initialWidth
initialFlex
```

This keeps concepts distinct:

```text
fieldDefaults
→ entity/config-level values that compile into AG Grid defaultColDef

initialWidth / initialFlex / initialVisible / initialPinned
→ initial state properties that may appear in defaults or on one field
```

### `FieldLayoutDefinition`

```ts
interface FieldLayoutDefinition {
  initialVisible?: boolean;
  initialPinned?: "left" | "right";
  sizing?: FieldSizingDefinition;
}
```

Compiler mapping requirement:

```text
initialVisible → AG Grid initialHide (inverse boolean)
initialPinned  → AG Grid initialPinned
```

Initial values seed state; they are not authorization constraints and must not continually override later allowed Grid State/user choices.

### `FieldSizingDefinition`

Finalized union prevents width/flex together:

```ts
// fixed-width branch
{
  initialWidth?: number;
  initialFlex?: never;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
}

// flex branch
{
  initialWidth?: never;
  initialFlex?: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
}
```

Compiler mapping:

```text
initialWidth → AG Grid initialWidth
initialFlex  → AG Grid initialFlex
minWidth     → AG Grid minWidth
maxWidth     → AG Grid maxWidth
resizable    → AG Grid resizable
```

Rules:

- width and flex are mutually exclusive;
- frontend TypeScript encodes that mutual exclusion;
- backend JSON must be runtime-validated rather than repaired;
- runtime validation must also reject non-positive width/flex values, `minWidth > maxWidth`, and initial width outside configured min/max bounds;
- `minWidth` and `maxWidth` can bound flex sizing;
- `resizable` inherits the resolved default-column setting when omitted.

## TypeScript typing versus backend JSON

Durable architecture rule:

```text
frontend-owned definitions
→ strong type narrowing where useful
→ compile-time checking

backend JSON metadata
→ ordinary runtime values
→ validate schema + registries + invariants
→ trusted/resolved configuration
```

Do not weaken the frontend contract simply because JSON exists. Do not pretend TypeScript validates runtime JSON.

## Provisional / must be revisited

- Revisit strong generic typing of `dataAdapterKey` when the data-adapter registry is designed.
- Row-ID path typing could be narrowed later if row-path utility design remains usable.
- Row-ID accessor/resolver support only if a real entity cannot expose identity through a path.
- Exact translation resource/module layout waits for translation infrastructure; resources should remain feature-oriented.
- Runtime configuration validation/schema/versioning is mandatory but not yet designed.
- Filter custom-operator registry/query mapping is still required before custom operator keys execute semantics.
- `FieldDefaultsDefinition` should be expanded only when newly designed field properties are genuinely safe/useful as entity-wide AG Grid default-column values; do not automatically add every future `FieldDefinition` property.
- Full Grid State/user-preference reconciliation is not yet designed, though initial-state versus current constraints precedence is already an established requirement.

## Remaining field design

Next field areas, in recommended sequence:

1. formatter/display-value behavior;
2. renderer selection and renderer registry;
3. editing/editor selection plus parser/normalizer/value-conversion boundaries;
4. validation declarations;
5. searchability and server sort/filter/search mapping;
6. request/save mapping when read/write shapes differ;
7. access/security/masking integration;
8. accessor/resolver only if a real field cannot be represented by a simple path.

Do not assume exact property names/shapes from old chat examples; review each coherent batch before promoting to source.

## Documentation tooling requirement

Once the contract tree is substantial enough:

- TypeDoc or equivalent for searchable generated API/type docs;
- TsUML2 or equivalent for generated interface/type relationship visualization;
- generate from TypeScript as much as practical;
- do not distort TypeScript architecture to satisfy diagram tooling.

## Deferred configuration areas beyond fields

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
- Configuration versioning/runtime validation.
- Exact top-level configuration envelope/runtime compiler.

## CI / push cadence

Batch related decisions before ordinary pushes. There is currently no open PR. Do not merge anything without explicit approval. Browser/Playwright can remain paused for this design/types/docs phase if a PR is later opened; restore it before runtime/grid integration materially needs browser coverage.

## Exact resume point

The layout/default-column correction is complete once this checkpoint is pushed.

Resume with **formatter/display-value behavior + renderer selection/renderer registry**.

Keep the distinction explicit:

```text
formatter
→ converts a value into its displayed textual/value representation

renderer
→ provides richer cell UI/rendering when formatting alone is insufficient
```

Do not require custom renderers for ordinary number/date/currency/text formatting.
