# Edited-Row Total

`Edited` is the number of rows that currently have unsaved tracked changes.

It is a dirty-row count, not a dirty-cell count.

```text
one row, one changed field
→ Edited: 1

one row, three changed fields
→ Edited: 1

three dirty rows
→ Edited: 3
```

## Ownership

The count comes from application-owned stable-ID tracked editing state, not from currently visible/loaded AG Grid RowNodes.

Conceptually:

```text
tracked changesById
        ↓
rows with real unsaved fields
        ↓
Edited: N
```

That ownership works across all three row models:

- Client can replace `rowData` objects when authoritative Query data changes;
- Infinite can evict/recreate RowNodes as cache blocks change;
- SSRM can recreate RowNodes/store data during refresh.

The dirty-row total must not disappear merely because a concrete row object/RowNode was replaced.

## When the count decreases

A row leaves the Edited total when its tracked dirty state is fully removed, including:

- successful Save acknowledgement of the submitted dirty values;
- Discard;
- manually returning all ordinary dirty fields to BASE;
- authoritative convergence where REMOTE equals LOCAL and the field auto-cleans.

A row with an unresolved BASE/LOCAL/REMOTE conflict remains dirty and therefore remains in the Edited total until that dirty state is resolved or removed.

## Selected edited rows are a different number

The UI also derives:

```text
all dirty rows
    ∩
current logical selection
```

This subset is used by Save Selected / Discard Selected.

Example:

```text
Edited total = 7
Selected rows = 100
Selected edited rows = 3
```

Those are distinct concepts and should not be collapsed into one count.

## Implementation source

`useTrackedGridEditing(...)` builds the current tracked update payload. `editedRowCount` is the number of dirty row updates in that payload.

The count is therefore independent of current pagination position, cache residency and selection.
