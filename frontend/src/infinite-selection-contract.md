# Infinite Row Model Selection Contract

This document is the final source of truth for selection behaviour in our AG Grid **Infinite Row Model** tables.

It is intentionally scenario-based. A future developer should be able to answer:

> What did the user do, what does AG Grid do, what state do we keep, and what should the backend eventually receive?

without needing to reverse-engineer the implementation first.

---

## 1. Keep these two concepts separate

### UI selection mode

The UI configuration controls what the custom header checkbox does:

```text
page
filtered
all
```

### Logical selection representation

Application selection state contains only:

```text
include
exclude
```

with IDs.

The logical selection object is:

```ts
{
  mode: 'include' | 'exclude',
  ids: string[],
}
```

Do **not** put `page`, `filtered`, `all`, or `explicit` into that logical selection object.

---

## 2. The two neutral-looking states mean very different things

This distinction is critical.

### `include + []`

```ts
{
  mode: 'include',
  ids: [],
}
```

means:

> Nothing is selected.

### `exclude + []`

```ts
{
  mode: 'exclude',
  ids: [],
}
```

means:

> Select All is active; there are currently no exceptions.

These states must never be treated as interchangeable.

---

## 3. `include` means exact selected IDs

Example:

```text
include [A, B, E]
```

means:

```text
A selected
B selected
E selected
everything else not selected
```

Use `include` for:

- one row checkbox;
- multiple manually selected rows;
- current-page header selection;
- explicit selections accumulated across pagination pages;
- manual selection while the UI is configured as `filtered`;
- manual selection while the UI is configured as `all`.

The UI configuration does not change the meaning of manual selection.

---

## 4. `exclude` means dataset Select All is active

Example:

```text
exclude []
```

means every record in the owning Select-All dataset is selected.

Example:

```text
exclude [A]
```

means every record in that dataset except A is selected.

The owning UI strategy tells us which dataset Select All represents:

```text
filtered
→ all rows matching the defining backend filter

all
→ all records
```

We deliberately do not duplicate that UI strategy inside the logical selection object.

---

# 5. Page mode

UI configuration:

```text
selectionScope = 'page'
```

The word `page` describes only the header checkbox.

Example:

```text
Page 1 contains A B C D
user clicks page header
→ include [A, B, C, D]
```

User moves to Page 2 and manually selects E:

```text
→ include [A, B, C, D, E]
```

Selection can therefore contain IDs from many pages.

If Page 2 contains E F G H and the user unchecks the Page 2 header:

```text
remove selected IDs belonging to Page 2
preserve selected IDs from other pages
```

There is no dataset-level `exclude` representation in page mode.

`page + exclude` is considered an invalid application state.

---

# 6. Filtered mode without Select All

UI configuration:

```text
selectionScope = 'filtered'
```

User applies:

```text
Status = Completed
```

Then manually selects A and B.

Logical selection:

```text
include [A, B]
```

If the user changes the visible filter:

```text
preserve A and B
```

Why?

Because the user explicitly selected those IDs. They did not select an entire filtered dataset.

---

# 7. Select All Filtered

Active applied filter:

```text
Status = Completed
Amount > 5000
```

User clicks Select All Filtered.

Logical state becomes:

```text
exclude []
```

Meaning:

> All rows matching the applied backend filter are selected.

If the user unchecks A:

```text
exclude [A]
```

Meaning:

> All rows matching the defining filter except A.

The browser does not need to download every selected ID.

---

# 8. Filter changes after Select All Filtered

Old state:

```text
filter = Status = Completed
selection = exclude [A]
```

The user changes the filter to:

```text
Status = Failed
```

The correct reset is:

```text
include []
```

Meaning:

> Nothing is selected.

It must **not** reset to:

```text
exclude []
```

because `exclude []` means Select All is active. That would automatically select the entire new filtered dataset even though the user did not click Select All again.

Therefore:

```text
filtered + include
filter changes
→ preserve explicit IDs

filtered + exclude
filter changes
→ reset to include []
```

The user must click Select All Filtered again if they want the new filtered dataset selected.

---

# 9. All-records mode

UI configuration:

```text
selectionScope = 'all'
```

Manual selection still uses:

```text
include [A, B]
```

User clicks Select All Records:

```text
exclude []
```

User unchecks A:

```text
exclude [A]
```

Changing the visible filter must preserve this selection.

Why?

The visible filter changes what the user is looking at. It does not redefine the meaning of "all records".

---

# 10. Individual row checkbox behaviour

## Include mode

```text
include [A, B]

check C
→ include [A, B, C]

uncheck A
→ include [B, C]
```

## Exclude mode

```text
exclude []

uncheck A
→ exclude [A]

check A again
→ exclude []
```

In exclude mode the IDs are exceptions, not selected IDs.

---

# 11. Sorting

Sorting never clears selection.

We give AG Grid stable row identity:

```ts
getRowId={({ data }) => data.id}
```

Sorting changes position, not identity.

Therefore:

```text
include → preserve
exclude → preserve
```

---

# 12. Pagination

Pagination never clears logical selection.

Example:

```text
Page 1: select A
Page 2: select E
→ include [A, E]
```

When A appears again, its checkbox is restored from application selection state.

---

# 13. Infinite cache eviction and block reload

AG Grid Infinite Row Model does not keep every RowNode forever.

Example:

```text
TX-100 is selected
AG Grid evicts its block from browser memory
```

Application selection still remembers TX-100.

Later:

```text
AG Grid reloads block containing TX-100
→ new RowNode appears
→ table asks isRowSelected('TX-100')
→ checkbox is restored
```

Selection lifetime is intentionally independent from RowNode/cache lifetime.

---

# 14. Newly loaded rows after dataset Select All

Example:

```text
Select All Filtered
→ exclude []
```

Only a small number of rows may currently be loaded.

When another Infinite block arrives:

```text
new RowNode
→ ask logical selection whether ID is selected
→ programmatically sync checkbox
```

A new matching row therefore appears selected even though it did not exist in browser memory when the user clicked Select All.

---

# 15. Programmatic checkbox synchronisation

Application state sometimes needs to restore AG Grid checkbox state.

Conceptually:

```text
application selection
→ node.setSelected(..., 'api')
→ AG Grid emits rowSelected with source='api'
→ our rowSelected handler ignores it
```

Why ignore it?

Otherwise:

```text
application state
→ checkbox sync
→ AG Grid event
→ application state update
→ checkbox sync
→ ...
```

could become a feedback loop.

Real user checkbox events are still processed normally.

---

# 16. Initial Infinite lifecycle

Simplified flow:

```text
React renders table
→ AG Grid initializes
→ onGridReady stores GridApi
→ Infinite datasource requests block
→ backend returns rows + totalCount
→ AG Grid creates/updates RowNodes
→ onModelUpdated
→ update current-page IDs
→ restore loaded checkbox state
```

Normal grid loading does not clear logical selection.

---

# 17. Filtered total

Filtered Select All needs the number of rows in AG Grid's current accepted Infinite model.

We do not let arbitrary overlapping datasource responses directly define this selection total.

On filter change:

```text
old total is no longer valid
→ temporarily reset filtered total
→ new Infinite model loads
→ AG Grid knows current last row
→ publish current total
```

This prevents an older request from making the header describe the wrong filtered dataset.

---

# 18. Error and retry behaviour

Grid row-loading failure uses AG Grid's grid-level error presentation.

For Infinite Row Model retry, the application calls:

```ts
api.refreshInfiniteCache();
```

Expected user flow:

```text
backend/data request fails
→ grid shows error overlay
→ user restores connectivity/backend
→ user clicks Retry
→ Infinite cache reloads
→ rows render again
→ error state clears
```

