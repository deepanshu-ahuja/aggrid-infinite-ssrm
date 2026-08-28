# AG Grid Foundation Status

This document records what the project has already established around AG Grid, what remains important, and what should stay future work.

For a capability-first overview, start with `docs/grid-capabilities.md`. For the exact native AG Grid props/APIs/events/modules we currently depend on, see `docs/ag-grid-native-usage.md`. Detailed implementation contracts remain in the feature-specific documents linked below.

## Goal

Build a reusable React + TypeScript AG Grid foundation for server-backed application tables without creating an application-specific grid framework that hides AG Grid.

The operating rules are:

> Use native AG Grid behavior and APIs first.

> Keep Infinite and SSRM separate where their native lifecycles differ.

> Share domain-neutral table capabilities; keep fields, business actions, validation and API semantics inside the feature.

> Treat lifecycle warnings, stale API use, event-cleanup races and mutation-safety problems as correctness issues even when they are intermittent.

## Completed foundation

### Application bootstrap

- AG Grid Enterprise license initialization is centralized.
- Required AG Grid modules are registered centrally through `AgGridProvider`.
- Development AG Grid validations are enabled in development builds.
- Application-wide theme/default-column configuration uses native `provideGlobalGridOptions`.
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
- request cancellation when a datasource is destroyed/replaced;
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
- request cancellation when a datasource is destroyed/replaced;
- backend sorting/filtering through the same feature mapper;
- stable backend row identity;
- native explicit and All Records server-side selection;
- explicit Current Page selection;
- custom Select All Filtered behavior where required by the product semantics;
- filtered custom selection invalidation on filter change;
- native All Records / explicit selection surviving visible filter changes;
- SSRM-native retry;
- backend-authoritative `refreshServerSide()` after successful writes.

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
-> exactly those eligible ids

exclude + translated filters
-> eligible filtered rows minus user exception ids

exclude without filters
-> all eligible records minus user exception ids
```

The frontend still uses internal row-model context while constructing an exclude request, because Infinite and SSRM reach filtered/all selection differently. That context is not duplicated in the final payload.

The generic frontend builder is `buildGridSelectionActionTarget(...)`.

Transactions adds only its feature filter translation and business `changes` payload through `buildTransactionSelectionActionRequest(...)`.

### Selection-based server actions

Transactions currently demonstrates status updates over logical selection.

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

Server-backed rows use one domain-neutral interaction capability with three states:

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

The backend independently applies the same eligibility when resolving selection actions, so disabled rows that were never loaded in the browser are skipped as well.

For editing, `selectionDisabled` remains editable. `readOnly` uses native AG Grid `editable` callbacks and the shared tracked-edit engine receives the same row-editability predicate so programmatic edits cannot bypass the UI rule. Backend detail/bulk persistence also rejects read-only targets.

See `docs/row-interaction.md` for the complete reusable contract.

### Editing

Tracked edits are keyed by stable backend row ID so unsaved changes can survive RowNode recreation/cache churn.

Current behavior includes:

- direct edit tracking after AG Grid commits `cellValueChanged`;
- Escape cancellation creating no draft;
- manual revert to the original value automatically clearing a normal draft;
- latest-edit and explicit bulk/current-page apply flows;
- row Save/Discard;
- aggregate Save/Discard over `dirty ∩ logical selection`;
- safe acknowledgement of only the exact values that successfully persisted;
- preservation of a newer user edit made while an older save is in flight;
- restoration of unsaved drafts as server-backed rows reload;
- idempotent Discard behavior;
- programmatic-write guarding so our own RowNode writes do not become fake user edits.

### Refresh/edit conflict reconciliation

The previous open question around server refresh versus unsaved drafts is now explicitly solved.

For every dirty field the shared editing state distinguishes:

```text
BASE   = value when the field became dirty
LOCAL  = current unsaved user value
REMOTE = latest genuinely refreshed server value
```

Rules:

```text
REMOTE == BASE
-> keep LOCAL dirty

REMOTE == LOCAL
-> server already converged to LOCAL
-> automatically clean the field

REMOTE differs from BASE and LOCAL
-> keep LOCAL visible
-> retain REMOTE
-> mark only that field conflicted
```

Conflicts are resolved individually:

```text
Use server
-> REMOTE wins and that field draft clears

