# Configurable Feature Documentation

This directory is the library-style documentation home for the configurable feature/grid configuration model.

It is written so developers, reviewers, architects, and readers without the TypeScript source open can understand the public configuration model.

## Start here

- [`concepts.md`](concepts.md) — plain-language meaning of the main configuration concepts.
- [`configuration-reference.md`](configuration-reference.md) — agreed public interfaces and property semantics.

## Related design documents

- `../configurable-feature-handoff.md` — primary architecture/design context.
- `../configurable-feature-config-design-progress.md` — living design status, provisional decisions, and exact resume point.
- `../grid-backlog.md` — broader repository planning and sequencing.

## Documentation contract

The source code provides concise JSDoc for IDE hover. These Markdown documents provide the deeper library-style explanation.

Split documentation by coherent topic as the public surface grows. Do not create one oversized document or one file per small interface by default.