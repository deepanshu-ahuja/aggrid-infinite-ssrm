# Configurable Feature Configuration Design Progress

## Purpose

Living continuation file for interface-by-interface configurable-feature design on `configurable-feature-grid`. A new chat/session should read this file after `AGENTS.md` and `docs/configurable-feature-handoff.md` so it can resume from the exact current point without relying on chat memory.

Public library-style docs live under `docs/configurable-feature/`.

## Working rules

- Keep work on `configurable-feature-grid`; do not create another branch unless explicitly requested.
- Design related interfaces/properties in coherent batches rather than stopping after every key.
- Preserve every important unresolved idea here as **Provisional** or **Deferred**.
- TypeScript source contains sufficiently finalized public contracts only.
- Public interfaces/non-obvious properties require useful JSDoc/IDE hover documentation.
- Keep TypeScript/JSDoc, `configuration-reference.md`, `concepts.md` where relevant, and this progress file synchronized.
- Shared configuration shapes stay feature-, entity-, and row-model-neutral; concrete values and executable business behavior stay feature/entity owned.
- Frontend-authored configuration should use useful generic/type narrowing rather than weakening everything to unconstrained `string`.
- Backend JSON remains runtime data and must be validated before becoming trusted/resolved configuration.
- Field-level public properties need a deliberate compiler/resolver path into AG Grid or a bounded frontend registry. Do not add metadata that has no implementable meaning.
- Do not expose the whole AG Grid `ColDef` API as our public configuration. Add only stable product-level needs.

Documentation quality follows `docs/configurable-feature/documentation-standard.md`.

## Repository state at this checkpoint

- Working branch: `configurable-feature-grid`.
- Before this batch, branch head was `87f3f853b7a7b71915c67bd3d49cd76dc89e5fea` (`feat: define configurable field core contract`).
- `main` was `0ab2c5f1e79a868c96209899b223bc6aafdc97e2`, merge of PR #41.
- `grid-foundation` was `92abc3b988c6ba30026ed9af42dc1f18db90ff31`.
- No open PR existed when this batch started.
- Latest repository CI visible at that point was the successful `main` push run for `0ab2c5f1...`.

Re-inspect GitHub before future implementation; these SHAs are only a checkpoint record.

## Overall design coverage

```text
FeatureDefinition                     DONE (source + docs)
EntityDefinition                      PARTIAL, core + fields connection done
RowIdDefinition                       DONE (source + docs)
FieldDefinition core                  DONE (source + docs)
  identity / API binding / label      DONE
  semantic data type                  DONE
  sortable capability                 DONE
  filter capability/operators         DONE
Field layout/defaults                 DONE (source + docs)
  default visibility                  DONE
  initial pinning                     DONE
  fixed/flex sizing                   DONE
  min/max/resizable constraints       DONE
Formatting/display                    NEXT
Renderer registry/selection           NOT YET DESIGNED
Editing/editor/value conversion       NOT YET DESIGNED
Validation declarations               NOT YET DESIGNED
Server sort/filter/search mapping     NOT YET DESIGNED
Request/save field mapping            NOT YET DESIGNED
Access/security/masking               NOT YET DESIGNED
Data-adapter registry contract        NOT YET DESIGNED
Actions/business operations           NOT YET DESIGNED
Grid State/preferences reconciliation PARTIAL PRINCIPLES ONLY
Config validation/versioning          REQUIRED, SHAPE NOT YET DESIGNED
Final runtime/compiler composition    NOT YET IMPLEMENTED
```

