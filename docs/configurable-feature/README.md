# Configurable Feature Documentation

This directory is the library-style documentation home for the configurable feature/grid configuration model.

It is written so developers, reviewers, architects, and readers without the TypeScript source open can understand the public configuration model.

## Start here

- [`concepts.md`](concepts.md) — plain-language meanings, normalization boundary and AG Grid alignment rules.
- [`configuration-reference.md`](configuration-reference.md) — current public interfaces, property semantics, constraints and compiler expectations.
- [`type-hierarchy.md`](type-hierarchy.md) — quick visual type tree, **GitHub-rendered Mermaid diagram**, AG Grid mappings, configuration flow and registry/runtime classification.
- [`documentation-standard.md`](documentation-standard.md) — required quality standard for JSDoc/IDE hover, curated docs and generated API/type documentation.

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

## Generated docs status

A visible relationship diagram already exists in `type-hierarchy.md` using Mermaid plus a portable text fallback.

The planned generated API-doc tooling is **TypeDoc + Markdown output** so generated API pages can be browsed directly in GitHub. It is **not installed yet** on this branch. When added, `package.json` and `package-lock.json` must be updated together through npm; do not hand-edit the dependency lockfile.

Generated docs will supplement, not replace, the curated architecture/reference documents.
