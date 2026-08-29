# Selected Business Action — Selection Lifecycle

This document describes the **current implemented** selection lifecycle for the Transactions selected-row business action.

It is an implementation reference, not a roadmap or a record of discarded designs.

## Current action

The current selected-row business action is one **Change Status** mutation family:

```text
Mark Completed
Mark Pending
Mark Failed
```

Those controls differ only by the status value they send. They use the same backend mutation path.

Current flow:

```text
current logical selection
        ↓
Change Status request
        ↓
PATCH /api/transactions/selection/
        ↓
backend succeeds
        ↓
current grid root calls its existing clearSelection()
        ↓
refresh authoritative rows
```

The backend request contains only the business target and requested status change. Selection clearing is frontend lifecycle behavior and is not serialized to the backend.

## Mutation ownership

`useTransactionSelectionAction(...)` owns the request/pending/error lifecycle for the current Transaction Change Status mutation.

It does not choose between unrelated business endpoints. A different business operation would own its own feature mutation/API contract.

The success callback is invoked only after the backend update succeeds.

## Row-model ownership of `clearSelection()`

`clearSelection()` is a common semantic name, not one implementation shared by every row model.

### Client-Side

`useClientSideSelectionController()` clears native AG Grid selection with `GridApi.deselectAll()` and updates the controller's selected-count/observer state.

### Infinite

`useInfiniteSelectionController()` clears whichever selection owner is active:

- native page/manual selection; or
- compact application-owned filtered/all dataset selection.

The feature root does not reproduce those mechanics.

### SSRM

`useSsrmSelectionController()` clears both relevant ownership paths:

- native SSRM server-side selection state; and
- custom All Filtered state.

The feature root delegates to that controller instead of manipulating the two states itself.

## Failure behavior

If Change Status fails:

```text
backend request fails
→ success callback does not run
→ clearSelection() is not called
→ existing selection remains available
```

This lets the user inspect or retry the same target.

## Non-mutating selected export

Selected export does not change Transaction data, so it does not clear selection.

Client Selected export is local/native. Infinite and SSRM Selected export use the backend selection resolver because their selected universe may include unloaded rows.

## Focused automated coverage

Current tests verify that:

- status controls emit only the chosen status value;
- the mutation hook sends the actual backend request without a selection-lifecycle value;
- the success callback runs only after backend success;
- Client successful status update clears through the Client selection controller and refetches authoritative data;
- Infinite successful status update clears through the Infinite selection controller and refreshes its cache;
- SSRM successful status update clears through the SSRM selection controller and refreshes the server-side store;
- failed status updates do not clear selection;
- Client Selected export leaves selection unchanged;
- row-model-specific controller tests cover their own clear mechanics.

Manual browser verification remains tracked separately and is not claimed complete by this document.
