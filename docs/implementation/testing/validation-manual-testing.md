# Grid validation manual regression

This checklist verifies browser/UI behavior for the implemented Transaction validation lifecycle across Client, Infinite and SSRM.

Automated tests cover rule execution, state transitions, backend error-shape mapping, row-model integration and selected real-browser paths. This guide remains the human-readable regression checklist and must not be marked complete unless the scenarios were actually run.

See also [Browser regression architecture](browser-regression.md).

## Run the application

Start Django:

```bash
source .venv/bin/activate
python backend/manage.py runserver
```

Start Vite in another terminal:

```bash
npm run dev
```

Run the core scenarios independently on:

```text
/client
/infinite
/ssrm
```

For Infinite and SSRM, also exercise at least one navigation/cache/store recreation path while a draft is dirty.

## Current rules to exercise

```text
account
→ required
→ maximum 100 characters

amount
→ 0 through 1,000,000

currency
→ required
→ maximum 3 characters

status
→ required in frontend
→ allowed choices remain backend-authoritative

transactionDate
→ required
→ backend DateField remains authoritative for persisted date syntax
```

## 1. MUI Account editor shows the exact field reason

Run on `/client`, `/infinite` and `/ssrm`.

1. Pick an editable `enabled` row.
2. Double-click `Account`.
3. Confirm the popup editor is a MUI text field labeled `Account`.
4. Clear the input.
5. Before committing, confirm the editor itself shows `Account is required.` beneath the input.
6. Commit the edit.
7. Confirm the empty LOCAL value remains visible; it must not be reverted automatically.
8. Confirm the Account cell is highlighted invalid and the row remains dirty.
9. Confirm Row Save is disabled/blocked.
10. Reopen the Account editor and enter a valid value.
11. Confirm the helper error disappears while editing and the committed correction clears the cell validation state.

The custom MUI editor message is presentation only. Committed validation still has to be present in the shared stable validation state used by Save guards.

## 2. Date picker editing and validation

Run on all three row models.

1. Double-click `Transaction date` on an editable row.
2. Confirm the MUI date input opens and exposes the browser date picker.
3. Clear the date.
4. Confirm the editor itself shows `Transaction date is required.`.
5. Commit the blank value.
6. Confirm the blank LOCAL date remains dirty/invalid and Row Save is blocked.
7. Reopen the picker and choose a valid calendar date.
8. Confirm validation clears after commit.
9. Save the row.
10. Confirm the authoritative value remains the selected date after the row-model-specific refresh/update.
11. Confirm no date formatter/browser exception occurs while the blank invalid draft is visible.

## 3. Other direct invalid LOCAL edits

Run on all three row models.

1. Create `Currency = USDX` and confirm the maximum-length failure.
2. Create `Amount = -1` and confirm the range failure.
3. Create `Amount = 1000001` and confirm the range failure.
4. Confirm every invalid LOCAL value remains visible and dirty rather than being automatically reverted.
5. Confirm the invalid field has validation-error presentation and the validation alert total changes.
6. Confirm the field remains editable for correction.
7. Confirm Row Save stays disabled while any dirty field in that row is invalid.

For cells that use native AG Grid editors, hover the invalid cell and confirm the tooltip contains the exact field validation message.

## 4. Flow 2 current-page validation parity

Run on all three row models using `Flow 2 — bulk edit current page`.

### Blank Currency regression

1. Set `Edit target` to `Entire current page`.
2. Check `Currency` and leave its MUI input blank.
3. Confirm the Flow 2 input itself shows `Currency is required.`.
4. Click `Apply bulk edit`.
5. Confirm editable rows receive blank Currency as invalid LOCAL work.
6. Confirm the invalid presentation is on the Currency cells only.
7. Confirm the adjacent Status cells/chips are not overlapped or incorrectly marked invalid.
8. Confirm Amount continues rendering even though Currency is temporarily invalid/blank.
9. Confirm the browser console has no `Intl.NumberFormat` / `Invalid currency code` exception.

### Blank Amount regression

1. Check `Amount` and leave the MUI input blank.
2. Confirm the Flow 2 input shows `Amount must be between 0 and 1,000,000.`.
3. Click `Apply bulk edit`.
4. Confirm blank Amount becomes a real invalid LOCAL draft; it must not be silently omitted from the requested page edit.
5. Confirm Amount cells are highlighted invalid and Row Save is blocked.
6. Confirm Status cells are not incorrectly marked invalid.

### Target parity

Repeat once with `Edit target = Selected rows on current page` and confirm only selected editable rows receive the invalid LOCAL edit. Confirm `readOnly` rows are never changed by Flow 2.

## 5. Correction clears stale validation

Run on all three row models.

1. Create an invalid Account, Amount, Currency or Date edit.
2. Change the same field to a valid value.
3. Confirm the field validation styling/message clears.
4. Confirm the validation-error total decreases.
5. If the row still differs from BASE, confirm it remains dirty but is now saveable.
6. Save the row.
7. Confirm successful persistence clears acknowledged dirty state and the authoritative value remains after refresh/update.

## 6. Manual revert to BASE

Run on all three row models.

