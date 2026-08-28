# Selection, editing totals, export, and verification

The original combined guide has been split into capability-specific documents so developers can find the behavior they need without scanning one large file.

Use these source-of-truth guides:

- [Selected-row totals](selection-counts.md) — manual/current-page counts, All Filtered/All Records formulas, Infinite versus SSRM selection ownership, API `totalCount` / `filteredCount`, out-of-order response protection, current eligibility limitation, and future eligibility-aware counts.
- [Edited-row total](edited-row-count.md) — dirty-row semantics, tracked-edit ownership, selected-dirty subset, and when the count increases/decreases.
- [Grid export](grid-export.md) — why export exists, native Current Page CSV, backend Selected export, common logical selection target, shared backend resolver, and future export decisions.
- [Pre-Client manual testing](pre-client-manual-testing.md) — browser verification for Infinite and SSRM, including selection counts, edited totals, exports, eligibility, response ordering, and existing edit/conflict regression.

The split is intentional: this repository is meant to be a reusable implementation reference, so feature behavior, design rationale, future options, and manual verification should be discoverable by name rather than remembered from chat history.
