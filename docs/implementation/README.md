# Current Grid Implementation Documentation

This directory documents **behavior implemented by the repository now**.

The contract is strict:

> If a document says a runtime capability, option, configuration, API, state transition, or row-model behavior exists, the current code must support it.

These documents are written as standalone implementation references. They should explain the capability itself: behavior, ownership, row-model differences, current limits, implementation entry points, and verification. They should not depend on project backlog, proposal documents, chat history, PR history, or other planning artifacts in order to make sense.

Current limitations are appropriate when they state what the implementation does or does not support today. Do not add speculative solutions for unimplemented requirements to this directory.

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
- [Grid validation](grid-validation.md)
- [Edit conflict reconciliation](edit-conflict-reconciliation.md)
- [Edited-row total](edited-row-count.md)
- [Transaction Import](grid-import.md)
- [Grid export](grid-export.md)
- [Row interaction](row-interaction.md)
- [Configurable SSRM experiment](configurable-ssrm-experiment.md)
- [Reusable server-backed grid guide](server-backed-grid-reuse.md)
- [Theme integration](theming.md)
- [Foundation status](ag-grid-foundation-status.md)
- [Application architecture](architecture.md)

## Verification

Browser/manual verification material lives under `docs/implementation/testing/`:

- [Browser regression architecture](testing/browser-regression.md) — TypeScript Playwright flow, per-test data reset/isolation, selector/readiness rules, CI diagnostics, future E2E database/auth boundary, and local execution.
- [Regression coverage matrix](testing/coverage-matrix.html) — readable HTML inventory of focused frontend/backend tests and Client/Infinite/SSRM Playwright coverage. Open the file locally in a browser for the intended styled table view.
- [Grid validation manual regression](testing/validation-manual-testing.md)
- [Transaction Import manual verification](testing/import-manual-testing.md)
- [Server-backed Infinite + SSRM manual regression](testing/server-backed-manual-testing.md)
- [Row interaction manual verification](testing/row-interaction-manual-testing.md)
- [Configurable SSRM manual verification](testing/configurable-ssrm-manual-testing.md)

Browser-visible or AG Grid lifecycle work must add/update concrete manual steps in the same change. Automated Playwright coverage should be added for high-value integration contracts where the real grid/backend/browser combination can expose failures that unit/component tests cannot.

Manual verification documents describe scenarios to run; they must never claim a browser pass was completed unless it actually was. A narrower Playwright pass must not be presented as proof that every item in a broader manual checklist was exercised.

## Documentation maintenance rule

When implementation changes:

1. update code and focused tests with the capability;
2. update the relevant implementation document(s) in this directory;
3. update the relevant row-model guide when ownership/behavior differs by Client, Infinite, or SSRM;
4. update `grid-capability-tags.md` when the frontend capability footprint changes;
5. update repository entry points such as `README.md` / `AGENTS.md` when navigation or durable rules change;
6. add/update manual verification steps for browser-visible or AG Grid lifecycle behavior;
7. update the regression coverage matrix when the applicable automated/manual coverage changes;
8. keep unimplemented design out of current implementation documents.

When ownership, call flow, lifecycle, or state transitions are easier to understand visually, add a small diagram to the relevant implementation document. **Portable plain-text/ASCII diagrams are the default** because they remain readable in raw Markdown, GitHub, IDE previews, and local viewers. Do not rely on Mermaid-only diagrams unless the repository explicitly guarantees Mermaid rendering for the intended reader.

Do not add diagrams merely for decoration. Use them where they reduce the effort needed to understand which layer calls which layer, who owns state, or how a lifecycle/state transition works.

Cross-row-model capability docs may describe all three implementations in one document when the user-facing capability is shared, but they must explicitly call out meaningful Client/Infinite/SSRM differences. Do not create three duplicate copies of a shared capability merely for folder symmetry.

When documentation is moved, update live references to the canonical location and remove the obsolete file. Do not keep placeholder "Moved" documents by default; retain an old path only when there is an explicit external compatibility requirement.
