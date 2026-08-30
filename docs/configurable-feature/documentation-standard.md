# Configurable Contract Documentation Standard

This document defines the documentation quality required for the configurable feature/grid public API.

The goal is that a developer can understand a configuration interface in multiple complementary ways:

1. hover the TypeScript interface/property in an IDE and get a useful explanation immediately;
2. read the library-style Markdown reference without needing the source file or prior chat/design history;
3. once the contract tree is large enough, use generated searchable API/type documentation and a generated visual relationship hierarchy derived from the TypeScript source.

## JSDoc / IDE hover standard

Every public configuration interface and property must be documented at the level needed to understand its real contract.

For an obvious property, a short explanation is enough. For a non-obvious property, the hover documentation must explain the responsibility rather than merely restating the name.

A useful property comment should answer the relevant questions from this set:

- What value does this property identify or configure?
- What behavior or responsibility does it select/control?
- How is the value interpreted by the configurable feature infrastructure?
- What important constraint is part of the contract?
- Would a short example materially improve understanding?

Do not add sentences only to make a comment longer. Do not describe speculative future behavior. Do not fill hover documentation with comparisons to concepts that are not part of the property.

### Example: non-obvious property

Preferred:

```ts
/**
 * Key of the registered frontend data adapter used for this entity's
 * data operations.
 *
 * The resolved adapter provides the feature/entity-specific boundary
 * for loading rows, saving changes, and mapping grid requests and API
 * responses to the backend contract.
 *
 * @example
 * "reviewLoan"
 */
dataAdapterKey: string;
```

This is better than a comment that only says that the value is an adapter key, because the hover also explains what the adapter is responsible for.

### Example: simple property

A simple property should stay concise when its meaning is already clear:

```ts
/**
 * Stable programmatic identifier for the feature.
 *
 * @example
 * "review"
 */
featureKey: TFeatureKey;
```

## Library-style reference standard

The Markdown configuration reference is not a copy of the TypeScript declarations. It must explain the public API so that a reader can understand it without opening source code.

For each interface, document:

- its purpose;
- its current shape;
- where it sits in the parent/child configuration relationship when useful.

For each property, document the relevant parts of:

- type;
- whether it is required;
- purpose/responsibility;
- how the value is interpreted or resolved;
- important constraints/defaults/fallbacks;
- example when useful.

Do not force every heading into the same template when a field is trivial, but do not leave a non-obvious field with only a one-line definition.

## Generated API and hierarchy documentation

Generated documentation is an additional layer, not a replacement for JSDoc or the curated Markdown reference.

Once the configuration contract tree is substantial enough to benefit from it:

- use **TypeDoc** or an equivalent TypeScript API-documentation generator for searchable generated interface/type documentation and hierarchy navigation;
- use **TsUML2 or an equivalent TypeScript relationship-diagram generator** to generate an SVG/visual representation of interface composition and relationships;
- generate these artifacts from the TypeScript source as much as practical so they stay synchronized with the real public contract;
- expose the relationship hierarchy alongside the detailed interface/reference content where the documentation UI supports a useful side-by-side layout;
- keep a generated/maintained hierarchy artifact under the configurable-feature documentation once the tooling is introduced.

The TypeScript architecture must never be changed merely to make a documentation/diagram tool produce prettier output. If a tool cannot represent the real relationships accurately, change or supplement the tool instead.

## Keep source and reference synchronized

When a public configuration contract changes:

1. update the TypeScript interface/type;
2. update its JSDoc/hover documentation;
3. update `configuration-reference.md`;
4. update `concepts.md` when a new public concept needs a plain-language explanation;
5. update the design-progress handoff when the change finalizes, rejects, defers, or preserves a decision for later;
6. once generated docs/diagrams exist, regenerate or update them as part of the same contract change.

A documented option must correspond to the actual current public contract. Provisional design remains in the design-progress document until it is finalized.