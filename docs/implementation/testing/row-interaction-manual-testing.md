# Row Interaction Manual Verification

This guide verifies the implemented [`enabled | selectionDisabled | readOnly`](../row-interaction.md) row-interaction capability across Client-Side, Infinite and SSRM Transaction grids.

It is a browser/network verification guide. It does not replace the focused automated tests.

## Interaction contract

| Mode | Selectable | Selection-based actions | Editable | Modifying row actions |
| --- | --- | --- | --- | --- |
| `enabled` | Yes | Yes | Yes | Yes |
| `selectionDisabled` | No | No | Yes | Yes |
| `readOnly` | No | No | No | No |

Important semantic rule:

```text
restricted row != user deselection exception
```

A restricted row is outside the selectable universe. It is not inserted into logical `include` / `exclude` bookkeeping merely because backend policy made it ineligible.

## Relevant implementation boundaries

```text
frontend/src/shared/grid/rows/gridRowInteraction.ts
→ generic interaction predicates

frontend/src/shared/grid/rows/gridRowInteractionClass.ts
→ dynamic interaction rowClassRules

frontend/src/features/transactions/grid/transactionRowInteraction.ts
→ Transaction adapter + transactionRowClassRules

frontend/src/features/transactions/transactionsGrid.config.ts
→ supplies the dynamic interaction rules to Client, Infinite and SSRM defaults

frontend/src/shared/grid/selection/client-side/useClientSideSelectionController.ts
frontend/src/shared/grid/selection/infinite/useInfiniteSelectionController.tsx
frontend/src/shared/grid/selection/server-side/useSsrmSelectionController.ts
→ row-model-specific selection integration

frontend/src/shared/grid/editing/useTrackedGridEditing.ts
→ programmatic edit/read-only protection

backend/apps/transactions/services.py
→ Transaction business policy and authoritative eligibility
```

## Current Transaction demo policy

The demo backend currently derives interaction mode as follows:

```text
Pending + Treasury
→ selectionDisabled

Completed + Settlement
→ readOnly

otherwise
→ enabled
```

The backend also returns `interactionReason` for presentation.

Useful deterministic rows with a fresh backend process:

| Reference | ID | Initial account | Initial status | Expected mode |
| --- | --- | --- | --- | --- |
| `TRX-100000` | `txn-00001` | Operating | Completed | `enabled` |
| `TRX-100001` | `txn-00002` | Treasury | Pending | `selectionDisabled` |
| `TRX-100002` | `txn-00003` | Payroll | Failed | `enabled` |
| `TRX-100003` | `txn-00004` | Settlement | Completed | `readOnly` |
| `TRX-100005` | `txn-00006` | Treasury | Failed | `enabled` |
| `TRX-100007` | `txn-00008` | Settlement | Pending | `enabled` |

The demo dataset is mutable in memory. Restart Django before a clean sequence if earlier tests changed these rows.

## Setup

