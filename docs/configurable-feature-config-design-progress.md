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

## Current design proposal: `FieldDefinition`

This is the exact point reached in the design discussion. **Nothing in this section is finalized yet unless explicitly promoted later.** Do not add it to TypeScript source merely because it is recorded here.

Current proposed first shape:

```ts
interface FieldDefinition {
  id: string;
  field: string;
  labelKey: string;
}
```

Proposed meaning:

- `id`: stable configuration identity for the field/column. It should remain stable even if the API property path changes. This identity may later be referenced by Grid State/preferences, access rules, validation, field lookup, and other configuration relationships.
- `field`: path in the API row containing the field value. Common case is a direct property such as `amount`; dot notation such as `loan.amount` should support nested API row shapes.
- `labelKey`: full explicit translation key used to resolve the displayed field/column label, following the same explicit-translation-key approach already finalized for `EntityDefinition.labelKey`.

Important distinction under discussion:

```text
id
→ stable configuration identity

field
→ location of the actual value in the API row
```

Example only for understanding the proposal:

```ts
{
  id: "loanAmount",
  field: "financials.amount",
  labelKey: "review.fields.loanAmount.label",
}
```

The proposal intentionally allows `id` and `field` to differ so backend/API shape can evolve without automatically changing stable configuration identity.

### Intended parent connection

Still provisional:

```ts
interface EntityDefinition {
  // existing finalized members...
  fields: FieldDefinition[];
}
```

Array form is currently preferred because array order naturally represents configured default column order while `FieldDefinition.id` supplies stable field identity. Do not add this member to source until the `FieldDefinition` contract is actually agreed.

### Field areas still to design

These are not optional reminders; they are the remaining field-design surface that future chats must continue reviewing rather than forgetting:

- value/data type;
- sort capability/configuration;
- filter capability/configuration;
- searchability where the product needs it;
- default visibility/presentation and other column-level defaults that truly belong in public configuration;
- formatter/display-value behavior;
- editor/editability and editor selection;
- parser/normalizer/value conversion stages where required;
- validation declarations;
- server sort/filter/search keys when API/query field names differ from displayed/API-row paths;
- access/security/masking integration;
- accessor/resolver support only if a real field cannot be represented by a simple row path;
- request/save mapping for fields whose read and write shapes differ.

Do not assume final property names or nested shapes for these areas from chat examples. Review them in coherent batches and record every accepted/rejected/deferred decision here.

## Provisional / must be revisited

These items are intentionally preserved so a new chat does not lose them:

- `EntityDefinition.fields: FieldDefinition[]` is the intended next major entity member, but remains provisional until `FieldDefinition` is agreed.
- Revisit strong generic typing of `dataAdapterKey` when the data-adapter registry is designed.
- Revisit whether translation keys should be strongly typed when translation infrastructure/types are designed.
- Row-ID accessor/resolver support should be added only if a real entity cannot expose stable identity through a simple field path.
- Translation resources should be feature-oriented rather than one giant global file; exact physical i18n file/module layout waits for translation infrastructure.
- Easy concept documentation is required and should grow only as concepts are actually finalized. Current glossary is `docs/configurable-feature/concepts.md`.

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
- Configuration versioning and configuration validation.
- Exact top-level configuration envelope.

## CI / push cadence

Batch several related decisions before ordinary pushes where practical; explicit user request to push sooner overrides this. There is currently no open PR. If a PR is opened during config-design/types/docs work, Playwright/browser regression may be temporarily paused while normal non-browser checks remain; restore Playwright before runtime/grid integration where browser coverage is materially needed.

## Exact resume point

Resume at **`FieldDefinition`**.

The current proposal is:

```ts
interface FieldDefinition {
  id: string;
  field: string;
  labelKey: string;
}
```

It has been explained but **has not yet been explicitly approved/finalized**. First confirm/challenge this initial identity/binding/label group, then continue through the remaining field areas in coherent batches rather than stopping after every single property.

When `FieldDefinition` has enough finalized shape, add it to `configuration.types.ts`, add `EntityDefinition.fields: FieldDefinition[]`, provide proper JSDoc following `documentation-standard.md`, update `configuration-reference.md`, update `concepts.md` if needed, and update this continuation file.