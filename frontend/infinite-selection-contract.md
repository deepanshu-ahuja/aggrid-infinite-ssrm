# Infinite Row Model Selection Contract

This document is the source of truth for selection behaviour in our AG Grid **Infinite Row Model**
tables.

The goal is to make every lifecycle decision understandable even to a developer who has not worked
deeply with AG Grid.

---

## 1. Two concepts that must remain separate

### UI selection mode

This controls what the custom header checkbox does:

```text
page
filtered
all
```

### Logical selection representation

This describes what is selected:

```text
include
exclude
```

Do not copy the UI mode into the logical selection object.

---

## 2. Logical selection object

The application publishes only:

```ts
{
  mode: 'include' | 'exclude',
  ids: string[],
}
```

There is deliberately no:

```text
scope: page
scope: explicit
scope: filtered
scope: all
```

Why?

Because manual selection means the same thing regardless of UI configuration.

Example:

```text
User manually selects A and B
```

Logical selection:

```ts
{
  mode: 'include',
  ids: ['A', 'B'],
}
```

That is true whether the header UI is configured as `page`, `filtered`, or `all`.

---

## 3. `include` means exact selected IDs

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

Use include for:

- individual row checkbox selection;
- multiple manual row selections;
- current-page header selection;
- explicit selections accumulated across pagination pages;
- manual selection inside filtered mode before Select All Filtered;
- manual selection inside all mode before Select All Records.

---

## 4. `exclude` means dataset Select All is active

```text
exclude []
```

means every row in the Select-All dataset is selected.

```text
exclude [A]
```

means every row in that dataset except A is selected.

The owning UI strategy tells us which dataset Select All represents:

```text
filtered strategy
→ all rows matching the defining filter

all strategy
→ all records
```

We do not duplicate that information into the logical selection object.

---

## 5. Current-page mode

UI configuration:

```text
page
```

The header acts only on current-page IDs.

Example:

```text
Page 1 = A B C D
click page header
→ include [A, B, C, D]

move to Page 2
manually select E
→ include [A, B, C, D, E]
```

Selections are not restricted to one page.

If Page 2 contains E F G H and the user unchecks the Page 2 header:

```text
remove E/F if selected
preserve A/B/C/D
```

Pagination changes visibility, not logical selection.

---

## 6. Filtered mode without Select All

UI configuration:

```text
filtered
```

User manually selects A and B:

```text
include [A, B]
```

If the filter changes:

```text
preserve [A, B]
```

Why?

Those are explicit IDs. The user did not ask for dataset-level Select All.

---

## 7. Select All Filtered

Active backend filter:

```text
Status = Completed
Amount > 5000
```

User clicks Select All Filtered:

```text
exclude []
```

Meaning:

```text
all rows matching that defining filter are selected
```

User unchecks A:

```text
exclude [A]
```

Meaning:

```text
all rows matching the defining filter except A
```

The logical selection object still contains only mode + IDs.

The filtered UI strategy/query context is owned separately.

---

## 8. Filter changes while Select All Filtered is active

Old state:

```text
filter = Status = Completed
exclude [A]
```

User changes filter to:

```text
Status = Failed
```

Clear selection:

```text
include []
```

Why?

The old exclusion list belonged to a different selected dataset. We must not silently reinterpret
those exclusions against the new query.

This is the only automatic filter-driven clear rule.

---

## 9. All-records mode

UI configuration:

```text
all
```

Manual selection:

```text
include [A, B]
```

Select All Records:

```text
exclude []
```

Uncheck A:

```text
exclude [A]
```

Changing the visible grid filter does NOT clear all-record selection.

Why?

The visible filter controls what the user is looking at. It does not redefine "all records".

---

## 10. Individual row checkbox behaviour

### Include mode

```text
include [A, B]
check C
→ include [A, B, C]

uncheck A
→ include [B, C]
```

### Exclude mode

```text
exclude []
uncheck A
→ exclude [A]

check A again
→ exclude []
```

In exclude mode IDs are exceptions.

---

## 11. Sorting

Sorting never clears selection.

Stable AG Grid identity is provided through:

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

## 12. Pagination

Pagination never clears logical selection.

Example:

```text
Page 1: select A
Page 2: select E
→ include [A, E]
```

Returning to Page 1 restores A's checkbox from application selection state.

---

## 13. Infinite cache eviction

AG Grid can evict RowNodes/blocks from browser memory.

Example:

```text
TX-100 selected
AG Grid evicts its block
```

Logical application selection still remembers TX-100.

When AG Grid loads TX-100 again, the table asks:

```text
isRowSelected('TX-100')?
```

and restores the checkbox.

Cache lifetime and selection lifetime are separate.

---

## 14. New blocks after Select All

Example:

```text
Select All Filtered
→ exclude []
```

Only 50 rows may currently be loaded.

Later another block arrives.

Each new RowNode is checked against logical selection:

```text
new RowNode
→ isRowSelected(id)
→ node.setSelected(...)
```

Therefore newly loaded rows appear selected without downloading every selected ID.

---

## 15. Programmatic checkbox synchronisation

When application selection restores an AG Grid checkbox, it uses an API-originated selection source.

Conceptually:

```text
application selection changes
→ programmatically update RowNode checkbox
→ AG Grid emits rowSelected source='api'
→ our handler ignores source='api'
```

This prevents a feedback loop.

Real user checkbox events still update application selection.

---

## 16. Initial grid lifecycle

```text
React renders
→ AG Grid initializes
→ onGridReady stores GridApi
→ Infinite datasource loads a block
→ backend returns rows + totalCount
→ AG Grid creates/updates RowNodes
→ onModelUpdated
→ update current-page IDs
→ synchronise loaded checkboxes
```