Run the normal checks:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
source .venv/bin/activate
python backend/manage.py test apps.transactions
```

Start Django:

```bash
source .venv/bin/activate
python backend/manage.py runserver
```

Start Vite in another terminal:

```bash
npm run dev
```

Routes:

```text
/client
/infinite
/ssrm
```

## 1. Verify the three interaction states

Run these checks in each applicable row-model route.

### Enabled row

Use `TRX-100002`.

Verify:

1. checkbox is enabled;
2. the row can be selected/unselected;
3. editable cells enter edit mode;
4. a committed edit creates normal dirty-row Save/Discard behavior;
5. normal selected-row actions can include the row.

### Selection-disabled row

Use `TRX-100001`.

Verify:

1. checkbox is visibly disabled;
2. clicking the checkbox does not select the row;
3. the row shows the `Selection disabled` presentation/reason;
4. editable cells still enter edit mode;
5. direct row Save is allowed after a valid edit;
6. selection-based actions do not target the row.

This proves:

```text
selectionDisabled != readOnly
```

### Read-only row

Use `TRX-100003`.

Verify:

1. checkbox is disabled;
2. the row shows locked/read-only presentation;
3. Account / Amount / Currency / Status editors do not open;
4. modifying row actions are unavailable;
5. selection-based actions do not target the row.

## 2. Verify authoritative interaction-mode transitions

This is a lifecycle check, not only a data-value check. The Access indicator, row treatment and native checkbox eligibility must all reflect the same latest authoritative mode after refresh.

Run each mutation-path scenario independently on `/client`, `/infinite`, and `/ssrm`, resetting/restarting the demo dataset between scenarios when needed.

### Single-row Save: `selectionDisabled → enabled`

Use `TRX-100001` / `txn-00002` (`Pending + Treasury`).

1. edit Status from `Pending` to `Completed`;
2. Save the row;
3. wait for the detail PATCH to succeed and for the server-backed row model to refresh when applicable;
4. confirm the `Selection disabled` indicator disappears;
5. confirm the cream/warning restricted-row treatment disappears;
6. confirm the checkbox becomes enabled;
7. click the checkbox and confirm the row receives a normal checked state;
8. with only that row selected, confirm the header represents a normal partial selection rather than a disabled-row artifact.

### Save Selected / bulk persistence: enabled rows become restricted

Use these two initially enabled rows:

```text
TRX-100005 / txn-00006
Treasury + Failed

TRX-100007 / txn-00008
Settlement + Pending
```

1. select both rows while they are still enabled;
2. edit `txn-00006` Status to `Pending`;
3. edit `txn-00008` Status to `Completed`;
4. confirm both rows are dirty and selected;
5. use `Save selected edits (2)`;
6. wait for `PATCH /api/transactions/bulk/` and the authoritative refresh;
7. confirm `txn-00006` becomes `selectionDisabled`, shows warning/cream treatment and has a disabled checkbox;
8. confirm `txn-00008` becomes `readOnly`, shows locked treatment and has a disabled checkbox;
9. confirm neither row remains selected after the authoritative policy makes it non-selectable;
10. confirm the selected count returns to `0`.

This scenario is important because it proves native selection state and mutable row presentation move together when a row was already selected before becoming restricted.

### Selected Change Status: `enabled → selectionDisabled`

Use `TRX-100005` / `txn-00006` (`Treasury + Failed`).

1. select the row;
2. confirm `1 selected`;
3. click `Mark Pending`;
4. wait for `PATCH /api/transactions/selection/` and the authoritative refresh;
5. confirm the successful selected action clears the old selection;
6. confirm the row now shows `Selection disabled`;
7. confirm cream/warning row treatment appears;
8. confirm its checkbox is disabled.

This proves the selected business-action refresh path obeys the same dynamic row-interaction contract as direct/bulk persistence.

### Import: exercise all mutable directions together

Restart/reset the demo dataset, then use Import CSV with:

```csv
id,account,status
txn-00002,Treasury,Completed
txn-00003,Treasury,Pending
txn-00001,Settlement,Completed
```

After Preview and Apply, wait for the authoritative row-model refresh and verify independently on `/client`, `/infinite`, and `/ssrm`:

```text
txn-00002 / TRX-100001
selectionDisabled → enabled
→ Access restriction disappears
→ cream/warning row class disappears
→ checkbox is enabled
→ clicking it produces a visible check and one selected row

txn-00003 / TRX-100002
enabled → selectionDisabled
→ Selection disabled indicator appears
→ cream/warning row treatment appears
→ checkbox is disabled

