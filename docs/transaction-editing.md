# Transaction editing

This document records the current Transactions editing architecture. The UI may evolve, but the ownership boundaries and persistence semantics below are intentional.

For the full BASE/LOCAL/REMOTE conflict state machine, mutation restrictions, and manual scenarios, see [Unsaved edit conflict reconciliation](edit-conflict-reconciliation.md).

## Native-first rule

Before adding React state or a custom grid abstraction, check ownership in this order:

1. AG Grid native API/state/event.
2. Row-model-specific API: Infinite Row Model or Enterprise SSRM.
3. Application state only when AG Grid cannot represent the business meaning.
4. Shared hook/helper only when behavior is genuinely common.

Every custom grid state should be explainable by answering: **why can AG Grid / this row model not own this state?**

## Root GridApi ownership

Each concrete row-model root owns its rendered `<AgGridReact>` and one authoritative `GridApi` reference:

- `TransactionsInfiniteGrid` owns the Infinite `GridApi`;
- `TransactionsSsrmGrid` owns the SSRM `GridApi`.

Native grid information is read from that API when needed. Shared behavior receives the root-owned API rather than capturing another API or mirroring native grid state in React.

## Editing state is application-owned

Unsaved edits are keyed by stable backend row ID because Infinite/SSRM may evict, reload, or recreate RowNodes before persistence happens.

The shared `useTrackedGridEditing(...)` engine owns:

```text
changesById   -> current LOCAL unsaved field values
originalsById -> BASE values captured when a field first became dirty
conflictsById -> latest REMOTE values only for unresolved field conflicts
```

Transactions supplies only its feature-specific configuration:

- stable row ID reader;
- editable field list;
- field value reader;
- editable-field type guard;
- row editability predicate.

Unedited server fields are not copied into the editing store.

## Direct editing

A normal AG Grid cell edit feeds the same tracked-edit state machine used by programmatic edit flows.

Returning an ordinary non-conflicted field to its BASE value removes that field from the eventual persistence payload.

When a field already has an unresolved server conflict, the conflict must be resolved explicitly rather than silently deciding which side wins.

## Flow 1

A direct cell edit changes only its source row. The source row does not need to be selected.

An explicit Flow 1 action can propagate the most recently directly edited field/value to either:

- editable rows on the entire current pagination page; or
- editable selected rows on the current pagination page.

Selection is only a target for the explicit Apply action. Editing a source row never selects it automatically.

## Flow 2

Flow 2 applies one or more explicitly opted-in field/value pairs to either:

- editable rows on the entire current pagination page; or
- editable selected rows on the current pagination page.

Unchecked/unprovided fields remain untouched.

The presentation may later move to a dialog, drawer, toolbar, or another component without changing the tracked-edit engine.

## Current page is not cache scope

Both edit flows use the shared current-page RowNode resolver. A pagination page is a user/business scope and must not be widened to whatever Infinite/SSRM cache blocks happen to be resident.

If an expected current-page row is not resolved yet, the operation fails rather than partially applying to an accidental subset.

## Row interaction policy

Editing eligibility remains separate from selection eligibility.

```text
enabled
-> selectable and editable

selectionDisabled
-> not selectable / not part of selection-based actions
-> still editable

readOnly
-> not selectable
-> cannot receive new direct/programmatic edits
-> backend rejects explicit modifying persistence
```

Editable columns use AG Grid's native `editable` callback. Programmatic Flow 1/2 application also evaluates the feature-owned row editability rule so application code cannot bypass native editor restrictions.

An important conflict exception is deliberate: if a row becomes read-only only after fresh server data arrives, an already-existing LOCAL draft may still be overlaid visibly while the conflict is reviewed. That preserves the user's unsaved work instead of making it disappear during refresh. Persistence remains guarded by the row/business policy.

See [Server-backed row interaction policy](row-interaction.md) for the reusable interaction contract.

## Accumulated edits across pages

Direct edits, Flow 1, and Flow 2 all feed the same row-ID state machine. A user can edit one page, navigate away, edit another page, and later revisit the first page without losing accumulated drafts merely because AG Grid recreated RowNodes.

When loaded rows materialise again, `useTrackedGridEditing()` reconciles fresh server values against existing LOCAL drafts before reapplying still-valid local values.

## Refresh reconciliation

For each already-edited field:

```text
REMOTE === BASE
-> keep LOCAL dirty

REMOTE === LOCAL
-> server already contains desired value
-> clear the field automatically

REMOTE differs from both
-> keep LOCAL visible
-> store REMOTE
-> mark only that field conflicted
```

The shared engine also distinguishes genuinely fresh server row data from its own prior `setDataValue()` overlay, so revisiting the same locally mutated RowNode cannot accidentally clear a draft as if the server had converged.

The detailed lifecycle and manual verification steps are in [Unsaved edit conflict reconciliation](edit-conflict-reconciliation.md).

## Conflict UX ownership

Shared editing owns state transitions only. Transactions owns the current presentation:

- warning style on a conflicted cell;
- tooltip with LOCAL/REMOTE context;
- click-to-open MUI resolution popover;
- `Use server` / `Keep my edit` wording;
- save/action warning messages.

A conflicted field does not open its normal editor until the conflict is resolved.

