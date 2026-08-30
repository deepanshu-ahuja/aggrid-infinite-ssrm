# Configurable Feature Configuration Design Progress

## Purpose

This is the **living continuation file** for the interface-by-interface configuration design discussion on `configurable-feature-grid`.

Use it when a chat/session changes so the next discussion can resume from the exact design point without reconstructing decisions from conversation history.

This file is intentionally narrower than `docs/configurable-feature-handoff.md`.

## Authority and reading order

For this configurable-feature effort:

1. read root `AGENTS.md` first for repository-wide working rules;
2. treat `docs/configurable-feature-handoff.md` as the primary architecture/design context;
3. use `docs/configurable-feature/` as the library-style configuration documentation for agreed public contracts;
4. use this file for detailed discussion status, accepted/rejected/deferred decisions, and the exact resume point;
5. use `docs/grid-backlog.md` for broader sequencing/status.

PR #40 and older configurable-grid experiments remain reference-only when they conflict with the handoff.

Do not treat an idea in this file as finalized unless it is explicitly marked **Finalized**.

## Working branch

All work for this effort remains on:

```text
configurable-feature-grid
```

Do not create another branch unless explicitly requested.

## Discussion method

Design the configuration **parent concept first, then its child properties/interfaces**.

For each interface:

1. Explain its purpose in plain language.
2. Review each property individually.
3. For each property, explain only what is useful for understanding the real contract, including where relevant:
   - why it exists;
   - who provides it;
   - who consumes it;
   - required versus optional;
   - default/fallback;
   - a short example when the example materially improves understanding.
4. Challenge whether the property/interface is needed at all.
5. Mark the decision as Finalized, Deferred, or Rejected.
6. Move to the next small group only after the current one is understood.

Do not dump the complete schema at once.

## Documentation and source-organization requirements

The public configuration API requires two documentation layers:

- **JSDoc in TypeScript** for concise IDE/hover documentation;
- **library-style Markdown documentation** under `docs/configurable-feature/` for developers, architects, reviewers, or readers who do not have the source file open.

JSDoc rules:

- describe the contract that actually exists;
- do not repeat the property name in sentence form;
- do not add comparisons with APIs or concepts that are not part of the property;
- do not add future/speculative behavior to hover documentation;
- add an example only when it makes the real contract easier to understand.

Documentation/file-organization rules:

- do not grow one giant documentation file indefinitely;
- split documentation by coherent topic as the public surface grows;
- do not create one source file per interface by default;
- group closely related contracts together, and split when responsibilities become meaningfully different.

## Shared configuration ownership

The main public configuration contracts are intended to be reusable by configurable grid/table features.

A contract belongs in shared configurable-grid code only when its **shape** remains useful regardless of:

- the business feature;
- the entity/data context;
- Client, Infinite, or SSRM row model choice.

Concrete values and executable business behavior remain feature/entity owned. Examples include concrete feature keys, entity keys, adapters, request/save mappers, business actions, and business validation choices.

Row-model-specific mechanics remain in their existing row-model/shared-mechanics boundaries rather than being added to generic business configuration merely for consistency.

## Interface review 1: `FeatureDefinition`

### Purpose

`FeatureDefinition` is the shared top-level configuration contract for one configurable business feature.

Current agreed design shape:

```ts
interface FeatureDefinition<
  TFeatureKey extends string = string,
  TEntityKey extends string = string,
> {
  featureKey: TFeatureKey;
  entities: Record<TEntityKey, EntityDefinition>;
}
```

This is currently a **design contract**. TypeScript source is intentionally not being added yet because `EntityDefinition` has no finalized members; adding a placeholder/empty production interface would create misleading code.

### `featureKey`

Purpose: stable programmatic identity of the feature definition.

Example:

```ts
featureKey: "review"
```

The shared contract uses a generic string key so each feature can narrow its own key without requiring one central union of every application feature.

**Decision: Finalized — required.**

### `entities`

Purpose: entity configurations available within the feature, keyed by their stable entity identifier.

Example:

```ts
entities: {
  loan: loanDefinition,
  finance: financeDefinition,
}
```

The record key is the entity identity used to select a definition.

**Decision: Finalized — keep `entities` as the entity-definition map.**

### `supportedEntities`

Earlier discussion considered a separate property such as:

```ts
supportedEntities: ["loan", "finance"]
```

Once entity definitions are keyed under `entities`, that separate list duplicates the same identity set.

**Decision: Rejected — do not add `supportedEntities`.**

## Interface review 2: `EntityDefinition`

### Purpose

`EntityDefinition` is the shared contract describing one entity/data context inside a configurable feature.

For the Review example, `loan` and `finance` each resolve to an `EntityDefinition` value through `FeatureDefinition.entities`.

### Entity identity

The entity's stable identity is the key in the `entities` record:

```ts
entities: {
  loan: loanDefinition,
}
```

A second `entityKey: "loan"` property inside `loanDefinition` would duplicate the same identity and permit inconsistent values.

**Decision: Finalized — entity identity is the `entities` record key. Do not add a duplicate `entityKey` member to `EntityDefinition`.**

### Remaining shape

No actual `EntityDefinition` property has been finalized yet.

**Decision: Deferred — review the first real entity property next.**

## Finalized decisions

- Public configuration shapes are shared when they are feature-, entity-, and row-model-neutral.
- Concrete business values and executable business behavior remain feature/entity owned.
- Documentation is split into JSDoc plus separate library-style Markdown documentation.
- Documentation/source files are grouped by coherent responsibility rather than one giant file or one file per interface.
- JSDoc describes only the real contract and uses examples only when useful.
- `FeatureDefinition` is a shared generic contract.
- `FeatureDefinition.featureKey` is required and generic over a string key.
- `FeatureDefinition.entities` maps stable entity keys to entity definitions.
- A separate `supportedEntities` list is not used.
- `EntityDefinition` is a shared contract.
- Entity identity is the `entities` record key; `EntityDefinition` does not duplicate it with an `entityKey` property.

## Deferred / not yet finalized

- First real property of `EntityDefinition`.
- Datasource/data-adapter key naming and placement.
- Row identity contract.
- Routing/view manifest shape.
- Resolved access shape.
- Field definitions.
- Renderer/editor/formatter/parser/normalizer/accessor registries.
- Validation declaration shape.
- Actions.
- Masking/access capabilities.
- Query/request/save mapping.
- Translation configuration.
- User preferences/Grid State reconciliation.
- Configuration versioning and configuration validation.
- Exact final top-level configuration envelope.

None of the deferred items should be assumed from earlier chat examples; review them one by one.

## CI / push cadence note

During this design phase, batch several related interface decisions before ordinary pushes where practical. An explicit request to push sooner overrides that batching preference.

There is currently no open PR for this branch. When a PR is opened while work is still limited to configuration design/types/docs, the Playwright/browser regression job may be temporarily paused to avoid repeated expensive browser runs. Keep the normal non-browser checks. Restore Playwright before relying on the PR for runtime/grid integration changes where real-browser coverage is materially needed.

Do not claim browser validation for code that has not actually run it.

## Exact resume point

**Next discussion: the first real property of `EntityDefinition`.**

Start with the data ownership question:

> After selecting the `loan` or `finance` entity definition, how should that definition identify the frontend data/service adapter that loads and saves that entity's data?

Discuss the need and naming (`dataAdapterKey`, `dataSourceKey`, or another bounded name) before adding the property.

Do not jump ahead into fields, renderers, editors, routing, masking, Grid State, or the rest of the schema until that property is understood and decided.