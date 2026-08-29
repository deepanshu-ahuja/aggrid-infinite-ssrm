# Server-backed manual regression

This checklist verifies the Infinite and SSRM browser behavior that automated tests do not fully prove, including grid lifecycle and downloadable files.

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

Use the dedicated routes:

```text
/infinite
/ssrm
```

Test each row model independently.

## Automated verification

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
8. Confirm the old filtered-wide selection clears.

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
6. Change the filter and confirm the old filtered-wide selection clears.

### All Records

1. Use the native SSRM header checkbox for All Records.
2. Confirm displayed selected count equals API `totalCount`.
3. Deselect two eligible rows.
4. Confirm count becomes `totalCount - 2`.
5. Apply/change filters and confirm native All Records continues to mean the full dataset.

## 3. Count response-order sanity

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

The rule is **latest started request wins**, not “highest page number wins.” Verify the same behavior for both `/infinite` and `/ssrm` when manually exercising throttled requests.

## 4. `selectionDisabled` / `readOnly`

1. Find rows rendered with `selectionDisabled` or `readOnly` interaction policy.
2. Confirm they cannot be selected through ordinary checkbox selection.
3. Confirm dataset-wide displayed counts may still include those rows because the current server counts describe query membership rather than exact selection eligibility.
4. Run a selected backend business action or selected export.
5. Confirm backend-ineligible rows are not acted on/exported.
6. Export a current page containing a restricted row and confirm that row **is** present because Current Page is a page snapshot rather than a selection-based operation.

Do not expect the server-wide UI count to subtract only disabled rows currently loaded in the browser.

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

## 6. Export Current Page

Run independently in `/infinite` and `/ssrm`.

1. Navigate to a known pagination page.
2. Click `Export current page`.
3. Open the downloaded CSV.
4. Confirm it contains only the current fully loaded page, not other cached/loaded rows.
5. If the page contains `selectionDisabled` or `readOnly` rows, confirm those rows are included.
6. Change page and export again; confirm the file follows the new page.
7. Trigger export while the page is unresolved/loading if practical; confirm the application refuses a partial export and shows the loading message.

## 7. Export Selected — explicit rows

Run independently in `/infinite` and `/ssrm`.

1. Select two or three eligible rows explicitly.
2. Click `Export selected`.
3. Confirm one `POST /api/transactions/selection/export/` request is made.
4. Open the CSV and confirm only those selected eligible rows are present.
5. Confirm a `selectionDisabled` / `readOnly` row cannot become part of normal explicit selection and backend eligibility still protects stale/crafted input.

## 8. Export Selected — All Filtered

Run independently in both row models using their All Filtered flow.

1. Apply a filter.
2. Select All Filtered.
3. Deselect at least one eligible row.
4. Click `Export selected`.
5. Confirm the request sends exclude-mode selection plus the current defining filters.
6. Confirm the CSV contains matching eligible filtered rows except the explicit deselection(s).
7. Confirm `selectionDisabled` / `readOnly` rows are not exported even if the visible selected total counts them through normal query counts.

## 9. Export Selected — All Records

Run independently in both row models using their All Records flow.

1. Select All Records.
2. Deselect at least one eligible row.
3. Click `Export selected`.
4. Confirm the request uses exclude mode without filtered context.
5. Confirm the CSV contains eligible records except the explicit deselection(s).
6. Confirm `selectionDisabled` / `readOnly` rows are not exported even though the All Records displayed count can include them.

## 10. Edit/conflict regression

Run these scenarios for both row models:

- ordinary dirty edit survives navigation/reload;
- REMOTE == BASE keeps LOCAL dirty;
- REMOTE == LOCAL auto-cleans the draft;
- REMOTE differs from BASE and LOCAL creates a conflict;
- Use server restores latest REMOTE;
- Keep my edit rebases BASE and keeps LOCAL dirty;
- row Save is blocked by unresolved conflicts;
- selected Save is blocked when the selected dirty set contains a conflict;
- field-aware selected business-action guard behaves correctly;
- Discard restores latest REMOTE;
- teardown/remount does not produce a destroyed-GridApi warning.

## Pass criteria

The server-backed manual regression is complete only when **Infinite and SSRM both pass independently**. A successful run of one row model does not prove the other.