1. Note a field's current authoritative value.
2. Change it to an invalid LOCAL value.
3. Change it back exactly to BASE.
4. Confirm the field is no longer invalid.
5. Confirm its LOCAL draft disappears.
6. If no other dirty fields remain, confirm the row leaves the edited-row total and Row Save is no longer offered.

## 7. Discard clears validation belonging to LOCAL work

### Row Discard

1. Create one invalid dirty row.
2. Use that row's `Discard` action.
3. Confirm the visible field returns to BASE, or latest REMOTE if conflicted.
4. Confirm the row's validation state disappears.
5. Confirm the edited-row total decreases when no other dirty fields remain.

### Selected Discard

1. Create invalid drafts on at least two selectable rows.
2. Select one but leave the other unselected.
3. Click `Discard selected edits`.
4. Confirm only the selected dirty row is discarded.
5. Confirm the unselected invalid dirty row remains visible, dirty and invalid.

## 8. Exact Save Selected validation guard

Run on all three row models with ordinary explicit selection.

1. Create an invalid dirty edit on row A.
2. Create a valid dirty edit on row B.
3. Select only row B.
4. Confirm `Save selected edits (1)` is enabled; row A is invalid but outside the exact selected-dirty target.
5. Save row B and confirm only row B is persisted/acknowledged.
6. Confirm row A remains dirty and invalid.
7. Select row A.
8. Confirm Save Selected becomes disabled/blocked and the UI explains that selected edits contain invalid fields.
9. Correct row A and confirm Save Selected becomes available again.

The guard must target:

```text
dirty rows ∩ current logical selection
```

not every invalid draft in the feature.

## 9. Multiple validation errors and field-local correction

1. Make `Account` empty and `Currency` longer than 3 characters in the same row.
2. Confirm both fields are presented as invalid and the validation total reflects both failures.
3. Correct only Account.
4. Confirm only the Account error clears; Currency remains invalid.
5. Confirm Row Save remains blocked until every relevant dirty field is valid.

## 10. Validation and conflict can coexist

Run this advanced scenario on Infinite or SSRM.

1. Create an invalid LOCAL edit on a field.
2. In another client/session or through the API, persist a different valid REMOTE value for that same row/field.
3. Trigger an authoritative grid refresh/reload path while keeping the current grid feature mounted.
4. Confirm LOCAL remains visible.
5. Confirm the field preserves both validation and conflict meaning rather than one replacing the other.
6. Choose `Keep my edit` and confirm LOCAL remains, conflict clears, and retained LOCAL is revalidated.
7. Recreate the conflict if needed, choose `Use server`, and confirm REMOTE becomes visible while LOCAL validation/conflict state clear.

Do not use a full browser reload for this scenario because application-owned LOCAL draft state is intentionally scoped to the mounted grid feature.

## 11. Server-backed row recreation preserves invalid LOCAL state

Run independently on `/infinite` and `/ssrm`.

1. Create an invalid LOCAL edit.
2. Navigate/page so the row is no longer the active concrete row, then return through the normal row-model lifecycle.
3. Confirm the LOCAL invalid value is restored when the row is recreated.
4. Confirm validation presentation and Save blocking remain.
5. Correct or discard the value and confirm stale validation disappears.

For `/client`, exercise authoritative `rowData` replacement through a normal successful operation/refetch path and confirm remaining LOCAL invalid drafts reconcile correctly.

## 12. Backend rejection mapping

Frontend rules intentionally mirror the normal authoritative serializer constraints for current editable values, so an ordinary browser edit should usually be blocked before producing the same backend field rejection.

Automated tests remain the primary proof for exact single-row and bulk DRF error-shape mapping into live validation state.

If a manual environment intentionally introduces a temporary backend-only stricter rule:

1. use a value that passes frontend validation but fails the temporary backend rule;
2. Save the dirty row;
3. confirm the request fails without acknowledging the draft;
4. confirm rejected LOCAL remains visible and dirty;
5. confirm the backend field message appears through the same validation presentation;
6. correct the value and confirm the stale server error is replaced/cleared;
7. restore the normal backend rule.

Do not change production rules merely to make this scenario easier.

## 13. Read-only interaction remains authoritative

Run on all three row models.

1. Find a `readOnly` row.
2. Confirm Account and Transaction date editors cannot open.
3. Run a current-page programmatic bulk edit that would otherwise create an invalid value.
4. Confirm the read-only row is not changed and does not acquire validation state from an edit that was never allowed.

A `selectionDisabled` row remains individually editable, so direct Account/Date editing and validation should still work there even though normal selection is disabled.

## Pass criteria

The manual validation regression is complete only when:

- Client, Infinite and SSRM each pass the core direct-edit, MUI Account, Date picker, correction, revert, Flow 2, Discard and Row Save scenarios;
- exact Save Selected guarding is verified independently for each row model;
- Infinite and SSRM both preserve invalid LOCAL state across their own row recreation lifecycle;
- validation presentation stays field-local and does not distort/overlap neighboring columns;
- invalid LOCAL values stay visible/editable so correction remains possible;
- no manual/browser pass is claimed for scenarios that were not actually run.
