# Row interaction capability: what exists and how to test it

This document is the practical companion to [`row-interaction.md`](./row-interaction.md).

Use it when reviewing the implementation, onboarding a developer, or manually testing changes to row
selection/editability. It intentionally records both **what the capability contains** and **how to prove
it works in Infinite Row Model and SSRM**.

---

## 1. What we built

The shared server-backed grid capability understands three row interaction modes:

| Mode | Checkbox / selection | Selection-based bulk actions | Cell editing | Modifying row actions | Default visual treatment |
| --- | --- | --- | --- | --- | --- |
| `enabled` | Allowed | Allowed | Allowed | Allowed | Normal AG Grid row |
| `selectionDisabled` | Disabled | Never eligible | Allowed | Allowed | Light warning/review row + grey disabled checkbox |
| `readOnly` | Disabled | Never eligible | Blocked | Blocked | Grey locked row + grey disabled checkbox + lock indicator |

The important semantic rule is:

```text
disabled row != excluded row
```

A disabled row lives **outside the selectable universe**. It must never be added to `include` or
`exclude` merely because the row is disabled.

For example, Select All Records remains:

```ts
{ mode: 'exclude', ids: [] }
```

even if thousands of backend rows are disabled.

`exclude` IDs mean only:

```text
rows the user explicitly deselected while a dataset-wide selection was active
```

---

## 2. Where the reusable code lives

### Shared semantics

`frontend/src/shared/grid/rows/gridRowInteraction.ts`

Owns the generic meaning of:

```ts
'enabled' | 'selectionDisabled' | 'readOnly'
```

and answers the three independent questions:

- may the row participate in selection?
- may the row be edited?
- is the row fully read-only?

No Transaction/Payable/status/account rule belongs there.

### Shared AG Grid row-class adapter

`frontend/src/shared/grid/rows/gridRowInteractionClass.ts`

`createGridRowInteractionClassGetter(...)` hides the repetitive AG Grid `getRowClass` mechanics.

Normal/common API shape:

```ts
interface MyRow {
  interactionMode: GridRowInteractionMode;
}

const getRowClass = createGridRowInteractionClassGetter<MyRow>();
```

A feature whose backend shape is different can adapt without copying AG Grid logic:

```ts
const getRowClass = createGridRowInteractionClassGetter<MyRow>({
  getMode: (row) => row.permissions.gridInteractionMode,
});
```

A grid can override only the common class names:

```ts
const getRowClass = createGridRowInteractionClassGetter<MyRow>({
  classNames: {
    readOnly: 'my-grid--locked',
    selectionDisabled: 'my-grid--selection-disabled',
  },
});
```

A feature can append one unrelated feature class without copying the common interaction mapping:

```ts
const getRowClass = createGridRowInteractionClassGetter<MyRow>({
  getAdditionalClass: (row) =>
    row.isHighValue ? 'my-feature-row--high-value' : undefined,
});
```

Do not turn this small extension point into the future general conditional-row-styling system. A richer
condition/class/style API should remain a separate capability.

### Native AG Grid selection boundary

Both grid roots pass the feature adapter into:

```ts
rowSelection.isRowSelectable
```

AG Grid evaluates that callback for loaded rows and exposes the result through `RowNode.selectable`.
Our shared Current Page / filtered-selection code consumes `RowNode.selectable` instead of repeating
feature conditions.

### Infinite selection

Relevant files:

- `frontend/src/shared/grid/selection/infinite/useInfiniteSelectionController.tsx`
- `frontend/src/shared/grid/selection/infinite/InfiniteCurrentPageSelectionHeader.tsx`

Important rules:

- page/manual selection stays AG Grid-owned;
- filtered/all selection uses compact logical state because unloaded Infinite rows have no RowNode;
- loaded disabled rows are never passed to selection APIs;
- disabled IDs are never manufactured into logical exclusions;
- newly loaded blocks reconcile only selectable RowNodes.

