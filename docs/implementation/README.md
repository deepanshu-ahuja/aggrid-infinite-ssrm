# Current Grid Implementation Documentation

This directory documents **behavior implemented by the repository now**.

The contract for this directory is strict:

> If a document says a runtime capability, option, configuration, API, state transition, or row-model behavior exists, the current code must support it.

Do not use these documents as a conversation log, rejected-design history, or roadmap. Planned work belongs in `docs/grid-backlog.md`. Target/exploratory configurable-table design belongs in the clearly marked architecture proposal documents outside this directory.

## Read by row model

If you want to understand only one AG Grid row model, start here:

- [Client-Side Row Model](row-models/client.md)
- [Infinite Row Model](row-models/infinite.md)
- [Server-Side Row Model (SSRM)](row-models/ssrm.md)

The row-model guides explain row-model-specific loading, selection, refresh/retry, export, editing integration, Grid State ownership, and the relevant implementation entry points. They link to shared capability documents instead of duplicating whole capability explanations.

## Read by capability

Use these when you are interested in one capability across the supported row models:

- [Grid capability catalog](grid-capabilities.md)
- [Capability tag registry](grid-capability-tags.md)
- [AG Grid native usage](ag-grid-native-usage.md)
- [AG Grid architecture](ag-grid.md)
- [API and data flow](api-data-flow.md)
- [Selected-row totals](selection-counts.md)
- [Selected business-action lifecycle](selected-action-selection-lifecycle.md)
- [Transaction editing](transaction-editing.md)
- [Edit conflict reconciliation](edit-conflict-reconciliation.md)
- [Edited-row total](edited-row-count.md)
- [Grid export](grid-export.md)
- [Row interaction](row-interaction.md)
- [Reusable server-backed grid guide](server-backed-grid-reuse.md)
- [Theme integration](theming.md)
- [Foundation status](ag-grid-foundation-status.md)
- [Application architecture](architecture.md)

## Manual verification

- [Server-backed Infinite + SSRM manual regression](testing/server-backed-manual-testing.md)
- [Row interaction manual verification](testing/row-interaction-manual-testing.md)

Manual verification documents describe scenarios to run; they must never claim a browser pass was completed unless it actually was.

## Documentation maintenance rule

When implementation changes:

1. update code and tests first-class with the capability;
2. update the relevant implementation document(s) in this directory;
3. update the relevant row-model guide when ownership/behavior differs by Client, Infinite, or SSRM;
4. update `grid-capability-tags.md` when the frontend capability footprint changes;
5. update `README.md` / `AGENTS.md` when entry points or durable rules change;
6. keep future-only design in backlog/proposal documents rather than mixing it into current implementation documentation.

Cross-row-model capability docs may describe all three implementations in one document when the user-facing capability is shared, but they must explicitly call out meaningful Client/Infinite/SSRM differences. Do not create three duplicate copies of a shared capability merely for folder symmetry.