## Finalized contracts

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
- Entity identity is the record key; no duplicate `entityKey` or `supportedEntities` list.

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
  fields: readonly TFieldDefinition[];
}
```

Finalized:

- `labelKey` is a full explicit translation key and can be narrowed by frontend-owned types.
- `dataAdapterKey` resolves the feature/entity frontend data/API adapter for loading/saving and required request/response mapping.
- `rowId` is required.
- `fields` is a readonly array; array order supplies default column order while each field owns stable identity.

### `RowIdDefinition`

```ts
interface RowIdDefinition {
  path: string;
}
```

Finalized:

- explicit path to the stable business ID in the API row;
- common case `id`;
- dot notation such as `loan.id` supported;
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

### Identity/binding/label

- `id` is stable configuration identity and should eventually compile to AG Grid `colId`.
- `field` is the API-row value path; direct properties and dot notation are supported.
- `labelKey` is the full explicit translation key for the displayed field label.
- `id` and `field` are intentionally separate so API response shape can change without automatically changing stable configuration identity.
- Frontend definitions may narrow IDs/paths/translation keys; backend JSON still requires runtime validation.

### `dataType`

```ts
type FieldDataType = "text" | "number" | "boolean" | "date" | "dateTime";
```

- semantic field value category;
- selects type-appropriate shared filter operators;
- current AG Grid v36.1 also has matching built-in cell data types, so the future compiler can map these categories into `cellDataType` where appropriate;
- formatter/editor overrides remain separate contracts.

### `sortable`

- optional boolean;
- omitted means shared sortable default `true`;
- explicit `false` disables sorting.

### `filter`

```ts
interface FieldFilterDefinition<TOperator extends string = FilterOperator> {
  operators: readonly [TOperator, ...TOperator[]];
}
```

- no `filterable` boolean;
- omitted `filter` means not filterable;
- present `filter` means filterable with exactly the non-empty `operators` list;
- type-specific shared operator vocabularies align with the repository's current server filter presets;
- feature-specific typed operator keys are allowed only when a real bounded frontend/query/backend meaning exists;
- backend metadata never supplies executable functions.

Important runtime compiler requirement: current shared `defaultColDef` has `filter: true`, so an omitted configurable `filter` must explicitly compile to AG Grid `filter: false` or the public contract would be violated.

## Field layout/defaults — finalized

The public field now has:

```ts
layout?: FieldLayoutDefinition;
```

Layout is intentionally a **bounded initial-state/sizing contract**, not a catch-all presentation bucket and not a copy of AG Grid `ColDef`. Formatting, rendering, editing, tooltips, etc. remain separate design areas.

### `FieldLayoutDefinition`

```ts
interface FieldLayoutDefinition {
  defaultVisible?: boolean;
  defaultPinned?: "left" | "right";
  sizing?: FieldSizingDefinition;
}
```

Finalized semantics:

- `layout` is optional; omission uses shared grid defaults.
- layout defaults describe the starting user-facing column state, not authorization/security.
- saved/persisted Grid State may later override these defaults.
- current authorization/access/masking must eventually win over saved preferences when that access-resolution contract is designed.

### `defaultVisible`

- optional; omitted means initially visible.
- compiler mapping: `defaultVisible` -> inverse of AG Grid `initialHide`.
- use `initialHide`, not stateful `hide`, so rebuilding/updating column definitions does not reset a user's visibility state.

### `defaultPinned`

```ts
type FieldPinnedPosition = "left" | "right";
```

- optional; omission means initially unpinned.
- compiler mapping: `defaultPinned` -> AG Grid `initialPinned`.
- use `initialPinned`, not stateful `pinned`, to preserve later user/Grid-State pinning.

### Field sizing

```ts
interface FieldSizingConstraintsDefinition {
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
}

type FieldSizingDefinition =
  | (FieldSizingConstraintsDefinition & {
      defaultWidth?: number;
      defaultFlex?: never;
    })
  | (FieldSizingConstraintsDefinition & {
      defaultWidth?: never;
      defaultFlex?: number;
    });
```

Finalized decisions:

- support both fixed initial width and flex initial sizing;
- `defaultWidth` and `defaultFlex` are mutually exclusive in TypeScript;
- runtime JSON validation must enforce the same mutual-exclusion rule;
- `defaultWidth` maps to AG Grid `initialWidth`;
- `defaultFlex` maps to AG Grid `initialFlex`;
- `minWidth` maps to AG Grid `minWidth`;
- `maxWidth` maps to AG Grid `maxWidth`;
- `resizable` maps to AG Grid `resizable`;
- flex may use `minWidth` and `maxWidth` constraints;
- manual resize of a flex column may disable flex in AG Grid; that becomes ordinary user state and must not be re-forced by column-definition refreshes.

Current shared/default behavior:

- repository `baseDefaultColDef.minWidth` is currently `120`, so omitted field `minWidth` inherits shared behavior;
- AG Grid resizing is enabled by default and the repository also expects `true`, so omitted `resizable` means resizable;
- no field-specific `maxWidth` when omitted;
- if neither default width nor flex is configured, the compiler should not invent one; shared/AG Grid column defaults determine the starting width.

### Runtime sizing validation requirements

The eventual config validator must reject at least:

- both `defaultWidth` and `defaultFlex` present;
- zero/negative/non-finite width/flex/min/max values;
- `minWidth > maxWidth`;
- fixed `defaultWidth` outside declared min/max bounds.

Do not add branded positive-number types just to pretend JSON has compile-time guarantees; runtime validation is the real authority for backend metadata.

## Durable AG Grid compiler mapping principle

Every public field-level option must have a real compiler or bounded-resolver path. Current expected mapping:

```text
field.id                              -> ColDef.colId
field.field                           -> ColDef.field
field.labelKey                        -> translated ColDef.headerName
field.dataType                        -> ColDef.cellDataType / type-specific behavior
field.sortable                        -> ColDef.sortable
field.filter                          -> filter + filterParams
filter omitted                        -> ColDef.filter = false
layout.defaultVisible                 -> ColDef.initialHide
layout.defaultPinned                  -> ColDef.initialPinned
layout.sizing.defaultWidth            -> ColDef.initialWidth
layout.sizing.defaultFlex             -> ColDef.initialFlex
layout.sizing.minWidth                -> ColDef.minWidth
layout.sizing.maxWidth                -> ColDef.maxWidth
layout.sizing.resizable               -> ColDef.resizable
```

The use of AG Grid `initial*` properties is deliberate. AG Grid documents `width`, `flex`, `hide`, and `pinned` as stateful properties that can overwrite user state when column definitions are updated; `initialWidth`, `initialFlex`, `initialHide`, and `initialPinned` apply only when the column is created.

Do not expose new public keys solely because AG Grid supports them. First establish a real stable product requirement and its interaction with Grid State, access, and runtime validation.

## TypeScript versus backend JSON

```text
frontend-owned definitions
→ narrow generic/type values where useful
→ compile-time checking