Initial loading itself does not clear logical selection.

---

## 17. Filtered total

Filtered Select All needs the total number of rows in AG Grid's current accepted Infinite model.

Do not let an arbitrary older async response overwrite that total.

On filter change:

```text
old filtered total becomes invalid
→ temporarily reset
→ new Infinite model loads
→ AG Grid knows final last row
→ publish current displayed total
```

---

## 18. Clear-selection lifecycle table

| Event | Page/include | Filtered/include | Filtered/exclude | All/include | All/exclude |
|---|---|---|---|---|---|
| Individual row click | update ID | update ID | update exception | update ID | update exception |
| Current-page header | add/remove page IDs | n/a | n/a | n/a | n/a |
| Select All Filtered | n/a | switch to exclude [] | already Select All | n/a | n/a |
| Select All Records | n/a | n/a | n/a | switch to exclude [] | already Select All |
| Pagination | preserve | preserve | preserve | preserve | preserve |
| Sort change | preserve | preserve | preserve | preserve | preserve |
| Filter change | preserve | preserve | **CLEAR** | preserve | preserve |
| Cache eviction | preserve | preserve | preserve | preserve | preserve |
| Block reload | preserve | preserve | preserve | preserve | preserve |
| New block loads | sync checkbox | sync checkbox | sync checkbox | sync checkbox | sync checkbox |
| Deliberate clear action | clear | clear | clear | clear | clear |

Key rule:

> Filter changes clear selection only when Select All Filtered is active (`filtered + exclude`).

---

## 19. Backend call timing

Selection changes do not execute the bulk action.

```text
select rows
→ no bulk action call

change page
→ no bulk action call

click Select All
→ no bulk action call

exclude a row
→ no bulk action call
```

A backend bulk-action call happens only after the user clicks an actual action:

```text
Export
Delete
Approve
Update
...
```

---

## 20. Bulk-selection payload builder

Shared code now provides a pure `buildGridBulkSelection(...)` helper.

It converts logical selection into the selection portion of a future backend bulk-action request.
The helper does **not** call the backend and does **not** read AG Grid state.

The feature/action layer must explicitly supply backend filters when building the payload. This is
intentional: silently defaulting missing filters to `[]` could accidentally widen "all filtered"
into "all records".

The builder uses logical selection plus backend filter context.

### Exact/manual selection

Logical state:

```json
{
  "mode": "include",
  "ids": ["A", "B", "E"]
}
```

Action meaning:

```text
operate on exactly A, B, E
```

No filters are required to define membership.

### Select All Filtered

Logical state:

```json
{
  "mode": "exclude",
  "ids": ["A"]
}
```

Action builder additionally supplies the defining backend filters:

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

```text
all matching rows except A
```

### Select All Records

Logical state:

```json
{
  "mode": "exclude",
  "ids": ["A"]
}
```

Action builder uses an unfiltered dataset:

```json
{
  "mode": "exclude",
  "ids": ["A"],
  "filters": []
}
```

Meaning:

```text
all records except A
```

The final backend request does not need a redundant `scope` field if query context already defines
the dataset.

---

## 21. Why the Transaction filter mapper remains necessary

AG Grid owns its own filter-model shape.

Our backend uses a different filter contract.

Normal row loading already does:

```text
AG Grid filter model
→ mapTransactionFilterModel(...)
→ backend filters
```

A Select-All-Filtered bulk action must reuse that exact same conversion before passing filters to
`buildGridBulkSelection(...)`.

Do not create a second filter translator.

This does NOT mean clicking Select All calls the backend action API. The mapper is reused only when
the application later needs to build the real action request.

---

## 22. Required regression tests

1. Manual row selection emits include + exact IDs.
2. Current-page header adds/removes only current-page IDs.
3. Explicit IDs survive pagination.
4. Explicit IDs survive sorting.
5. Explicit IDs survive filtering.
6. Filtered/include survives filter change.
7. Select All Filtered switches to exclude [].
8. Unchecking after Select All Filtered adds an exclusion.
9. Filtered/exclude clears when filter changes.
10. Select All Records switches to exclude [].
11. All/exclude survives visible filter changes.
12. Logical selection output does not contain UI scope.
13. Filtered and all manual selection emit the same include shape.
14. Newly loaded Infinite blocks restore checkbox state.
15. Cache eviction/reload does not destroy logical selection.
16. API-originated checkbox sync does not create a feedback loop.
17. Filtered total comes from AG Grid's current accepted model.
18. Shared bulk-selection builder omits filters for include selection.
19. Shared bulk-selection builder requires explicit filters for exclude selection.
20. Select All Records is represented by exclude + explicit `filters: []`.
21. Future Transactions bulk action reuses the same Transaction filter mapper as normal loading.

---

## 23. Rule for future developers and coding assistants

When modifying Infinite selection:

1. Separate UI mode (`page | filtered | all`) from logical representation (`include | exclude`).
2. Never add UI scope to logical selection merely to describe how the user arrived there.
3. Manual row selection is always include.
4. Current-page header is an include shortcut over current-page IDs.
5. Dataset Select All switches to exclude.
6. Never clear selection on sorting.
7. Never clear explicit include selection merely because filtering changed.
8. Clear filtered/exclude when its defining filter changes.
9. Preserve all/exclude across visible filter changes.
10. Preserve selection across pagination/cache/block reloads.
11. Use stable row IDs.
12. Let AG Grid own loaded RowNodes and checkbox rendering.
13. Keep application state only for logical selection AG Grid Infinite cannot represent across unloaded rows.
14. Reuse the same backend filter mapper for row loading and filtered bulk actions.
15. Document WHY any new lifecycle reset exists before adding it.
