# Configurable Feature Configuration Design Progress

## Purpose

This is the **living continuation file** for the interface-by-interface configuration design discussion on `configurable-feature-grid`.

Use it when a chat/session changes so the next discussion can resume from the exact design point without reconstructing decisions from conversation history.

This file is intentionally narrower than `docs/configurable-feature-handoff.md`.

- `docs/configurable-feature-handoff.md` remains the primary architecture/design context.
- This file records the **current detailed configuration-shape discussion**, including accepted decisions, deferred decisions, rejected ideas, and the next interface to review.
- PR #40 and older configurable-grid experiments remain reference-only when they conflict with the handoff.
- Do not treat an idea in this file as finalized unless it is explicitly marked **Finalized**.

## Working branch

All work for this effort remains on:

```text
configurable-feature-grid
```

Do not create another branch unless explicitly requested.

## Discussion method

We will design the configuration **molecule -> atom in discussion**, while implementation can later be **atom -> molecule**.

For each parent interface:

1. Explain the interface's single purpose in plain language.
2. Review every property individually.
3. For each property, answer where relevant:
   - Why does it exist?
   - Who provides it?
   - Who consumes it?
   - Is it required or optional?
   - What is the default/fallback?
   - Is a short example useful?
4. Challenge whether the property/interface is needed at all.
5. Mark the decision as Finalized, Deferred, or Rejected.
6. Only then move to the next small group.

Do not dump the complete schema at once.

## Documentation and code quality requirement

When interfaces are eventually implemented:

- Public configuration interfaces and non-obvious properties must have useful JSDoc so VS Code hover explains their purpose.
- Avoid comments that merely repeat the property name.
- Important distinctions, ownership boundaries, defaults/fallbacks, or dangerous assumptions should receive richer comments and examples where useful.
- A central configuration reference document should explain the full public configuration model interface-by-interface.
- JSDoc should be the concise developer-hover view; reference documentation should provide the deeper explanation. Avoid maintaining two identical walls of text.

Example of the desired JSDoc quality:

```ts
/**
 * Stable business entity represented by this feature configuration.
 *
 * Identifies the data context, such as `loan` or `finance`.
 * It does not select an API endpoint; API behavior is resolved separately
 * through the configured data adapter.
 */
entityKey: EntityKey;
```

## Confirmed architectural framing

The configurable unit is a **business feature/page plus an entity context**, not merely a generic grid.

Examples:

```text
Review + Loan
Review + Finance

Future example:
Correction + Loan
Correction + Finance
```

`Review` is the feature. `Loan` and `Finance` are entity/data contexts.

The same entity may participate in multiple features with different fields, actions, validation, access, and page behavior.

Configuration must remain JSON-safe. Executable behavior stays in bounded frontend code/registries/adapters. The initial proof remains SSRM-first and must not refactor the existing Client, Infinite, or SSRM Transaction grids.

## Interface review 1: `FeatureDefinition`

### Purpose

`FeatureDefinition` identifies **which business feature is being configured**.

Current minimal conceptual shape under discussion:

```ts
interface FeatureDefinition {
  featureKey: FeatureKey;
  supportedEntities: EntityKey[];
}
```

The shape is intentionally minimal. Earlier ideas such as title, route, page definition, versions, actions, and other configuration have **not** been assigned to this interface yet. We will place them only after reviewing the relevant concepts.

### `featureKey`

Example:

```ts
featureKey: "review"
```

Purpose:

- Identifies the business feature/capability.
- Does not identify the entity.
- Does not select the backend endpoint or data adapter.

Example distinction:

```text
review   -> feature
loan     -> entity
finance  -> entity
```

**Decision: Finalized — keep `featureKey`.**

### `supportedEntities`

Example:

```ts
supportedEntities: ["loan", "finance"]
```

Potential purpose:

- Declares which entity/data contexts the feature supports in principle.
- Does not mean the current user is authorized for every listed entity.
- Does not mean the current page/session is currently using every listed entity.

Those are separate concepts:

```text
Feature supports: Loan + Finance
User may access: Loan only
Current context: Loan
```

However, this property may become duplicate information if `FeatureDefinition` later contains entity definitions keyed by entity, for example:

```ts
entities: {
  loan: ...,
  finance: ...,
}
```

In that design, supported entities could be inferred from the entity-definition keys.

**Decision: Deferred — do not finalize `supportedEntities` until `EntityDefinition` is designed.**

## Important terminology separation already agreed

Do not collapse these concepts:

```text
Feature identity
Entity identity/context
Resolved user access/authorization
Current session/entity choice
User Grid State/preferences
Runtime row/grid state
Datasource/service adapter identity
```

For example, `entityKey: "loan"` should identify the Loan business/data context. A separate adapter/data-source key may later identify the executable frontend adapter used to load/save Loan data. Whether that separate key is needed and exactly where it belongs still needs interface-by-interface review.

## Current status

### Finalized

- Discussion proceeds parent interface first, then child interfaces/properties.
- Every property is explained and challenged before acceptance.
- Configuration APIs will receive useful JSDoc and separate reference documentation.
- `FeatureDefinition.featureKey` is required.
- Feature identity and entity identity are separate concepts.

### Deferred / not yet finalized

- `FeatureDefinition.supportedEntities`.
- Exact `EntityDefinition` shape.
- Datasource/data-adapter keys and placement.
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

None of the deferred items should be assumed from earlier chat examples; they must be reviewed one by one.

## Exact resume point

**Next interface to discuss: `EntityDefinition`.**

Start by explaining only its purpose in plain language and then propose the smallest useful shape.

The first question it must answer is the user's original concern:

> How do we explicitly say that this Review feature is operating on Loan data versus Finance data?

While reviewing `EntityDefinition`, also decide whether `FeatureDefinition.supportedEntities` is useful or redundant.

Do not jump ahead into field definitions, renderers, editors, mappers, routing, masking, Grid State, or the rest of the schema until this interface is understood and reviewed.