Selection must not be blindly cleared merely because a request failed or a block reloads.

Supporting selection requests can fail independently from row loading. For example, the all-record total-count request can fail while visible grid rows still load. That supporting error is therefore presented separately rather than replacing the entire grid.

---

# 19. Clear-selection lifecycle table

| Event                   | Page/include        | Filtered/include     | Filtered/exclude        | All/include          | All/exclude        |
| ----------------------- | ------------------- | -------------------- | ----------------------- | -------------------- | ------------------ |
| Individual row click    | update ID           | update ID            | update exception        | update ID            | update exception   |
| Current-page header     | add/remove page IDs | n/a                  | n/a                     | n/a                  | n/a                |
| Select All Filtered     | n/a                 | switch to exclude [] | already Select All      | n/a                  | n/a                |
| Select All Records      | n/a                 | n/a                  | n/a                     | switch to exclude [] | already Select All |
| Pagination              | preserve            | preserve             | preserve                | preserve             | preserve           |
| Sort change             | preserve            | preserve             | preserve                | preserve             | preserve           |
| Filter change           | preserve            | preserve             | **reset to include []** | preserve             | preserve           |
| Cache eviction          | preserve            | preserve             | preserve                | preserve             | preserve           |
| Block reload            | preserve            | preserve             | preserve                | preserve             | preserve           |
| Data retry              | preserve            | preserve             | preserve                | preserve             | preserve           |
| New block loads         | sync checkbox       | sync checkbox        | sync checkbox           | sync checkbox        | sync checkbox      |
| Deliberate clear action | clear               | clear                | clear                   | clear                | clear              |

---

# 20. Backend action timing

Selection changes do not themselves execute a backend bulk action.

```text
select row
→ no bulk action call

change page
→ no bulk action call

click Select All
→ no bulk action call

exclude a row
→ no bulk action call
```

The real backend action happens only when the user explicitly invokes something such as:

```text
Export
Delete
Approve
Update
```

---

# 21. Shared bulk-selection builder

Shared code provides:

```ts
buildGridBulkSelection(...)
```

This produces the selection/query portion of a future backend action request.

The builder requires filters to be supplied explicitly for exclude selection.

That is a safety requirement.

We do not silently default missing filters to `[]`, because:

```text
filters = []
```

has a real meaning:

> the complete unfiltered dataset.

A forgotten filtered query must never accidentally widen an action from "all filtered rows" to "all records".

---

# 22. Transactions-specific bulk-selection builder

Transactions code provides:

```ts
buildTransactionBulkSelection(...)
```

It applies these rules:

## Manual/current-page/include

```json
{
  "mode": "include",
  "ids": ["A", "B"]
}
```

Exact IDs define membership. Filters are not attached.

## Select All Filtered

Logical selection:

```text
exclude [A]
```

plus AG Grid's applied filter model.

The filter model is translated through:

```ts
mapTransactionFilterModel(...)
```

which is the same mapper used by normal row loading.

Result:

```json
{
  "mode": "exclude",
  "ids": ["A"],
  "filters": [
    {
      "field": "status",
      "operator": "equals",
      "value": "Completed"
    }
  ]
}
```

Meaning:

> all matching backend rows except A.

## Select All Records

```json
{
  "mode": "exclude",
  "ids": ["A"],
  "filters": []
}
```

Meaning:

> all records except A.

## Invalid page + exclude

Page mode cannot legitimately produce dataset-level exclude selection.

If this state somehow reaches the Transactions builder, it fails loudly instead of silently interpreting it as a dataset-wide action.

---

# 23. Reusing the Transaction filter mapper

Never create a second filter translator for bulk actions.

Normal row loading:

```text
AG Grid FilterModel
→ mapTransactionFilterModel(...)
→ backend TransactionFilter[]
```

Filtered bulk action:

```text
AG Grid FilterModel
→ mapTransactionFilterModel(...)
→ backend TransactionFilter[]
```

Both must use the exact same mapping code.

This prevents normal grid results and bulk-action membership from disagreeing.

---

# 24. Temporary Preview bulk payload control

During development we keep a validation control:

```text
Preview bulk payload
```

Its purpose is to prove the complete browser flow before a real bulk-action endpoint exists.

Clicking it:

```text
current logical selection
+
current UI strategy
+
current applied AG Grid filter model
→ buildTransactionBulkSelection(...)
→ display JSON
```

It does **not**:

```text
delete anything
update anything
export anything
call a bulk backend endpoint
```

The preview is a snapshot.

If the user changes selection or filters after previewing, the old preview is cleared so stale JSON cannot be mistaken for current state.

This control can remain while bulk-action development is ongoing. Remove or hide it once real product actions replace its validation purpose.

---

# 25. Browser scenarios already expected

## Page

```text
select rows across multiple pages
→ preview = include + all exact selected IDs
```

## Filtered/manual

```text
apply filter
manually select rows
change filter
→ explicit IDs remain
→ preview = include + IDs
```

## Filtered Select All

```text
apply filter
click Select All Filtered
uncheck A
→ preview = exclude [A] + mapped filters
```

## Filter changes after filtered Select All

```text
filtered exclude active
change filter
→ reset to include []
→ user must click Select All again for the new filter
```

## All Records

```text
click Select All Records
uncheck A
change visible filter
→ selection remains
→ preview = exclude [A] + filters []
```

## Sort/pagination/cache reload

Selection remains logically intact and loaded checkboxes are restored from stable row IDs.

---

# 26. Required regression coverage

The Infinite selection work is expected to cover:

1. Manual row selection emits include + exact IDs.
2. Current-page header changes only current-page IDs.
3. Selections accumulate across pages.
4. Pagination preserves selection.
5. Sorting preserves selection.
6. Filtered/include preserves explicit selection when filters change.
7. Select All Filtered switches to exclude [].
8. Unchecking under Select All Filtered adds an exception.
9. Filtered/exclude filter change emits exactly include + [].
10. Select All Records switches to exclude [].
11. All/exclude survives visible filter changes.
12. Logical selection contains no redundant UI scope.
13. Newly loaded blocks restore checkbox state.
14. Cache eviction/reload does not destroy logical selection.
15. API-originated checkbox sync does not feed back into selection state.
16. Filtered total follows AG Grid's current accepted model.
17. Shared bulk-selection builder distinguishes include from exclude/query selection.
18. Transactions bulk builder reuses the normal backend filter mapper.
19. Page + exclude is rejected as invalid.
20. Payload preview composes real selection + filter context without calling a bulk endpoint.

---

# 27. Rules for future developers and coding assistants

When modifying Infinite selection:

1. Separate UI mode (`page | filtered | all`) from logical selection (`include | exclude`).
2. Remember: `include []` means nothing selected.
3. Remember: `exclude []` means Select All active.
4. Manual row selection is always include.
5. Current-page header is only an include shortcut over visible page IDs.
6. Dataset Select All uses exclude.
7. Never clear selection merely because sorting changed.
8. Never clear explicit include selection merely because filtering changed.
9. Reset filtered/exclude to include [] when its defining filter changes.
10. Preserve all/exclude across visible filter changes.
11. Preserve logical selection across pagination, cache eviction, block reload, and retry.
12. Use stable row IDs.
13. Let AG Grid own loaded RowNodes and checkbox rendering.
14. Keep application state only for selection intent Infinite Row Model cannot represent across unloaded rows.
15. Reuse the same backend filter mapper for normal loading and filtered bulk actions.
16. Do not silently default missing exclude-query filters to an unfiltered dataset.
17. Prefer native AG Grid APIs/events before adding custom lifecycle state.
18. Document WHY any new reset or lifecycle rule exists.