### SSRM selection

Relevant file:

- `frontend/src/shared/grid/selection/server-side/useSsrmSelectionController.ts`

Important rules:

- native SSRM owns explicit selection and All Records;
- custom state exists only for Select All Filtered;
- Current Page passes only selectable RowNodes to `setNodesSelected`;
- custom filtered reconciliation skips disabled RowNodes;
- `getSelectedRows()` is not used as the logical dataset-wide selection source.

### Shared editing protection

Relevant file:

- `frontend/src/shared/grid/editing/useTrackedGridEditing.ts`

AG Grid column `editable` blocks normal UI editing on read-only rows. The shared tracked-edit hook also
checks the same row-editability policy before programmatic writes/restoration, so application code
cannot bypass a read-only row through `RowNode.setDataValue(...)`.

### Backend authority

Relevant file:

- `backend/apps/transactions/services.py`

The browser knows only loaded rows. Therefore dataset-wide eligibility is enforced again by Python.
For logical selection actions Python:

```text
resolves the requested dataset
-> keeps only selection-eligible rows
-> applies user exclusions when present
-> performs the mutation
```

The frontend never loads the whole dataset to discover disabled IDs.

---

## 3. Current Transaction demo policy

The grid capability is generic; the **demo policy is Transaction-specific and backend-owned**.

Current local rules:

```text
Pending + Treasury
-> selectionDisabled
-> individual edit allowed
-> selection/bulk not allowed

Completed + Settlement
-> readOnly
-> selection/bulk not allowed
-> edit not allowed

anything else
-> enabled
```

The backend also returns `interactionReason` so the UI can explain why the row is restricted.

The policy is recomputed after authoritative writes. It is not a static flag generated once when the
server starts.

With a fresh backend process, useful first-page rows are:

| Reference | Initial account | Initial status | Expected mode |
| --- | --- | --- | --- |
| `TRX-100000` | Operating | Completed | `enabled` |
| `TRX-100001` | Treasury | Pending | `selectionDisabled` |
| `TRX-100002` | Payroll | Failed | `enabled` |
| `TRX-100003` | Settlement | Completed | `readOnly` |

Because the demo backend is an in-memory mutable dataset, **restart Django before a clean manual-test
sequence** if earlier tests changed statuses/accounts.

---

## 4. Expected visual language

The three states must be recognisable without first clicking the checkbox.

### Enabled

Expected:

- normal row background/text;
- normal AG Grid checkbox;
- no Access restriction badge;
- normal AG Grid selected-row styling when selected.

The application AG Grid theme uses blue as its normal accent/selection language. Restriction styling
must not reuse that blue.

### Selection disabled

Expected:

- light warning/review background;
- left warning marker;
- checkbox looks conventionally disabled with neutral grey fill/border;
- Access cell says `Selection disabled`;
- hovering the Access indicator shows the backend reason;
- cells still look usable and can enter edit mode.

This row should NOT look fully grey/read-only because individual work is still allowed.

### Read only

Expected:

- stronger neutral-grey whole-row background;
- muted text;
- grey disabled checkbox;
- not-allowed cursor over row cells;
- Access cell has a lock icon + `Read only`;
- hovering the Access indicator shows the backend reason;
- editable cells cannot enter edit mode;
- modifying row actions are unavailable.

---

## 5. Local startup and code checks

Pull the current branch first:

```bash
git checkout grid-foundation
git pull origin grid-foundation
```

Run the normal frontend checks:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Run backend tests:

```bash
source .venv/bin/activate
python backend/manage.py test apps.transactions
```

Start backend:

```bash
source .venv/bin/activate
python backend/manage.py runserver
```

Start frontend in another terminal:

```bash
npm run dev
```

Routes:

```text
/infinite
/ssrm
```

---

# Manual tests

## 6. Test the three visual/interaction states first

