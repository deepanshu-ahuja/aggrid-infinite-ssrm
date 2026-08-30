# Configurable Feature Documentation

This directory is the library-style documentation home for the configurable feature/grid configuration model.

It is written so developers, reviewers, architects, and readers without the TypeScript source open can understand the public configuration model.

## Start here

- [`concepts.md`](concepts.md) — plain-language meanings, normalization boundary and AG Grid alignment rules.
- [`configuration-reference.md`](configuration-reference.md) — current public interfaces, property semantics, constraints and compiler expectations.
- [`type-hierarchy.md`](type-hierarchy.md) — quick visual type tree, AG Grid mappings, configuration flow and registry/runtime classification.
- [`documentation-standard.md`](documentation-standard.md) — required quality standard for JSDoc/IDE hover, curated docs and future generated API/type documentation.

## New-chat continuation

For ongoing design work, read these after the repository root `AGENTS.md` and current GitHub state:

- `../configurable-feature-handoff.md` — primary architecture/background;
- `../configurable-feature-config-design-progress.md` — **latest decisions, current branch checkpoint and exact resume point**. When an older illustrative name in the handoff differs from the progress/reference/source, the newer progress/reference/source wins.

## Related planning

- `../grid-backlog.md` — broader repository planning and sequencing.

## Documentation contract

The TypeScript source provides useful JSDoc for IDE hover. These Markdown documents provide deeper explanation for readers who may not have source access.

A non-obvious property must explain its real responsibility, its AG Grid relationship where applicable, and any normalization/registry/runtime boundary that matters. Keep source JSDoc and the public configuration reference synchronized.

Generated TypeDoc/type-relationship documentation is planned as an additional layer, not a replacement for these curated documents. The generated artifacts should follow the real TypeScript architecture rather than forcing the architecture to suit a diagramming tool.
