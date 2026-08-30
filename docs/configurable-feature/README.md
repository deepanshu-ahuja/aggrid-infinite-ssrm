# Configurable Feature Documentation

This directory is the library-style documentation home for the configurable feature/grid configuration model.

It is written so developers, reviewers, architects, and readers without the TypeScript source open can understand the public configuration model.

## Start here

- [`concepts.md`](concepts.md) — plain-language meanings, normalization boundary and AG Grid alignment rules.
- [`configuration-reference.md`](configuration-reference.md) — current public interfaces, property semantics, constraints and compiler expectations.
- [`type-hierarchy.md`](type-hierarchy.md) — quick visual type tree, **GitHub-rendered Mermaid diagram**, AG Grid mappings, configuration flow and registry/runtime classification.
- [`documentation-standard.md`](documentation-standard.md) — required quality standard for JSDoc/IDE hover, curated docs and generated API/type documentation.
- `generated/` — TypeDoc-generated Markdown API pages after `npm run docs:configurable` has been run and the generated output committed.

## New-chat continuation

For ongoing design work, read these after repository root `AGENTS.md` and current GitHub state:

- `../configurable-feature-handoff.md` — current consolidated architecture handoff through the **Chat 5** checkpoint;
- `../configurable-feature-config-design-progress.md` — **latest decisions, current branch checkpoint and exact resume point**.

Repository/source/docs are authoritative. A chat name is only a convenient reference; do not depend on chat memory when repository inspection can provide current truth.

## Related planning

- `../grid-backlog.md` — broader repository planning and sequencing.

## Documentation contract

The TypeScript source provides useful JSDoc for IDE hover. These Markdown documents provide deeper explanation for readers who may not have source access.

A non-obvious property must explain its real responsibility, its AG Grid relationship where applicable, and any normalization/registry/runtime boundary that matters. Keep source JSDoc and the public configuration reference synchronized.

The normalization boundary exists even when backend/storage property names currently match the normalized frontend/AG Grid-aligned names. Raw backend runtime data is still validated/normalized before compilation.

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

Generated Markdown is a checked-in documentation artifact. When the public configurable TypeScript contract changes, regenerate it, review the diff, and commit the generated output with the related source/docs change.

The generated API pages supplement, not replace, the curated `concepts.md`, `configuration-reference.md` and `type-hierarchy.md`. The Mermaid relationship diagram remains the concise visual architecture view while TypeDoc provides source-derived API navigation and JSDoc details.
