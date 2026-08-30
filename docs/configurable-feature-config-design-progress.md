# Configurable Feature Configuration Design Progress

## Purpose

Living continuation file for the interface-by-interface configuration design on `configurable-feature-grid`. Use it when a chat/session changes so the next discussion resumes from the exact design point.

Primary architecture context remains `docs/configurable-feature-handoff.md`. Public library-style docs live under `docs/configurable-feature/`.

## Working rules for this design

- Keep work on `configurable-feature-grid`; do not create another branch unless explicitly requested.
- Design parent concepts first, then related child properties/interfaces in small coherent batches.
- Preserve every important unresolved item here as **Provisional** or **Deferred**; do not rely on chat memory.
- TypeScript source exposes finalized contracts only.
- Public interfaces/non-obvious properties require useful JSDoc for IDE hover.
- JSDoc describes only the real contract; no irrelevant comparisons/speculation.
- Separate Markdown docs provide the deeper library-style explanation.
- Group related source/docs; avoid one giant file and avoid one file per tiny interface.
- Shared configuration contracts must be feature-, entity-, and row-model-neutral in shape. Concrete values and executable business behavior remain feature/entity owned.

## Implemented/finalized contracts

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
interface EntityDefinition {
  labelKey: string;
  dataAdapterKey: string;
  rowId: RowIdDefinition;
}
```

Finalized:
- `labelKey` is required.
- Use a full explicit translation key, e.g. `review.entities.loan.label`; do not derive it automatically from feature/entity identity.
- `dataAdapterKey` is required and resolves the registered frontend data/API adapter for that feature/entity.
- A data adapter covers loading/saving and request/response mapping required by those data operations; it is not a bucket for unrelated entity utilities.
- `rowId` is required.

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

## Provisional / must be revisited

These items are intentionally preserved so a new chat does not lose them:

- `EntityDefinition.fields: FieldDefinition[]` is the intended next major entity member. Array form is preferred because configured default column order matters. Do not add it to source until `FieldDefinition` has a real agreed shape.
- Revisit strong generic typing of `dataAdapterKey` when the data-adapter registry is designed.
- Revisit whether translation keys should be strongly typed when translation infrastructure/types are designed.
- Row-ID accessor/resolver support should be added only if a real entity cannot expose stable identity through a simple field path.
- Translation resources should be feature-oriented rather than one giant global file; exact physical i18n file/module layout waits for translation infrastructure.
- Easy concept documentation is required and should grow only as concepts are actually finalized. Current glossary is `docs/configurable-feature/concepts.md`.

## Deferred configuration areas

Review one by one; do not infer final shapes from earlier chat examples:

- `FieldDefinition` and field identity/binding.
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
- Configuration versioning and configuration validation.
- Exact top-level configuration envelope.

## CI / push cadence

Batch several related decisions before ordinary pushes where practical; explicit user request to push sooner overrides this. There is currently no open PR. If a PR is opened during config-design/types/docs work, Playwright/browser regression may be temporarily paused while normal non-browser checks remain; restore Playwright before runtime/grid integration where browser coverage is materially needed.

## Exact resume point

Next major interface: **`FieldDefinition`**.

Start by identifying the smallest coherent field batch, likely field identity/binding and display label, then continue through related properties without stopping after every single key.

Remember that `EntityDefinition.fields: FieldDefinition[]` is already the provisional intended parent connection and must be finalized/added once `FieldDefinition` has enough real shape.