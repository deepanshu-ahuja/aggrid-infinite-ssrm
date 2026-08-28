# Pre-Client manual testing

This is the manual verification checklist for the current Infinite + SSRM baseline before Client-Side Row Model work starts.

The automated suite remains mandatory, but these scenarios exercise browser behavior, grid lifecycle and downloadable files that unit tests do not fully prove.

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

Use the two dedicated routes:

```text
/infinite
/ssrm
```

The application intentionally renders each row model on its own route so one implementation can be tested independently from the other.

## Automated verification before/after manual testing

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
source .venv/bin/activate
python backend/manage.py test apps.transactions
```

## 1. Infinite selected count

Infinite has three configured selection scopes. Change `transactionsGridConfig.infinite.selectionScope` in `frontend/src/features/transactions/transactionsGrid.config.ts` and test each mode separately.

### `page`

1. Open `/infinite`.
2. Select one normal row.
3. Confirm `1 selected`.
4. Select additional rows and confirm the number equals the exact selected IDs.
5. Use Current Page header selection.
6. Confirm only selectable rows on the current fully loaded page are selected.
7. Deselect one row and confirm the number decreases immediately.
8. Navigate away and back; explicit selection should follow the existing native page/manual behavior.

### `filtered`

1. Set `selectionScope: 'filtered'` and reload `/infinite`.
2. Apply a grid filter.
3. Click Select All Filtered.
4. Confirm displayed selected count equals the API `filteredCount` for that query.
5. Deselect two eligible rows.
6. Confirm displayed count becomes `filteredCount - 2`.
7. Change the filter.
8. Confirm the old filtered-wide selection is cleared/reset according to the current contract.

### `all`

1. Set `selectionScope: 'all'` and reload `/infinite`.
2. Select All Records.
3. Confirm displayed selected count equals API `totalCount`.
4. Deselect two eligible rows.
5. Confirm count becomes `totalCount - 2`.
6. Apply/change filters and confirm All Records remains defined against the complete dataset rather than the current page.

## 2. SSRM selected count

Open `/ssrm`.

### Manual / Current Page

1. Select one row manually; confirm `1 selected`.
2. Select several rows; confirm exact explicit count.
3. Use `Select current page`.
4. Confirm selectable rows on the resolved current page become selected.
5. Deselect one and confirm the displayed count updates immediately.

### All Filtered

1. Apply a filter.
2. Click `Select all filtered`.
3. Confirm displayed selected count equals API `filteredCount`.
4. Deselect two eligible rows.
5. Confirm count becomes `filteredCount - 2`.
6. Change the filter and confirm the old filtered-wide selection is cleared/reset.

### All Records

1. Use the native SSRM header checkbox for All Records.
2. Confirm displayed selected count equals API `totalCount`.
3. Deselect two eligible rows.
4. Confirm count becomes `totalCount - 2`.
5. Apply/change filters and confirm native All Records continues to mean the full dataset.

## 3. Count response-order sanity

This behavior has automated regression coverage, but it is useful to understand what should happen under slow network conditions.

Use browser network throttling if desired.

### Paging forward

```text
request page 1 starts
request page 2 starts
page 2 is the latest request
```

If page 1 responds later, it must not replace the `totalCount` / `filteredCount` metadata from the latest request.

### Paging backward

```text
request page 3 starts
request page 2 starts
page 2 is the latest request
```

If page 3 responds later, it must not replace the latest count metadata.

The rule is **latest started request wins**, not “highest page number wins.” Verify the same behavior for both `/infinite` and `/ssrm` if manually exercising throttled requests.

## 4. `selectionDisabled` / `readOnly`

1. Find rows rendered with `selectionDisabled` or `readOnly` interaction policy.
2. Confirm they cannot be selected through ordinary checkbox selection.
3. Confirm dataset-wide displayed counts may still include those rows under the current documented limitation.
4. Run a selected backend business action or selected export.
5. Confirm backend-ineligible rows are not acted on/exported.

Do not expect the current UI dataset-wide count to subtract only disabled rows loaded in the browser. See [Selected-row totals](selection-counts.md).

## 5. Edited-row total

Run independently in both `/infinite` and `/ssrm`.

1. Edit one editable field in one row.
2. Confirm `1 row edited total`.
3. Edit two more fields in that same row.
4. Confirm the edited total remains `1`.
5. Edit another row.
6. Confirm edited total becomes `2`.
7. Navigate away from a dirty row and back; the draft and edited-row count must survive row recreation/cache changes.
8. Discard one dirty row; count decreases by one.
9. Save one dirty row successfully; count decreases when the tracked draft is acknowledged.
10. Revert a field back to its authoritative value; once the row has no dirty fields it must leave the edited total.
11. Create a BASE/LOCAL/REMOTE conflict; the conflicted row still counts as edited until its dirty state is resolved/removed.

See [Transaction editing](transaction-editing.md) and [Unsaved edit conflict reconciliation](edit-conflict-reconciliation.md) for the full edit/conflict contract.

## 6. Export Current Page

Run independently in `/infinite` and `/ssrm`.

1. Navigate to a known pagination page.
2. Click `Export current page`.
3. Open the downloaded CSV.
4. Confirm it contains only the current fully loaded page, not other cached/loaded rows.
5. Change page and export again; confirm the file follows the new page.
6. Trigger export while the page is unresolved/loading if practical; confirm the application refuses a partial export and shows the loading message.

## 7. Export Selected — explicit rows

Run independently in `/infinite` and `/ssrm`.

1. Select two or three eligible rows explicitly.
2. Click `Export selected`.
3. Confirm one `POST /api/transactions/selection/export/` request is made.
4. Open the CSV and confirm only those selected eligible rows are present.

## 8. Export Selected — All Filtered

Run independently in both row models using their own All Filtered selection flow.

1. Apply a filter.
2. Select All Filtered.
3. Deselect at least one eligible row.
4. Click `Export selected`.
5. Confirm the request sends exclude-mode selection plus the current defining filters.
6. Confirm the CSV contains matching eligible filtered rows except the explicit deselection(s).
7. Confirm ineligible rows are not exported.

## 9. Export Selected — All Records

Run independently in both row models using their own All Records flow.

1. Select All Records.
2. Deselect at least one eligible row.
3. Click `Export selected`.
4. Confirm the request uses exclude mode without filtered scope.
5. Confirm the CSV contains eligible records except the explicit deselection(s).

## 10. Existing edit/conflict regression

Before starting Client-Side work, also re-run the existing manual conflict scenarios for both row models:

- ordinary dirty edit survives navigation/reload;
- REMOTE == BASE keeps LOCAL dirty;
- REMOTE == LOCAL auto-cleans the draft;
- REMOTE differs from BASE and LOCAL creates a conflict;
- Use server restores latest REMOTE;
- Keep my edit rebases BASE and keeps LOCAL dirty;
- row Save is blocked by unresolved conflicts;
- selected Save is blocked when the selected dirty set contains a conflict;
- field-aware selection business-action guard behaves correctly;
- Discard restores latest REMOTE;
- teardown/remount does not produce AG Grid destroyed-API warning #26.

## Pass criteria

The pre-Client baseline is manually verified only when **Infinite and SSRM both pass independently**. A successful Infinite run does not prove SSRM behavior and vice versa.