backend JSON
→ runtime data
→ schema + registry/capability validation
→ trusted/resolved configuration
→ compiler
```

Do not weaken all frontend types because JSON exists, and do not pretend TypeScript validates JSON.

## Provisional / must be revisited

- Strong typing of `dataAdapterKey` when the adapter registry is designed.
- Possible stronger typing for `RowIdDefinition.path` if row-path propagation can be introduced without making the generic surface unreasonable.
- Row-ID accessor/resolver only if a real entity cannot expose stable identity through a simple path.
- Exact translation resource/module structure and generated/narrowed translation-key type strategy.
- Custom filter-operator registry/query mapping.
- Runtime configuration schema/library/versioning.
- Exact Grid State reconciliation algorithm; principle already fixed that current authorization/config constraints beat stale saved preferences.
- Whether future layout needs additional stable product controls such as size-to-fit participation, movement restrictions, or visibility locking. Do **not** add these merely to mirror AG Grid; require a concrete product need first.

## Field areas still to design

Next field work should cover these in substantial coherent batches:

1. formatter/display-value behavior;
2. renderer selection and renderer registry contract;
3. editing/editability, editor selection and editor registry;
4. parser/normalizer/value-conversion stages;
5. validation declarations;
6. searchability and server sort/filter/search keys where API/query names differ from row paths;
7. request/save field mapping for different read/write shapes;
8. access/security/masking integration;
9. accessor/resolver support only if real fields cannot be represented by simple paths.

## Documentation tooling requirement

Once the public contract tree is large enough, add:

- TypeDoc or equivalent for searchable generated API/type docs;
- TsUML2 or equivalent for a generated SVG/type-composition hierarchy;
- generated hierarchy visible alongside detailed reference where the docs UI supports it.

Tooling must follow the TypeScript architecture, never influence it. If a tool cannot represent the real composition, change/supplement the tool rather than distorting interfaces.

## Deferred areas beyond fields

- Renderer/editor/formatter/parser/normalizer/accessor registries.
- Data-adapter registry contract and operations.
- Query/request/save mapping.
- Validation declarations.
- Actions/business operations.
- Resolved access/security/masking.
- Routing/view manifest.
- Page-level configuration.
- Translation infrastructure/fallbacks.
- Grid State/preferences reconciliation.
- Configuration versioning/runtime validation.
- Exact top-level envelope and runtime compiler.

## Exact resume point

**Field layout/defaults are now finalized in source/docs.**

Resume at **formatter/display behavior + renderer selection/registry**. Do not reopen sizing unless a concrete implementation conflict is found.

When discussing formatting/rendering, preserve these distinctions:

- `dataType` is semantic value type, not a complete formatter/renderer decision;
- display formatting and rich cell rendering are different responsibilities;
- executable formatter/renderer functions stay frontend-owned and should be selected by bounded registry keys, not delivered as backend JavaScript;
- the public contract should document exactly how each accepted key compiles/resolves into AG Grid behavior;
- avoid one giant renderer/formatter registry that absorbs unrelated business logic.

After the next coherent contract batch, update TypeScript/JSDoc/reference/concepts/progress together and push a coherent checkpoint.
