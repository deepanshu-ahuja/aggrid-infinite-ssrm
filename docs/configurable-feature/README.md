# Configurable Feature Documentation

This directory is the library-style documentation home for the configurable feature/grid configuration model.

It is written to be useful without requiring the reader to inspect TypeScript source or reconstruct design decisions from pull requests or chat history.

## Start here

- [`configuration-reference.md`](configuration-reference.md) — public configuration contracts and property semantics that have been agreed so far.

## Related design documents

- `../configurable-feature-handoff.md` — primary architecture/design context for the configurable feature effort.
- `../configurable-feature-config-design-progress.md` — living interface-by-interface design status and exact resume point.
- `../grid-backlog.md` — broader repository planning and sequencing.

## Documentation contract

As the public configuration surface grows, documentation should be split by coherent topic rather than accumulated in one oversized file. Likely future topics include access/security, adapters/mapping, fields/editing, and worked examples, but those documents should be created only when their contracts are actually agreed.

The source code will provide concise JSDoc for IDE hover. These Markdown documents provide the deeper reference for developers, reviewers, architects, and readers who may not have the source open.