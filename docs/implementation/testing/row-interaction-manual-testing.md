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
→ generic row-class mapping

frontend/src/features/transactions/grid/transactionRowInteraction.ts
→ Transaction adapter/presentation inputs

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

| Reference | Initial account | Initial status | Expected mode |
| --- | --- | --- | --- |
| `TRX-100000` | Operating | Completed | `enabled` |
| `TRX-100001` | Treasury | Pending | `selectionDisabled` |
| `TRX-100002` | Payroll | Failed | `enabled` |
| `TRX-100003` | Settlement | Completed | `readOnly` |

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

## 2. Verify policy recomputation after Save

Use `TRX-100001` (`Pending + Treasury`).

1. edit Account from `Treasury` to `Operating`;
2. Save the row;
3. wait for authoritative data refresh;
4. confirm the row becomes `enabled`;
5. confirm restriction presentation disappears;
6. confirm the checkbox becomes selectable.

This verifies that interaction mode comes from authoritative backend data rather than a stale frontend-only flag.

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
