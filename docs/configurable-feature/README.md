# Configurable Feature Documentation

This directory is the library-style documentation home for the configurable feature/grid configuration model.

It is written so developers, reviewers, architects, and readers without the TypeScript source open can understand the public configuration model.

## Start here

- [`concepts.md`](concepts.md) — plain-language meanings, normalization boundary and AG Grid native-first rules.
- [`configuration-reference.md`](configuration-reference.md) — current public interfaces, native GridOptions/ColDef surface, constraints and compiler expectations.
- [`type-hierarchy.md`](type-hierarchy.md) — portable text relationship map, supplemental Mermaid view, AG Grid mappings and compiler/runtime boundaries.
- [`documentation-standard.md`](documentation-standard.md) — required quality standard for JSDoc/IDE hover, curated docs and generated API/type documentation.
- [`Generated TypeDoc API`](generated/README.md) — source-generated interface/type documentation. **Regenerate after the current public-contract changes before treating these generated pages as current.**

## New-chat continuation

For ongoing design work, read these after repository root `AGENTS.md` and current GitHub state:

- `../configurable-feature-handoff.md` — current consolidated architecture handoff, including the merged PR #42 native-first editing reference;
- `../configurable-feature-config-design-progress.md` — latest decisions, current branch checkpoint and exact resume point.

Repository/source/docs are authoritative. Do not depend on chat memory when repository inspection can provide current truth.

## Related planning

- `../grid-backlog.md` — broader repository planning and sequencing.

## Documentation contract

The TypeScript source provides useful JSDoc for IDE hover. These Markdown documents provide deeper explanation for readers who may not have source access.

A non-obvious property must explain its real responsibility, its AG Grid relationship where applicable, and any normalization/registry/runtime boundary that matters. Keep source JSDoc and the public configuration reference synchronized.

The normalization boundary exists even when backend/storage property names currently match the normalized frontend/AG Grid-aligned names. Raw backend runtime data is still validated/normalized before compilation. If backend names differ later, map them once at that boundary; the normalized compiler contract stays stable.

## Generated TypeDoc API

TypeDoc and `typedoc-plugin-markdown` are installed as development dependencies. Configuration lives in repository-root `typedoc.json`.

Generate the API reference with:

```bash
npm run docs:configurable
```

The command reads:

```text
frontend/src/shared/grid/configurable/configuration.types.ts
```

and writes GitHub-readable Markdown under:

```text
docs/configurable-feature/generated/
```

Open [`generated/README.md`](generated/README.md) to browse the generated API landing page. From there, click an interface/type such as `FieldDefinition`, `EntityDefinition`, or `FeatureDefinition` to open its generated JSDoc/type page.

Generated Markdown is a checked-in documentation artifact. Whenever the public configurable TypeScript contract or its JSDoc changes, regenerate it, review the diff, and commit the generated output with the related source/docs change. Do not treat previously generated pages as current after source changes until regeneration has been run.

The generated API pages supplement, not replace, the curated `concepts.md`, `configuration-reference.md` and `type-hierarchy.md`. The text hierarchy is the portable relationship view; Mermaid is only a supplemental renderer-dependent view.