txn-00001 / TRX-100000
enabled → readOnly
→ Read only indicator appears
→ locked row treatment appears
→ checkbox is disabled
```

A stale visual class is a failure even if the underlying checkbox can technically be selected. A newly enabled selected checkbox must not still look grey/disabled because of an old `selectionDisabled` class.

The Playwright row-interaction regression covers the Import, single-row Save, Save Selected/bulk and selected Change Status mutation paths on all three row models; this manual section makes the expected UI/native-selection contract explicit.

## 3. Client-Side selection

Open `/client`.

Verify:

1. restricted rows cannot enter native Client selection;
2. native Select All respects `isRowSelectable` across the complete local working set;
3. selected count equals the exact native selected rows;
4. local Selected CSV contains only selected selectable rows;
5. explicit selected Change Status sends only selected IDs and backend authority still applies.

If testing a non-default Client selection scope, verify Page / Filtered / All through the existing Client selection configuration rather than introducing a second implementation.

## 4. Infinite Current Page

Open `/infinite` with the current Page selection configuration.

1. use the current-page header selection;
2. confirm enabled rows on the resolved page become selected;
3. confirm `TRX-100001` and `TRX-100003` remain unselected;
4. confirm restricted rows do not flicker into selected state during programmatic synchronization;
5. navigate away and back and confirm restricted rows remain unselected;
6. reload/refresh Infinite blocks and confirm the same result.

Run a selected Change Status action and inspect:

```text
PATCH /api/transactions/selection/
```

The request should use explicit `include` IDs for the selected eligible page rows. Restricted IDs should not be manufactured into the request.

## 5. Infinite dataset-wide selection

When verifying the supported `filtered` or `all` Infinite selection configuration:

- loaded restricted RowNodes must never receive programmatic selection;
- newly loaded restricted rows remain unselected;
- logical dataset-wide selection remains compact;
- restricted IDs are not inserted as user `exclude` IDs;
- backend authority removes ineligible unloaded rows when an action/export resolves the target.

For All Filtered, changing the defining filter clears the old filtered-wide selection.

For All Records, visible filter changes do not redefine the all-record selection.

## 6. SSRM Current Page

Open `/ssrm` and use `Select current page`.

Verify:

1. enabled page RowNodes become selected;
2. restricted RowNodes remain unselected;
3. restricted checkboxes cannot be toggled manually;
4. only selectable RowNodes are passed into current-page selection behavior.

## 7. SSRM Select All Filtered

Restart Django for a clean dataset if needed, then open `/ssrm` and apply:

```text
Status = Pending
```

Select All Filtered.

Verify:

1. eligible loaded Pending rows show selected;
2. Pending Treasury rows remain restricted/unselected;
3. restricted IDs are not added to user exception IDs.

Run `Mark Failed` and inspect the request conceptually:

```json
{
  "selection": {
    "mode": "exclude",
    "ids": []
  },
  "filters": [
    {
      "field": "status",
      "operator": "equals",
      "value": "Pending"
    }
  ],
  "changes": {
    "status": "Failed"
  }
}
```

The backend should update eligible Pending rows while leaving Pending Treasury rows unchanged.

## 8. SSRM All Records

Restart Django for a clean dataset if needed.

1. open `/ssrm`;
2. use native SSRM All Records selection;
3. run a selected Change Status action;
4. inspect the logical selection target.

Expected selection:

```json
{
  "mode": "exclude",
  "ids": []
}
```

There should not be a browser-generated list of restricted row IDs.

After refresh, verify restricted examples remain unchanged while eligible rows were updated.

## 9. User exception versus backend restriction

With SSRM All Records active:

1. manually uncheck one ordinary enabled row;
2. run a selected operation;
3. inspect the request.

Expected:

```json
{
  "mode": "exclude",
  "ids": ["the-enabled-row-the-user-unchecked"]
}
```

Restricted rows must not appear in `ids`.

The same semantic distinction applies to Infinite dataset-wide selection.

## 10. Direct persistence authority

Verify:

```text
selectionDisabled
→ direct edit/save allowed

readOnly
→ edit blocked in UI
→ backend detail update rejects stale/crafted write attempts
```

For the explicit bulk dirty-row endpoint, a request containing a read-only row must be rejected before leaving a partially applied batch.

## 11. Presentation is not enforcement

Check that restricted states are visible and understandable:

```text
selectionDisabled
→ disabled checkbox
→ warning/review treatment
→ visible reason

readOnly
→ disabled checkbox
→ locked treatment
→ visible reason
```

Then verify that native callbacks and backend validation still enforce the behavior independently of CSS/presentation.

## Pass criteria

The row-interaction capability is manually verified only when the relevant Client, Infinite and SSRM scenarios pass independently.

A passing browser run may be recorded only after it was actually performed.