Do this before testing Select All. It proves the basic row policy is visible and native AG Grid
selectability/editability is wired correctly.

### A. Enabled row

Use `TRX-100002` (`Failed + Payroll`).

Expected:

1. checkbox is enabled;
2. checkbox can be selected/unselected;
3. row uses normal visual styling;
4. editable cells can enter edit mode;
5. after a real edit, normal Save/Discard row actions can appear.

### B. Selection-disabled row

Use `TRX-100001` (`Pending + Treasury`).

Expected:

1. checkbox is visibly disabled/grey;
2. clicking the checkbox does nothing;
3. row has the lighter warning/review background, not the read-only grey treatment;
4. Access cell says `Selection disabled`;
5. hover the Access indicator and verify the reason mentions Pending Treasury / individual review;
6. edit a harmless field such as Amount;
7. Save is allowed and succeeds;
8. after refresh it is still selection-disabled because Amount does not change the policy fields.

This proves:

```text
selectionDisabled != readOnly
```

### C. Read-only row

Use `TRX-100003` (`Completed + Settlement`).

Expected:

1. checkbox is visibly disabled/grey;
2. row has the stronger grey locked treatment;
3. Access cell shows a lock icon + `Read only`;
4. hover shows the backend reason;
5. double-click Account / Amount / Currency / Status;
6. no editor should open;
7. no modifying Save/Discard row action should become available.

---

## 7. Test policy recomputation after a legitimate edit

This verifies that `interactionMode` is derived from authoritative backend data rather than being a
stale static frontend flag.

Use `TRX-100001` (`Pending + Treasury`), which starts as selection-disabled but remains editable.

1. edit Account from `Treasury` to `Operating`;
2. save that row;
3. backend refresh should return the updated row;
4. the row should become `enabled` because it no longer matches `Pending + Treasury`;
5. warning styling/Access restriction should disappear;
6. checkbox should become selectable.

Restart Django afterward if you want the original demo data for the remaining tests.

---

## 8. Infinite Row Model - Current Page

The committed Transactions Infinite demo currently uses:

```ts
selectionScope: 'page'
```

Open `/infinite`.

On page 1 verify at least:

```text
TRX-100001 -> selection disabled
TRX-100003 -> read only
TRX-100002 -> enabled
```

Click the selection-column header checkbox.

Expected:

1. enabled rows on the current page become selected;
2. `TRX-100001` remains disabled + unselected;
3. `TRX-100003` remains disabled + unselected;
4. there is no momentary/flickering selected state on those restricted rows;
5. navigating to another page and back does not make restricted rows selected;
6. refreshing/reloading Infinite blocks does not make restricted rows selected.

Click the header again.

Expected:

- selectable rows on the page clear;
- restricted rows remain untouched throughout.

### Network check for Current Page business action

1. select the current page;
2. open browser DevTools -> Network;
3. run `Mark Failed`;
4. inspect `PATCH /api/transactions/selection/`.

Because page mode is explicit selection, the request uses `mode: 'include'` with selected eligible IDs.

Expected:

- disabled/read-only IDs are not present;
- frontend did not create special exclusions for them;
- backend still independently enforces eligibility.

---

## 9. SSRM - Current Page

Open `/ssrm`.

Click `Select current page`.

Expected:

1. enabled rows on the current page become selected;
2. `TRX-100001` remains disabled/unselected;
3. `TRX-100003` remains disabled/unselected;
4. clicking either restricted checkbox directly does nothing.

The implementation must pass only `RowNode.selectable === true` nodes into AG Grid's
`setNodesSelected(...)` call.

---

## 10. SSRM - Select All Filtered (important backend proof)

Restart Django first so initial statuses/accounts are clean.

Open `/ssrm` and apply:

```text
Status = Pending
```

The filtered dataset contains both:

- normal eligible Pending rows;
- `Pending + Treasury` rows that are selection-disabled.

Click `Select all filtered`.

