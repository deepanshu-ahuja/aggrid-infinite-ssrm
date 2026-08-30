# Configurable Feature Configuration Design Progress

## Purpose

Durable continuation file for configurable-feature contract design on `configurable-feature-grid`.

Primary architecture context: `docs/configurable-feature-handoff.md`.
Public reference: `docs/configurable-feature/configuration-reference.md`.
Documentation standard: `docs/configurable-feature/documentation-standard.md`.

## Working rules

- Stay on `configurable-feature-grid`; do not create another working branch unless explicitly requested.
- Design related properties/interfaces in coherent batches rather than stopping after every property.
- Source TypeScript contains sufficiently finalized public contracts only.
- Preserve unresolved/provisional/deferred issues here so chat memory is never required.
- Backend configuration is JSON-safe declarative data; executable behavior remains frontend-owned behind registries/adapters.
- Strong frontend typing is useful, but it does not validate backend JSON. Runtime schema/registry validation remains mandatory.
- Reuse native AG Grid behavior where it already provides the correct primitive; do not invent a parallel framework without need.
- Shared contracts stay feature/entity/row-model neutral in shape; concrete business behavior remains feature/entity owned.

## Overall coverage snapshot

```text
FeatureDefinition                       DONE
EntityDefinition                        PARTIAL, core/fields/defaults done
RowIdDefinition                         DONE
FieldDefinition core                    DONE
  identity / API binding / label        DONE
  semantic data type                    DONE
  sortable capability                   DONE
  filter capability/operators           DONE
Field defaults + layout/sizing          DONE
Formatter/display-value contract        DONE
Renderer selection contract             DONE
Formatter/renderer runtime registries   NOT YET IMPLEMENTED/DESIGNED IN DETAIL
Editing/editor/value conversion         NOT YET DESIGNED
Validation declarations                 NOT YET DESIGNED
Server sort/filter/search mapping       NOT YET DESIGNED
Request/save field mapping              NOT YET DESIGNED
Access/security/masking                  NOT YET DESIGNED
Data-adapter registry contract          NOT YET DESIGNED
Actions/business operations             NOT YET DESIGNED
Grid State/preferences reconciliation   PARTIAL PRINCIPLES ONLY
Config validation/versioning            NOT YET DESIGNED
Final runtime/compiler composition      NOT YET DESIGNED
```

## Finalized root/entity contracts

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

Final decisions:

- `featureKey` is a stable programmatic feature identity.
- `entities` is keyed by stable entity identity.
- No duplicate `supportedEntities` list.
- No duplicate `entityKey` inside `EntityDefinition`.

### `EntityDefinition`

Current shape includes:

```ts
interface EntityDefinition<...> {
  labelKey: TTranslationKey;
  dataAdapterKey: string;
  rowId: RowIdDefinition;
  fieldDefaults?: FieldDefaultsDefinition;
  fields: readonly TFieldDefinition[];
}
```

Final decisions:

- `labelKey` is an explicit full translation key and may be narrowed by frontend types.
- `dataAdapterKey` resolves the frontend data/API adapter for load/save/request-response mapping.
- `rowId` is required and explicit.
- `fieldDefaults` is optional common field configuration compiled into AG Grid `defaultColDef` on top of shared `baseDefaultColDef`.
- `fields` is required; array order is initial column order while stable identity comes from field `id`.

## Default-column relationship — finalized

Use AG Grid's own default-column precedence rather than inventing a general merge engine:

```text
shared baseDefaultColDef
        +
entity.fieldDefaults
        ↓
AG Grid defaultColDef

entity.fields[]
        ↓
individual AG Grid columnDefs[]
```

An individual `ColDef` value overrides the corresponding `defaultColDef` value through AG Grid's native precedence.

`fieldDefaults` is deliberately not named `defaultColDef`: it is our bounded public configuration contract, not an unrestricted AG Grid `ColDef` bag.

Current `FieldDefaultsDefinition` includes only designed options with clean default semantics:

```ts
interface FieldDefaultsDefinition {
  sortable?: boolean;
  layout?: FieldLayoutDefinition;
}
```

Do not automatically add every future field property to `fieldDefaults`. A defaultable behavior needs clear inheritance and a clean way to override/disable it without undocumented repair logic.

## `RowIdDefinition` — finalized

```ts
interface RowIdDefinition {
  path: string;
}
```

- Common case: `id`.
- Nested paths such as `loan.id` supported.
- No implicit default.
- Row-ID path strong typing may be revisited if a clean row-path utility is introduced.
- Accessor/resolver support only if a real entity cannot expose identity via a simple path.

## `FieldDefinition` core — finalized

Conceptual shape now includes:

```ts
interface FieldDefinition<
  TFieldId extends string = string,
  TFieldPath extends string = string,
  TTranslationKey extends string = string,
  TDataType extends FieldDataType = FieldDataType,
  TAdditionalFilterOperator extends string = never,
  TFormatterKey extends string = string,
  TRendererKey extends string = string,
> {
  id: TFieldId;
  field: TFieldPath;
  labelKey: TTranslationKey;
  dataType: TDataType;
  sortable?: boolean;
  filter?: FieldFilterDefinition<...>;
  layout?: FieldLayoutDefinition;
  formatter?: FieldFormatterDefinition<TFormatterKey>;
  renderer?: FieldRendererDefinition<TRendererKey>;
}
```

### Identity/binding

- `id` = stable configuration identity.
- `field` = API row value path.
- They intentionally may differ.
- `field` supports dot notation.
- Frontend-owned definitions may narrow field paths; backend JSON remains runtime-validated data.

### Translation

- `labelKey` is a full explicit translation key.
- Do not derive it automatically from feature/entity/field identity.
- Exact translation-resource infrastructure remains deferred.

### Data type

Final union:

```ts
"text" | "number" | "boolean" | "date" | "dateTime"
```

It expresses semantic value category and supplies the shared base filter vocabulary. It does not automatically finalize formatting/editing/validation policy.

### Sortable

- Optional.
- Omitted means inherit the resolved AG Grid `defaultColDef`.
- `fieldDefaults.sortable` may override shared defaults.
- An individual field value overrides the default through native `ColDef` precedence.

## Filtering — finalized core

```ts
interface FieldFilterDefinition<TOperator extends string = FilterOperator> {
  operators: readonly [TOperator, ...TOperator[]];
}
```

Semantics:

```text
filter omitted → not filterable
filter present → filterable using exactly configured operators
```

No separate `filterable` boolean.

Shared operator sets align with existing server-backed filter support:

```text
text:    contains, equals, notEqual, startsWith, endsWith
number:  equals, notEqual, greaterThan, greaterThanOrEqual,
         lessThan, lessThanOrEqual
date:    equals, notEqual, lessThan, greaterThan
boolean: equals, notEqual
```

Feature-specific extra operator keys are allowed through typed extension, but they require a bounded query/operator registry and matching backend semantics before they are executable.

The future compiler must also explicitly disable filtering for a field whose `filter` is absent when the shared AG Grid `baseDefaultColDef` has `filter: true`; otherwise the public contract would be violated.

## Layout/sizing — finalized

Current layout contract:

```ts
interface FieldLayoutDefinition {
  initialVisible?: boolean;
  initialPinned?: "left" | "right";
  sizing?: FieldSizingDefinition;
}
```

Current sizing semantics:

```text
initialVisible → inverse of AG Grid initialHide
initialPinned  → AG Grid initialPinned
initialWidth   → AG Grid initialWidth
initialFlex    → AG Grid initialFlex
minWidth       → AG Grid minWidth
maxWidth       → AG Grid maxWidth
resizable      → AG Grid resizable
```

Final decisions:

- Use `initial*` names because they describe actual initial-state semantics.
- `initialWidth` and `initialFlex` are mutually exclusive in TypeScript and must also be rejected together by runtime JSON validation.
- `minWidth`/`maxWidth` may constrain fixed or flex sizing.
- Initial properties seed state; they must not continuously overwrite persisted/user Grid State.
- `minWidth`, `maxWidth`, `resizable` are continuing column constraints.
- Runtime validation must reject impossible numeric combinations such as non-positive width/flex and `minWidth > maxWidth`.

## Formatter contract — finalized configuration shape

```ts
interface FieldFormatterDefinition<TFormatterKey extends string = string> {
  key: TFormatterKey;
  params?: ConfigurationJsonObject;
}
```

Purpose:

- Select a frontend-registered value-presentation behavior.
- Configuration contains only a stable key plus optional JSON-safe params.
- Compiler resolves the key to executable frontend behavior and maps it to AG Grid `valueFormatter`.
- No backend-supplied functions or expression strings.

Examples from current concrete grid that motivated the separation:

- Amount uses `valueFormatter` for currency formatting.
- Transaction date uses `valueFormatter` for date formatting.

Formatter boundary:

- does not mutate raw row data;
- does not redefine save/edit values;
- server sort/filter/query semantics remain owned by server-query mapping, not display text;
- formatter output may affect clipboard/export because AG Grid can use `valueFormatter` there; configurable runtime/export integration must preserve the intended policy deliberately.

A formatter must remain safe for transient invalid local edit values. Existing `formatCurrency`/`formatDate` already follow this principle so rendering does not crash while validation keeps an invalid draft visible.

## Renderer contract — finalized configuration shape

```ts
interface FieldRendererDefinition<TRendererKey extends string = string> {
  key: TRendererKey;
  params?: ConfigurationJsonObject;
}
```

Purpose:

- Select a frontend-owned richer cell UI component.
- Backend configuration contains only key + JSON-safe params.
- Compiler resolves key to component and maps it to AG Grid `cellRenderer`; params map into registered renderer input / `cellRendererParams`.

Examples from current concrete grid:

- Status uses a React chip renderer.
- Access and row-action columns also use renderers, but those are not evidence that arbitrary non-data business-action columns should be smuggled into normal `FieldDefinition`; actions/access remain separate future configuration areas.

### Formatter vs renderer

Final distinction:

```text
formatter → transform/display value representation
renderer  → richer cell UI
```

They are not mutually exclusive. AG Grid renderer params can expose both raw and formatted value, so a renderer may intentionally use formatter output.

Do not use a renderer merely to format plain text when a formatter is sufficient. Do not use formatter/renderer params as a generic escape hatch for editing, validation, actions, query mapping or access control.

## JSON-safe behavior parameters — finalized base type

Public config now has recursive JSON-safe parameter types:

```ts
ConfigurationJsonPrimitive
ConfigurationJsonValue
ConfigurationJsonObject
```

Allowed: strings, numbers, booleans, null, arrays and nested objects.

Not allowed: functions, React elements, class instances or other executable/non-JSON values.

The future registry/runtime validation layer must validate both:

1. the configured formatter/renderer key exists and is allowed;
2. the supplied params match that registered behavior's accepted schema.

## Formatter/renderer strong typing — partial

`FieldDefinition` generics now allow frontend-owned configurations to narrow formatter and renderer keys.

The exact key-to-params type correlation is intentionally deferred until the formatter/renderer registry contracts are designed. Do not add many generic type parameters merely to pretend the params are strongly typed before that registry shape exists.

## Why formatter/renderer are NOT in `fieldDefaults` yet

This is deliberate, not forgotten.

Putting a formatter/renderer into AG Grid `defaultColDef` is easy; allowing one individual field to explicitly remove an inherited formatter/renderer must also have clean documented semantics. Do not depend on undocumented null/undefined clearing behavior or write hidden repair logic just to make the option defaultable.

Revisit default formatter/renderer support only when a real requirement exists and the disable/override contract is explicit.

## Existing implementation evidence inspected

`frontend/src/features/transactions/grid/transactionColumns.tsx` currently demonstrates:

- amount: currency `valueFormatter`;
- transactionDate: date `valueFormatter`;
- status: React `cellRenderer`;
- access/actions: renderers for richer/non-data UI;
- editors and validation/conflict presentation remain distinct from formatter/renderer concerns.

Shared formatter helpers intentionally tolerate invalid transient local drafts instead of throwing from rendering.

## TypeScript vs backend JSON — durable rule

```text
frontend-owned config
→ use useful generic/type narrowing

backend JSON
→ runtime values
→ schema + registry/capability validation
→ trusted/resolved config
→ compiler
```

Never weaken all frontend types to `string` merely because JSON is runtime data. Never claim TypeScript validates backend metadata.

## Provisional / must revisit

- Strong generic typing of `dataAdapterKey` when adapter registry is designed.
- Row-ID field-path typing if a clean row-path utility is introduced.
- Exact translation-key generation/inference and resource organization.
- Formatter/renderer registry implementation and key-to-param typing.
- Whether any formatter/renderer should become defaultable after a clean disable/inheritance contract is proven.
- Export/copy formatter policy in configurable runtime.
- Accessor/resolver support only for fields that genuinely cannot be represented by a row path.
- Runtime config schema/versioning and error reporting.

## Next coherent field batches

Continue without reopening settled core unless a concrete contradiction is found:

1. **Editing/editor + value conversion**
   - editable capability versus row-dependent edit policy;
   - editor registry key + JSON-safe params;
   - parser/normalizer boundary;
   - raw API value vs editor value vs local edit value vs save payload;
   - ensure current tracked-edit/conflict/validation mechanics remain usable.
2. **Validation declarations**
   - registry-backed validators;
   - local vs server validation ownership;
   - messages/translation references.
3. **Server query mapping**
   - sort/filter/search keys when API row field path differs from backend query field;
   - searchability.
4. **Read/write mapping**
   - request/save mapping when displayed/read path differs from write payload.
5. **Access/security/masking**
   - current authorization/config wins over defaults/user Grid State;
   - `maskable`, `canRequestUnmask`, `masked` remain distinct concepts.

After those field-level areas are sufficiently designed, continue to adapter registries, actions, page/routing composition, config validation/versioning and final runtime compiler.

## Push / validation state

- The `fieldDefaults` + `initial*` correction was pushed as commit `6c861354b74c793d08fe60a2e937bf710d6762c9`.
- No open PR existed at the last verified check.
- Type/lint/test execution is not claimed for connector-only type/docs changes unless actually run.