Keep my edit
-> REMOTE becomes the new BASE
-> LOCAL remains dirty for an intentional later save
```

Unresolved conflicts actively guard mutations:

- row Save is blocked for a conflicted row;
- Save selected edits is blocked if its selected dirty update set contains a conflict; it does not silently partially save;
- selection-based business actions are blocked only when the action writes a field that is conflicted on the selected target;
- Discard remains available and restores the latest REMOTE value for a conflicted field.

There is intentionally no `preserveDraft` policy switch and no bulk `Use all server` / `Keep all my edits` conflict command.

See `docs/edit-conflict-reconciliation.md` for the complete state model and manual scenarios.

### Lifecycle hardening

Grid lifecycle ownership is now treated as part of the foundation contract.

Current protections include:

- each concrete grid root owns one authoritative `GridApi` ref;
- roots clear their API ref in native `gridPreDestroy`;
- the custom Infinite Current Page header checks `api.isDestroyed()` before cleanup/click-time GridApi use;
- native listener cleanup therefore does not call `removeEventListener()` on an already destroyed API (AG Grid warning #26);
- a regression test covers the destroyed-API cleanup path;
- custom header listeners remain tied to the events that can actually change current-page selection state;
- tracked editing distinguishes a genuinely refreshed row-data object from the hook's own LOCAL overlay so a model/page revisit cannot falsely treat LOCAL as fresh REMOTE.

When another AG Grid lifecycle warning/race is discovered, fix the underlying ownership/timing issue rather than suppressing the warning.

### Documentation

The reusable foundation now has two high-level entry points:

- `docs/grid-capabilities.md` — capability catalog: what the current grid can do logically, independent of one UI;
- `docs/ag-grid-native-usage.md` — dependency map: which native AG Grid props/APIs/events/RowNode methods/state/modules we use and why.

Detailed source-of-truth documents remain:

- `docs/server-backed-grid-reuse.md` — how to use the foundation for another table;
- `docs/row-interaction.md` — selection-disabled/read-only frontend + backend contract;
- `docs/row-interaction-manual-testing.md` — row interaction implementation/manual scenarios;
- `docs/ag-grid.md` — detailed architecture/ownership;
- `frontend/src/infinite-selection-contract.md` — Infinite selection scenarios;
- `frontend/src/ssrm-selection-contract.md` — SSRM selection scenarios;
- `docs/transaction-editing.md` — editing behavior;
- `docs/edit-conflict-reconciliation.md` — refresh conflict model/restrictions/manual tests;
- `docs/api-data-flow.md` — backend query/action flow.

Documentation maintenance rule:

> A capability/contract/native dependency change should update the relevant detailed document **and** the appropriate high-level catalog in the same change.

## Important remaining work

These are the items worth resolving before calling the current foundation fully settled.

### 1. Run complete executable validation after the latest changes

The latest conflict/lifecycle fixes still need a complete local executable pass:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
source .venv/bin/activate
python backend/manage.py test apps.transactions
```

Do not claim the foundation green until those commands pass.

### 2. Complete the manual conflict/lifecycle pass

Use `docs/edit-conflict-reconciliation.md` to verify both Infinite and SSRM scenarios, including:

- server unchanged -> LOCAL remains ordinary dirty;
- server converged -> draft auto-cleans;
- real BASE/LOCAL/REMOTE divergence -> field conflict;
- Use server;
- Keep my edit;
- row Save guard;
- selected Save guard;
- field-aware selection-action guard;
- Discard restoring latest REMOTE;
- page/model revisit not auto-cleaning our own LOCAL overlay;
- genuine server/cache refresh reconciling REMOTE;
- navigation/remount/teardown not producing AG Grid warning #26.

### 3. Confirm post-action selection UX

Selection currently remains after a successful server action. Confirm whether a real product wants to:

- preserve selection;
- clear selection;
- clear only for particular actions.

This should be an action/product choice, not a hidden shared-grid default.

### 4. Backend optimistic concurrency remains a separate future contract

Current conflict detection works when authoritative REMOTE data reaches the client through refresh.

A stale client that never refreshed can still submit a write unless the backend adds version/ETag/revision-style optimistic concurrency.

Do not confuse frontend BASE/LOCAL/REMOTE reconciliation with backend concurrency enforcement. Design that separately when the product requires multi-user stale-write protection.

### 5. Continue manual row-model scenario coverage

Automated tests cover the contracts, but manual passes should continue verifying user-visible combinations independently for Infinite and SSRM:

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
- dirty/conflicted edits combined with the above scenarios.

## Architecture rules established

1. Use native AG Grid functionality before adding application code.
2. Do not wrap `AgGridReact` merely to forward props or inject defaults.
3. Each concrete row-model root owns one authoritative native `GridApi` ref.
4. Clear root-owned API refs in AG Grid's pre-destroy lifecycle and do not call GridApi methods after `isDestroyed()` becomes true.
5. Keep Infinite and SSRM as separate implementations when their native capabilities/lifecycles differ.
6. Share domain-neutral semantic/mechanical capabilities, not feature business meaning.
7. Keep fields, filter mapping, endpoints, action payloads and business validation feature-owned.
8. Use stable backend IDs for row identity.
9. Selection state must survive RowNode/cache lifetime when product semantics require it.
10. Sorting does not clear selection merely because row positions changed.
11. Explicit/include selection survives filter changes; filtered-wide exclude does not silently change meaning with a new filter.
12. Reuse the same feature filter mapper for normal row queries and filtered selection actions.
13. Do not serialize redundant selection context such as `scope` when `mode + ids + filters` already expresses the backend target.
14. Treat disabled rows as outside the selectable universe; never encode them as include/exclude bookkeeping.
15. Use native `isRowSelectable` / editable callbacks for loaded-row interaction and keep backend eligibility authoritative for unloaded rows.
16. Use native `GridState` for grid preferences; do not mirror column/filter/sort state into a second model.
17. Keep unsaved editing state outside RowNodes when it must survive row-model cache lifetime.
18. Reconcile dirty fields through BASE/LOCAL/REMOTE before overlaying LOCAL onto genuinely fresh server data.
19. Do not silently persist unresolved edit conflicts.
20. Explain non-obvious AG Grid lifecycle, cache, selection, editing and ownership decisions in comments/JSDoc.
21. Do not generalize business-grid wrappers or giant `useGrid` APIs merely because concrete roots contain some similar wiring.
22. Keep capability and native-usage overview documentation current when behavior changes.

## Intentionally outside current foundation scope

Do not implement these speculatively:

- advanced grouped/tree/pivot SSRM behavior before a real table requires it;
- backend optimistic concurrency/versioning before the product contract is designed;
- database-backed user grid preferences before a real user/persistence requirement exists;
- bulk conflict-resolution commands;
- configurable edit-refresh policies with no real use case;
- a generalized business-grid wrapper;
- speculative cache optimizations that add complexity without measured need;
- Docker infrastructure for this Databricks same-repository application.

Add those only when a real product requirement justifies them.
