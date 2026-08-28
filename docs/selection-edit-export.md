# Selection counts, edited totals, and export

This document records the current reusable behavior for Infinite Row Model and Server-Side Row Model (SSRM). It is intentionally explicit about what is exact today, what is approximate, and what a production backend may improve later.

## 1. Selected-row total

The displayed selected total must come from the same logical selection that backend actions use. Do not count only loaded RowNodes when the selection can represent unloaded server rows.

### Explicit / manual selection

Logical shape:

```text
include + [selected ids]
```

Count:

```text
selected = number of included ids
```

This is exact. Infinite reads the selected IDs from native AG Grid Grid State in page/manual mode. SSRM reads native flat server-side selection state and translates ordinary selection to explicit IDs.

### Current Page

Current Page acts on concrete rows from AG Grid's current pagination page. The page helper uses native pagination APIs and refuses to act on a partially loaded page.

The resulting selection is ordinary explicit/include IDs, so the selected total is exact.

### Select All Filtered

Logical shape:

```text
exclude + [user-deselected exception ids]
```

Current count:

```text
selected = filteredCount - exceptionCount
```

Infinite learns the accepted filtered result size from its completed row model. SSRM uses the accepted server-side displayed result size while the custom All Filtered semantic is active.

### Select All Records

Logical shape:

```text
exclude + [user-deselected exception ids]
```

Current count:

```text
selected = totalCount - exceptionCount
```

`totalCount` comes from the normal Transactions query response. No extra count-only request is made merely because the user selected all records.

## 2. Important selected-count limitation

The current API `totalCount` and `filteredCount` describe rows in the dataset/query, not rows eligible for checkbox selection.

Therefore a dataset-wide displayed count can include rows whose backend interaction policy is `selectionDisabled` or `readOnly`.

Example:

```text
totalCount = 750
Select All Records
UI selected total = 750
```

If 25 records are backend-ineligible, a selected business action or selected export may resolve only 725 eligible rows.

This is a deliberate foundation-stage limitation. Backend actions remain authoritative and never operate on ineligible rows.

### What we deliberately do NOT do

Do not subtract only disabled rows currently loaded in the browser.

For a server-backed dataset, the browser may know about 2 disabled rows while another 100 disabled rows are still unloaded. Returning `750 - 2 = 748` would look exact while being wrong.

### Future production option

If the product requires an exact actionable selected total, extend the normal backend response with eligibility-aware metadata, for example:

```text
selectionEligibleTotalCount
selectionEligibleFilteredCount
```

Then the same selection model can calculate:

```text
All Records  = selectionEligibleTotalCount - exceptions
All Filtered = selectionEligibleFilteredCount - exceptions
```

The include/exclude selection representation does not need to change.

## 3. Why the AG Grid built-in selected-row count is not the authority here

Native selected-row APIs remain preferred wherever they fully represent the semantic. However, Infinite and SSRM can represent selections whose rows are not all materialised in browser memory.

- Infinite dataset-wide filtered/all selection is application-owned because unloaded rows have no RowNode.
- SSRM native Select All Records is represented by server-side selection state; loaded selected row objects are not the complete selection.
- SSRM All Filtered is a custom product semantic in this foundation.

For those cases, the visible count is derived from logical selection + dataset/query total rather than `getSelectedRows().length`.

## 4. Total edited rows

`Edited` means **dirty rows with unsaved tracked changes**.

Examples:

```text
one row, one changed field   -> Edited: 1
one row, three changed fields -> Edited: 1
three dirty rows              -> Edited: 3
```

A conflicted row is still dirty, so it remains part of the edited-row total until its edit is discarded, converges with the server, or is successfully persisted.

The count comes from the tracked editing payload, not currently loaded RowNodes. This is important for Infinite/SSRM because RowNodes can be evicted and recreated while an unsaved draft still exists.

Count decreases when a dirty row is fully removed from tracked state, including:

- successful Save acknowledgement;
- Discard;
- editing/reverting back to the authoritative value;
- server convergence where REMOTE becomes equal to LOCAL.

Dirty **field** count is not a current product capability. It can be added separately later if a real UI needs it.

## 5. Export capability

The current baseline exposes:

```text
Export current page
Export selected
```

### Export current page

Current-page export is browser-side and uses AG Grid's native CSV export API.

The shared page helper first obtains exactly the concrete RowNodes on the current pagination page. If the page is partially loaded, export is refused rather than silently generating a partial file.

We do not write a custom frontend CSV serializer for this path. AG Grid remains responsible for CSV escaping and grid export behavior.

### Export selected

Selected export is backend-owned for Infinite and SSRM.

Reason: a logical selection can include thousands of rows that have never been loaded in the browser. Fetching every selected row into AG Grid just to create a file would defeat the server-backed row model.

Flow:

```text
current logical selection
        +
current defining filters when All Filtered
        ↓
POST /api/transactions/selection/export/
        ↓
backend resolves eligible selected rows
        ↓
CSV response
        ↓
browser download
```

The selection target builder is shared with selection-based mutation requests. This guarantees that `include`, filtered `exclude`, and all-record `exclude` mean the same thing for Export Selected and backend business actions.

The backend resolver also applies authoritative row eligibility. `selectionDisabled` and `readOnly` rows are not exported as selected rows even if the temporary displayed dataset-wide count includes them under the limitation described above.

### Export columns

The Transactions selected CSV currently contains:

- id
- reference
- account
- amount
- currency
- status
- transactionDate

Interaction-policy metadata is not exported because it is grid/application capability metadata rather than normal transaction data.

## 6. Future export decisions

Do not solve these speculatively. Decide them when a product needs them:

- CSV versus Excel;
- all filtered rows export independent of selection;
- visible columns versus fixed business export schema;
- formatted values versus raw values;
- very large asynchronous/streaming export jobs;
- progress/history/download links;
- permissions and audit requirements.

Client-Side Row Model should later provide the same user-facing export capability using its native/local ownership where all rows are already in browser memory. It should not inherit server-only selection-resolution machinery.

## 7. Manual verification

For both Infinite and SSRM verify independently:

1. manually select one, then several rows; selected total matches exact IDs;
2. Current Page selects only selectable page rows and reports the explicit count;
3. Select All Filtered reports filtered total minus manual exceptions;
4. Select All Records reports total count minus manual exceptions;
5. clear/deselect updates the count immediately;
6. create one dirty row with multiple changed fields; Edited remains 1;
7. create multiple dirty rows; Edited equals dirty-row count;
8. Save/Discard/convergence removes rows from Edited as expected;
9. Export current page downloads only the current fully loaded page;
10. Export selected works for explicit selection;
11. Export selected works for All Filtered with exceptions;
12. Export selected works for All Records with exceptions;
13. backend-ineligible rows are absent from selected export;
14. changing the defining filter clears filter-dependent Select All before a later selected export.
