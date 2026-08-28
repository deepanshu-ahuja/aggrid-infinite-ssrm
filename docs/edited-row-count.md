# Edited-row total

This document defines the user-visible **Edited** count for Infinite and SSRM.

## Meaning

`Edited` means the number of rows that currently have unsaved tracked changes.

It is a **dirty-row count**, not a dirty-cell count.

```text
one row, one changed field
-> Edited: 1

one row, three changed fields
-> Edited: 1

three dirty rows
-> Edited: 3
```

## Ownership

The count comes from application-owned tracked editing state, not from currently loaded AG Grid RowNodes.

That is required for server-backed row models because a dirty row can leave the current page and later be recreated while its unsaved draft must still exist.

Conceptually:

```text
tracked changesById
        ↓
number of row IDs with real dirty fields
        ↓
Edited: N
```

## When the count decreases

A row leaves the Edited total when its tracked dirty state is fully removed, including:

- successful Save acknowledgement;
- Discard;
- reverting all edited fields back to their authoritative value;
- server convergence where REMOTE becomes equal to LOCAL.

A row with an unresolved BASE/LOCAL/REMOTE conflict remains dirty and therefore remains in the Edited total until that dirty state is resolved or removed.

## Selected edited rows are a different number

The UI can also use the subset:

```text
all dirty rows
    ∩
current logical selection
```

This is used by Save Selected / Discard Selected.

Example:

```text
Edited total = 7
Selected rows = 100
Selected edited rows = 3
```

Those are three different concepts and should not be collapsed into one count.

## Why AG Grid loaded rows are not enough

AG Grid owns concrete loaded RowNodes. It does not own the product meaning of a durable unsaved draft that must survive Infinite/SSRM row recreation.

Therefore the edited total is intentionally derived from `useTrackedGridEditing(...)` state rather than from row traversal APIs.

See [Transaction editing](transaction-editing.md), [Unsaved edit conflict reconciliation](edit-conflict-reconciliation.md), and [Pre-Client manual testing](pre-client-manual-testing.md).