There is intentionally no bulk "keep all mine" / "use all server" conflict command in this revision.

## Conflict resolution

### Use server

The conflicted LOCAL field is removed and the visible value becomes latest REMOTE. Other dirty fields on the row remain untouched.

### Keep my edit

Latest REMOTE becomes the new BASE, conflict state clears, and LOCAL remains dirty. A later Save is therefore an explicit post-review write rather than an accidental stale overwrite.

### Discard

Discard means forget local unsaved work. For conflicted fields, Discard restores latest REMOTE rather than the older BASE.

## Mutation guards

Unresolved conflicts are not only visual warnings.

### Row Save

A dirty row containing any unresolved conflict cannot be saved until its conflicted fields are resolved.

### Save selected edits

Aggregate persistence still means:

```text
accumulated dirty rows
        ∩
current logical selection
```

If that exact selected-dirty update set contains a conflicted row, the operation is blocked. The application does not silently omit conflicted rows and partially save the rest.

### Selection business actions

Server-side selection actions are blocked only when the action writes a field that is unresolved on a locally tracked selected row.

Current Transactions selection actions write only `status`, therefore a selected `status` conflict blocks Mark Completed/Pending/Failed, while an unrelated `amount` conflict does not.

This keeps mutation guarding field-aware rather than disabling every operation on a conflicted row.

## Two payload concepts

### All local UI edits

Every dirty row can be represented as explicit changes:

```json
{
  "updates": [
    { "id": "A", "changes": { "amount": 100 } },
    { "id": "B", "changes": { "status": "Completed" } }
  ]
}
```

This answers: **what has the user changed locally?**

### Backend bulk-edit payload

The bulk persistence path uses only dirty rows currently included by logical selection.

Rules:

- selected but never edited -> omitted;
- edited but unselected -> omitted;
- edited and selected -> included;
- edited+selected rows from another visited page remain eligible;
- Select All does not manufacture edits for untouched rows;
- a conflict in the selected dirty set blocks the bulk save until resolved.

The payload remains concrete IDs plus concrete changed fields. It does not send logical include/exclude selection as the edit payload.

## Persistence endpoints

Editing persistence and logical selection business actions intentionally use different backend contracts:

```text
PATCH /api/transactions/{id}/
-> save one explicit dirty row

PATCH /api/transactions/bulk/
-> save many explicit dirty-row patches
-> backend validates all rows before mutation

PATCH /api/transactions/selection/
-> apply one business change to the logical include/exclude selection
-> can include unloaded server-backed rows
```

`/bulk/` persists existing local drafts. `/selection/` applies a business action to the current logical selection. Keeping these contracts separate prevents draft persistence from being confused with dataset-wide actions.

## Selection relationship

Selection and editing remain separate concerns:

- selection can target current-page edit propagation;
- selection determines which accumulated drafts participate in selected Save/Discard;
- selection defines the target of server-side business actions;
- editing a row does not select it;
- selecting a row does not create an edit;
- selection-disabled rows may still be directly edited;
- read-only rows cannot receive new edits.

## Reusable code boundaries

- `shared/grid/editing/trackedGridEditing.ts` owns pure dirty/conflict state transitions and generic conflict queries.
- `useTrackedGridEditing(...)` owns durable draft lifecycle, RowNode overlay/restoration, fresh-row reconciliation, and conflict-resolution application.
- `useCurrentPageEditActions(...)` owns Flow 1/2 current-page targeting/application using the root-owned GridApi.
- `getCurrentPageNodes()` / `useCurrentPageRowTarget(...)` are shared action-neutral pagination primitives.
- `buildSelectedTrackedGridUpdatePayload(...)` is the generic `edited ∩ logical selection` helper.
- Transactions columns/popover/action controls own feature presentation and Transaction-specific mutation-field semantics.

## Row-model boundary

Infinite and SSRM are intentionally not forced through one selection or refresh implementation.

### Infinite

Native loaded-row selection is retained where AG Grid supports it. Dataset-wide filtered/all selection uses compact application state only because Infinite cannot represent unloaded server selection natively.

Persisted writes refresh through `refreshInfiniteCache()`.

### SSRM

Manual selection and All Records use Enterprise SSRM selection state. Current Page and Select All Filtered retain the existing row-model-specific handling where native support differs.

Persisted writes refresh through `refreshServerSide()`.

The edit reconciliation engine is shared because BASE/LOCAL/REMOTE semantics do not depend on row model; refresh ownership remains concrete and native.

## Preferences

Infinite and SSRM each own native Grid State lifecycle wiring in their root, with separate persistence keys.

The current browser store uses `localStorage`, but the storage boundary remains replaceable by a future profile/preferences API.

## Not solved by this feature

Client-side conflict reconciliation requires fresh authoritative data to have reached the browser.

It does not prevent a stale client that never refreshed from overwriting a newer server change. Multi-user optimistic concurrency/version checking is a separate backend concern and should be designed independently.

## Manual testing

Use [Unsaved edit conflict reconciliation](edit-conflict-reconciliation.md) for the complete conflict matrix and both Infinite/SSRM manual scenarios.

Before merge run:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
source .venv/bin/activate
python backend/manage.py test apps.transactions
```