Expected in the UI:

1. eligible loaded Pending rows show selected;
2. Pending Treasury rows remain grey-checkbox disabled and unselected;
3. disabled IDs do not become user exception IDs.

Now open DevTools -> Network and click `Mark Failed`.

Inspect:

```text
PATCH /api/transactions/selection/
```

Expected request shape (conceptually):

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

The important assertion is:

```text
ids: []
```

Do NOT expect Pending Treasury IDs in the exclusion array. They are backend-ineligible rows, not user
deselections.

After the successful action and grid refresh, keep the `Status = Pending` filter active.

A useful visible proof is that the eligible Pending rows were changed to Failed and disappear from the
Pending result, while Pending Treasury selection-disabled rows remain Pending because Python skipped
them.

---

## 11. SSRM - Select All Records including unloaded rows

Restart Django again for a clean dataset.

1. open `/ssrm`;
2. do not browse through many pages first;
3. use the native SSRM header checkbox for All Records;
4. open DevTools -> Network;
5. click `Mark Failed`.

Expected request selection:

```json
{
  "mode": "exclude",
  "ids": []
}
```

There should be no giant list of restricted row IDs.

After refresh, verify examples on page 1:

- `TRX-100000` (`Completed + Operating`, enabled initially) can be changed by the action;
- `TRX-100001` (`Pending + Treasury`, selection-disabled) must remain Pending;
- `TRX-100003` (`Completed + Settlement`, read-only) must remain Completed.

This proves the most important server-backed rule:

```text
browser did not enumerate every restricted record
+
logical Select All stayed compact
+
Python independently removed ineligible rows
```

The same rule protects restricted rows that were never loaded in the browser.

---

## 12. SSRM - user exclusion remains different from disabled rows

Restart Django if necessary.

1. Select All Records;
2. manually uncheck ONE ordinary enabled row;
3. run a business action;
4. inspect the selection request.

Expected:

```json
{
  "mode": "exclude",
  "ids": ["the-enabled-row-the-user-unchecked"]
}
```

Expected NOT to appear in `ids`:

- selection-disabled rows;
- read-only rows.

This is the clean semantic distinction:

```text
exclude IDs = user choices
disabled rows = backend eligibility
```

---

## 13. Infinite filtered/all modes

The reusable Infinite controller supports `page`, `filtered`, and `all`, but the committed Transactions
demo currently defaults to `page` in:

`frontend/src/features/transactions/transactionsGrid.config.ts`

For a focused local verification of the other Infinite modes, temporarily change:

```ts
selectionScope: 'page'
```

to:

```ts
selectionScope: 'filtered'
```

and repeat the filtered test above on `/infinite`.

Then temporarily use:

```ts
selectionScope: 'all'
```

and repeat the all-records test.

Do not commit that temporary test switch unless the product/demo default itself is intentionally being
changed.

For both modes verify the same contract:

- restricted loaded RowNodes never receive programmatic selection;
- newly loaded/reloaded restricted rows remain unselected;
- logical payload remains compact;
- restricted IDs are not manufactured into `exclude`;
- backend handles unloaded-row eligibility.

---

## 14. What a future table should need to provide

A future Payables-like feature should not rebuild these mechanics.

It should provide:

1. a backend/domain rule that produces the generic interaction mode;
2. preferably the common row field `interactionMode`, or a small `getMode(row)` adapter;
3. a human-readable restriction reason when useful;
4. its normal feature column/edit/action definitions;
5. matching backend eligibility/read-only enforcement for its own write endpoints.

It should reuse:

- shared interaction predicates;
- shared row-class mapping;
- native `isRowSelectable` integration pattern;
- Infinite/SSRM selection mechanics;
- shared tracked-edit read-only guard where applicable.

The grid library should make the AG Grid lifecycle easy to consume without hiding the concrete grid root
behind a giant wrapper or universal `useGrid` abstraction.
