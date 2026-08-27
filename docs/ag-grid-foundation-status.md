# AG Grid Foundation Status

This document records what the project has already established around AG Grid, what remains important, and what should stay future work.

For implementation guidance when adding another table, see `docs/server-backed-grid-reuse.md`. Row eligibility/read-only behavior is documented in `docs/row-interaction.md`. Detailed row-model selection scenarios remain in the Infinite and SSRM selection-contract documents.

## Goal

Build a reusable React + TypeScript AG Grid foundation for server-backed application tables without creating an application-specific grid framework that hides AG Grid.

The operating rules are:

> Use native AG Grid behavior and APIs first.

> Keep Infinite and SSRM separate where their native lifecycles differ.

> Share domain-neutral table capabilities; keep fields, business actions, validation and API semantics inside the feature.

## Completed foundation

### Application bootstrap

- AG Grid Enterprise license initialization is centralized.
- Required AG Grid modules are registered centrally through `AgGridProvider`.
- Application-wide theme/default-column configuration uses native AG Grid setup.
- Feature grids render `AgGridReact` directly; there is no forwarding-only grid wrapper.

### Shared server-backed defaults

Shared native GridOptions cover common pagination/cache behavior:

- pagination enabled;
- 25-row default page size;
- page-size choices 10 / 25 / 50;
- 50-row datasource blocks;
- maximum five cached blocks;
- 120 ms block-load debounce;
- one concurrent datasource request.

These are defaults, not fixed business rules. A feature may override an individual value for a measured reason.

### Native Grid State persistence

User table preferences use AG Grid's native `GridState` instead of a parallel application representation.

The shared persistence boundary currently retains:

- column order;
- column pinning;
- column widths;
- column visibility;
- filter state;
- sort state.

Infinite and SSRM use separate state keys. Pagination position and row selection are deliberately not persisted as durable preferences.

The current storage implementation is browser-backed behind `GridStateStore`, so a future user/profile API can replace storage without changing grid lifecycle ownership.

### Infinite Row Model

The Infinite implementation covers:

- reusable datasource/loading lifecycle;
- backend sorting/filtering through the feature mapper;
- stable backend row identity;
- pagination and bounded cache behavior;
- load-error retry;
- native page/manual selection;
- custom Select All Filtered / Select All Records semantics for unloaded rows;
- include/exclude logical selection;
- selection restoration as blocks materialise/reload;
- explicit selection persistence across filter changes;
- filtered-wide selection invalidation when the defining filter changes;
- all-record selection surviving visible filter changes;
- backend-authoritative refresh through `refreshInfiniteCache()` after successful writes.

With `maxBlocksInCache: 5`, post-write refresh re-queries currently resident Infinite blocks only. Evicted/unloaded blocks are fetched fresh later when needed; cache residency never defines the business-action target.

### SSRM

The SSRM implementation covers:

- reusable flat SSRM datasource/loading lifecycle;
- backend sorting/filtering through the same feature mapper;
- stable backend row identity;
- native explicit and All Records server-side selection;
- explicit Current Page selection;
- custom Select All Filtered behavior where required by the product semantics;
- filtered custom selection invalidation on filter change;
- native All Records / explicit selection surviving visible filter changes;
- load retry and backend-authoritative `refreshServerSide()` after successful writes.

Infinite and SSRM intentionally do not share one selection controller. They share semantic helpers only where the meaning is genuinely common.

### Generic selection-action target

Logical selection is shared and compact:

```ts
{
  mode: 'include' | 'exclude',
  ids: string[],
}
```

The backend wire contract intentionally does **not** serialize `scope`.

```text
include + ids
-> exactly those ids

exclude + translated filters
-> filtered rows minus exception ids

exclude without filters
-> all records minus exception ids
```

The frontend still uses internal row-model context while constructing an exclude request, because Infinite and SSRM reach filtered/all selection differently. That context is not duplicated in the final payload.

The generic frontend builder is `buildGridSelectionActionTarget(...)`.

Transactions adds only its feature filter translation and business `changes` payload through `buildTransactionSelectionActionRequest(...)`.

### Selection-based server actions

Transactions currently exposes action UI above both grids for status updates.

The action path is:

```text
logical selection
-> shared target construction
-> Transactions filter translation/business payload
-> PATCH /api/transactions/selection/
-> backend update
-> row-model-specific native refresh
```

The backend handles explicit IDs, filtered exclude, and all-record exclude without enumerating unloaded rows in the browser.

### Row interaction eligibility

Server-backed rows now use one domain-neutral interaction capability with three states:

```text
enabled
-> selectable and editable

selectionDisabled
-> not selectable / not part of selection-based bulk actions
-> still editable and usable for row-level modifying actions

readOnly
-> not selectable / not part of selection-based bulk actions
-> not editable
-> no modifying row-level actions
```

The feature/backend decides why a row has one of these states. Shared grid code understands only the resulting capability.

Loaded rows use AG Grid's native `rowSelection.isRowSelectable` callback. Infinite and SSRM current-page/custom selection paths also avoid passing disabled `RowNode`s into selection APIs. Disabled row IDs are never manufactured as logical `exclude` exceptions.

The backend independently applies the same eligibility when resolving selection actions, so disabled rows that were never loaded in the browser are skipped as well. The compact `include` / `exclude` wire contract is unchanged.

