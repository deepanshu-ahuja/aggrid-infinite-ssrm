# Configurable Contract Documentation Standard

This document defines the documentation quality required for the configurable feature/grid public API.

The goal is that a developer can understand the configuration model in complementary ways:

1. hover the TypeScript interface/property in an IDE and get a useful explanation immediately;
2. read the curated Markdown reference without needing the source file or prior chat/design history;
3. use the visible hierarchy/flow documentation to understand ownership and AG Grid mapping quickly;
4. use generated API documentation from the TypeScript source once the generator is wired into the repository.

## JSDoc / IDE hover standard

Every public configuration interface and property must be documented at the level needed to understand its real contract.

For an obvious property, a short explanation is enough. For a non-obvious property, the hover documentation must explain the responsibility rather than merely restating the name.

A useful property comment should answer the relevant questions from this set:

- What value does this property identify or configure?
- What behavior or responsibility does it select/control?
- Is it a native AG Grid concept, a configurable registry descriptor, or our own application concept?
- If it maps to AG Grid, what exact `GridOptions` / `ColDef` / callback / component property is involved?
- What runtime params does AG Grid already provide?
- What extra declarative configuration, if any, does our config provide?
- What important constraint is part of the contract?
- Would a short example materially improve understanding?

Do not add sentences only to make a comment longer. Do not describe speculative future behavior as if it exists. Do not fill hover documentation with comparisons to concepts that are not part of the property.

### AG Grid naming/type rule

When our property represents the same concept with the same semantics as AG Grid, prefer the AG Grid name and derive/reuse the AG Grid TypeScript type where practical.

For example, prefer deriving a type from `ColDef['initialPinned']` or `GridOptions<TData>['onCellClicked']` over creating an equivalent home-grown union/signature unless our public contract intentionally narrows or changes the semantics.

When a persisted key resolves executable behavior, the registry implementation should still use the real AG Grid callback/component/property type where practical.

### Example: non-obvious application property

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

This is better than a comment that only says the value is an adapter key, because the hover also explains what the adapter owns.

## Library-style reference standard

The Markdown configuration reference is not a copy of the TypeScript declarations. It must explain the public API so a reader can understand it without opening source code.

For each interface, document:

- its purpose;
- its current shape;
- where it sits in the parent/child configuration relationship when useful;
- its normalization/compiler/AG Grid relationship when non-obvious.

For each property, document the relevant parts of:

- type;
- whether it is required;
- purpose/responsibility;
- AG Grid mapping where applicable;
- how the value is interpreted or resolved;
- important constraints/defaults/fallbacks;
- example when useful.

Do not force every heading into the same template when a field is trivial, but do not leave a non-obvious field with only a one-line definition.

## Visible hierarchy documentation

`type-hierarchy.md` is the curated architecture/type map.

Keep both:

- a portable text/ASCII hierarchy that remains readable in raw Markdown and ordinary editors;
- a Mermaid diagram when it materially improves GitHub/browser readability.

The Mermaid view is supplemental. Do not make the documentation understandable only when Mermaid rendering is available.

The curated hierarchy should explain more than TypeScript inheritance. It should show important ownership and compiler relationships such as:

```text
backend/storage representation
→ normalization
→ normalized frontend config
→ registry/compiler
→ AG Grid
```

and native-vs-custom mappings such as renderer key → registry → `cellRenderer`.

## Generated API documentation

Generated API documentation is an additional layer, not a replacement for JSDoc or curated Markdown.

Current tooling direction:

- **TypeDoc** for source-derived TypeScript API documentation;
- **typedoc-plugin-markdown** (or a compatible Markdown renderer) so generated API output can be browsed directly in the repository/GitHub rather than requiring a hosted HTML site;
- keep generated output separate from curated explanatory docs so regeneration never overwrites human architecture guidance.

When the tooling is added:

- add packages as normal dev dependencies;
- update `package-lock.json` through npm at the same time; do not hand-edit the dependency lockfile;
- add a deterministic npm script/configuration for regeneration;
- regenerate the output as part of public contract changes when generated docs are committed;
- ensure generated output reflects the real TypeScript architecture rather than changing architecture to make a generator prettier.

If a generated relationship/diagram tool is later useful, choose one that is actively compatible with the repository's TypeScript version and real interface/type structure. Do not commit to a stale diagram package merely because it was named in an earlier proposal.

## Normalization documentation rule

The normalization/adaptation boundary is part of the architecture even when backend/storage keys currently match the frontend/AG Grid-aligned names.

Matching names may make normalization an identity-like transform, but raw backend/runtime data still goes through validation/normalization before it becomes normalized frontend configuration.

Docs must not imply that backend JSON is spread directly into `AgGridReact`.

## Keep source and reference synchronized

When a public configuration contract changes:

1. update the TypeScript interface/type;
2. update its JSDoc/hover documentation;
3. update `configuration-reference.md`;
4. update `concepts.md` when a public concept needs plain-language explanation;
5. update `type-hierarchy.md` when type/ownership/mapping structure changes;
6. update the design-progress handoff when the change finalizes, rejects, defers, or preserves a decision for later;
7. once generated docs exist, regenerate/update them in the same contract change.

A documented option must correspond to the actual current public contract. Provisional design remains in the design-progress document until it is finalized.
