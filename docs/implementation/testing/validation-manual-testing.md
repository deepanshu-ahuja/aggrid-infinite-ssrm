# Grid validation manual regression

This checklist verifies browser/UI behavior for the implemented Transaction validation lifecycle across Client, Infinite and SSRM.

Automated tests already cover rule execution, state transitions, backend error-shape mapping and row-model integration. This guide focuses on behavior that should also be visible and understandable in the running application.

Do not mark this checklist complete unless the scenarios were actually run.

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
```

## 1. Direct invalid LOCAL edit

Run on `/client`, `/infinite` and `/ssrm`.

1. Pick an editable `enabled` row.
2. Edit `Account` to an empty value and commit the cell edit.
3. Confirm the empty LOCAL value remains visible; it must not be reverted automatically.
4. Confirm the row remains dirty and the edited-row total includes it.
5. Confirm the validation alert appears and the invalid field has validation-error presentation.
6. Hover/focus the invalid field as appropriate and confirm the field message is available: `Account is required.`
7. Confirm the row Save action is disabled/blocked while the row is invalid.
8. Confirm the cell is still editable so the user can correct it in place.

Repeat with representative rule failures:

- `Currency = USDX` → maximum-length failure;
- `Amount = -1` → range failure;
- `Amount = 1000001` → range failure.

## 2. Correction clears stale validation

Run on all three row models.

1. Create an invalid `Account` edit as above.
2. Change the same field to a valid value such as `Operating`.
3. Confirm the field validation styling/message clears.
4. Confirm the validation-error total decreases.
5. If the row still differs from BASE, confirm it remains dirty but is now saveable.
6. Save the row.
7. Confirm the successful save clears the acknowledged dirty state and authoritative data remains visible after the row-model-specific refresh/update.

## 3. Manual revert to BASE

Run on all three row models.

1. Note a field's current authoritative value.
2. Change it to an invalid LOCAL value.
3. Change it back exactly to the original BASE value.
4. Confirm the field is no longer invalid.
5. Confirm its LOCAL draft disappears.
6. If no other dirty fields remain, confirm the row leaves the edited-row total and Row Save is no longer offered.

## 4. Programmatic current-page validation parity

Run on all three row models using `Flow 2 — bulk edit current page`.

1. Set `Edit target` to `Entire current page`.
2. Check `Account` and leave its value empty.
3. Click `Apply bulk edit`.
4. Confirm editable rows on the resolved current page receive the empty LOCAL value.
5. Confirm those rows become dirty and invalid rather than silently rejecting/reverting the programmatic edit.
6. Confirm `readOnly` rows are not changed by the programmatic operation.
7. Confirm validation messages and Save guards match the direct-cell-edit behavior.
8. Correct or discard the generated drafts before continuing.

Repeat once with `Edit target = Selected rows on current page` and confirm only selected editable rows receive the invalid LOCAL edit.

## 5. Discard clears validation belonging to LOCAL work

Run on all three row models.

### Row Discard

1. Create one invalid dirty row.
2. Use that row's `Discard` action.
3. Confirm the visible field returns to BASE, or to latest REMOTE if the field is conflicted.
4. Confirm the row's validation state disappears.
5. Confirm the edited-row total decreases when no other dirty fields remain.

### Selected Discard

1. Create invalid drafts on at least two selectable rows.
2. Select one of those rows but leave the other unselected.
3. Click `Discard selected edits`.
4. Confirm only the selected dirty row is discarded.
5. Confirm the unselected invalid dirty row remains visible, dirty and invalid.

## 6. Exact Save Selected validation guard

Run on all three row models with ordinary explicit selection.

1. Create an invalid dirty edit on row A.
2. Create a valid dirty edit on row B.
3. Select only row B.
4. Confirm `Save selected edits (1)` is enabled; row A is invalid but is outside the exact selected-dirty target.
5. Save row B and confirm only row B is persisted/acknowledged.
6. Confirm row A remains dirty and invalid.
7. Select row A.
8. Confirm Save Selected becomes disabled/blocked and the UI explains that selected edits contain invalid fields.
9. Correct row A and confirm Save Selected becomes available again.

This verifies that validation guards:

```text
dirty rows ∩ current logical selection
```

rather than every invalid draft in the grid feature.

## 7. Multiple validation errors and field-local correction

Run on at least one row model.

1. Make `Account` empty and `Currency` longer than 3 characters in the same row.
2. Confirm both fields are presented as invalid and the validation total reflects both failures.
3. Correct only `Account`.
4. Confirm only the `Account` error clears; `Currency` remains invalid.
5. Confirm Row Save remains blocked until all relevant dirty fields are valid.

## 8. Validation and conflict can coexist

Run this advanced scenario on Infinite or SSRM, where authoritative row recreation can be exercised without unmounting the feature.

1. Create an invalid LOCAL edit on a field, for example blank `Account`.
2. In another client/session or through the API, persist a different valid REMOTE value for that same row/field.
3. Trigger an authoritative grid refresh/reload path while keeping the current grid feature mounted.
4. Confirm LOCAL remains visible.
5. Confirm the field shows both validation and conflict meaning rather than one replacing the other.
6. Choose `Keep my edit` and confirm LOCAL remains, conflict clears, and the retained LOCAL value is still invalid.
7. Recreate the conflict if needed, choose `Use server`, and confirm REMOTE becomes visible while both LOCAL draft validation and conflict state clear.

Do not use a full browser reload for this scenario because application-owned LOCAL draft state is intentionally scoped to the mounted grid feature.

## 9. Server-backed row recreation preserves invalid LOCAL state

Run independently on `/infinite` and `/ssrm`.

1. Create an invalid LOCAL edit.
2. Navigate/page so the row is no longer the active concrete row, then return through the normal row-model lifecycle.
3. Confirm the LOCAL invalid value is restored when the row is recreated.
4. Confirm validation presentation and Save blocking are still present.
5. Correct or discard the value and confirm stale validation disappears.

For `/client`, exercise authoritative `rowData` replacement through a normal successful operation/refetch path and confirm remaining LOCAL invalid drafts are still reconciled correctly.

## 10. Backend rejection mapping

The normal Transaction frontend rules intentionally mirror the authoritative serializer rules for the currently editable values, so an ordinary browser edit should usually be blocked before it can produce a matching backend field rejection.

Automated tests therefore remain the primary proof for exact single-row and bulk DRF error-shape mapping into live validation state.

If a manual environment intentionally introduces a temporary backend-only stricter rule for verification:

1. use a value that passes the current frontend rule but fails the temporary backend rule;
2. Save the dirty row;
3. confirm the request fails without acknowledging the draft;
4. confirm the rejected LOCAL value remains visible and dirty;
5. confirm the backend field message appears through the same validation presentation;
6. correct the value and confirm the stale server error is replaced/cleared;
7. restore the normal backend rule after the test.

Do not change production rules merely to make this manual scenario easier.

## 11. Read-only interaction remains authoritative

Run on all three row models.

1. Find a `readOnly` row.
2. Confirm direct editing is blocked.
3. Run a current-page programmatic bulk edit that would otherwise create an invalid value.
4. Confirm the read-only row is not changed and does not acquire validation state from an edit that was never allowed.

A `selectionDisabled` row remains editable, so direct validation behavior should still work there even though normal selection is disabled.

## Pass criteria

The validation browser regression is complete only when:

- Client, Infinite and SSRM each pass the core direct-edit, correction, revert, programmatic-edit, Discard and Row Save scenarios;
- exact Save Selected guarding is verified independently for each row model;
- Infinite and SSRM both preserve invalid LOCAL state across their own row recreation lifecycle;
- validation presentation remains corrective rather than destructive: invalid LOCAL values stay visible and editable;
- no manual/browser pass is claimed for scenarios that were not actually run.