For editing, `selectionDisabled` remains editable. `readOnly` uses native AG Grid `editable` callbacks and the shared tracked-edit engine receives the same row-editability predicate so programmatic current-page edits/restoration cannot bypass the UI rule. Backend detail/bulk persistence also rejects read-only targets.

See `docs/row-interaction.md` for the complete reusable contract.

### Editing

Tracked edits are keyed by stable backend row ID so unsaved changes can survive RowNode recreation/cache churn.

Current behavior includes:

- direct edit tracking after AG Grid commits `cellValueChanged`;
- Escape cancellation creating no draft;
- latest-edit and explicit bulk apply flows;
- row Save/Discard;
- aggregate Save/Discard over `dirty ∩ logical selection`;
- restoration of unsaved drafts after server-backed rows reload when the row remains editable;
- idempotent Discard behavior.

### Documentation

The reusable foundation now has:

- `docs/server-backed-grid-reuse.md` — simple “how to use this for another table” guide;
- `docs/row-interaction.md` — selection-disabled/read-only frontend + backend contract;
- `docs/ag-grid.md` — detailed architecture/ownership;
- `frontend/src/infinite-selection-contract.md` — Infinite selection scenarios;
- `frontend/src/ssrm-selection-contract.md` — SSRM selection scenarios;
- `docs/transaction-editing.md` — editing behavior;
- `docs/api-data-flow.md` — backend query/action flow.

## Important remaining work

These are the items worth resolving before calling the current grid foundation fully settled.

### 1. Run the complete executable validation

The branch still needs local executable validation after the latest row-interaction changes:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
source .venv/bin/activate
python backend/manage.py test apps.transactions
```

Do not claim the foundation green until those commands pass.

### 2. Remove the temporary selection console log

The Infinite header still contains the temporary console diagnostic requested during include/exclude inspection. Remove it once manual debugging is complete so production code returns to the normal no-console state.

### 3. Decide the product rule for server actions versus unsaved drafts

This is the most important unresolved interaction.

Example:

```text
row has an unsaved local status edit
-> user runs a server selection action that also changes status
-> backend succeeds
-> row model refreshes
-> tracked-edit restoration can reapply the local unsaved value over the fresh backend row
```

That may be a valid “draft overlays server state” rule, but it can also allow a later Save to overwrite the server action. We need an explicit product decision for conflicts such as:

- preserve the draft and warn/allow later overwrite;
- clear/acknowledge affected draft fields after the action;
- block the action when selected rows have conflicting drafts;
- another deliberate conflict policy.

Do not silently choose this rule inside generic grid code.

### 4. Confirm post-action selection UX

Selection currently remains after a successful server action. Confirm whether product UX wants to:

- preserve selection;
- clear selection;
- clear only for some actions.

This should be an action/product choice, not a hidden shared-grid default.

### 5. Manual row-model scenario pass

Automated tests cover the contracts, but a short manual pass should still verify the user-visible combinations independently for Infinite and SSRM:

- explicit rows across pages;
- explicit rows accumulated across different filters;
- Select All Filtered plus exceptions;
- Select All Records plus exceptions;
- filter changes after explicit selection;
- filter changes after filtered-wide selection;
- selection-disabled rows stay unchecked/disabled for manual, Current Page, Filtered and All flows;
- read-only rows are not selectable/editable and show the read-only presentation;
- selection-disabled rows remain editable;
- action success followed by navigation into previously unloaded/evicted data;
- dirty edits combined with the above scenarios.

## Architecture rules established

1. Use native AG Grid functionality before adding application code.
2. Do not wrap `AgGridReact` merely to forward props or inject defaults.
3. Each concrete row-model root owns one authoritative native `GridApi` ref.
4. Keep Infinite and SSRM as separate implementations when their native capabilities/lifecycles differ.
5. Share domain-neutral semantic/mechanical capabilities, not feature business meaning.
6. Keep fields, filter mapping, endpoints, action payloads and business validation feature-owned.
7. Use stable backend IDs for row identity.
8. Selection state must survive RowNode/cache lifetime when product semantics require it.
9. Sorting does not clear selection merely because row positions changed.
10. Explicit/include selection survives filter changes; filtered-wide exclude does not silently change meaning with a new filter.
11. Reuse the same feature filter mapper for normal row queries and filtered selection actions.
12. Do not serialize redundant selection context such as `scope` when `mode + ids + filters` already expresses the backend target.
13. Treat disabled rows as outside the selectable universe; never encode them as include/exclude bookkeeping.
14. Use native `isRowSelectable` / editable callbacks for loaded-row interaction and keep backend eligibility authoritative for unloaded rows.
15. Use native `GridState` for grid preferences; do not mirror column/filter/sort state into a second model.
16. Explain non-obvious AG Grid lifecycle, cache, selection and ownership decisions in comments/JSDoc.
17. Do not generalize business-grid wrappers or giant `useGrid` APIs just because concrete roots contain some similar wiring.

## Intentionally outside current foundation scope

Do not implement these speculatively:

- advanced grouped/pivot SSRM behavior before a real table requires it;
- database-backed user grid preferences before a real user/persistence requirement exists;
- a generalized business-grid wrapper;
- speculative cache optimizations that add complexity without measured need;
- Docker infrastructure for this Databricks same-repository application.

Add those only when a real product requirement justifies them.
