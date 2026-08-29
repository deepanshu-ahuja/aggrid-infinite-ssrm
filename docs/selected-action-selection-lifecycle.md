# Selected Business Action — Selection Lifecycle

This document records the current rule for selection when a selected-row business mutation completes.

## Current rule

Do not introduce a configurable `clear` / `preserve` policy when an action's behavior is already known in normal frontend code.

The current Transaction Change Status action family always clears its successful target:

```text
Mark Completed / Mark Pending / Mark Failed
        ↓
one Change Status mutation family
        ↓
backend update succeeds
        ↓
call the current row model's existing clearSelection()
        ↓
refresh authoritative rows
```

If the request fails, the success callback does not run, so the current selection remains available for inspection/retry.

Selected export is non-mutating and therefore simply does not clear selection.

## Business mutation ownership

A business mutation owns its own endpoint and payload. Selection lifecycle does not choose the API.

For example, future actions may be completely separate mutations:

```text
Change Status -> status/update endpoint
Approve       -> approval endpoint
Assign Owner  -> assignment endpoint
```

Each action can directly call `clearSelection()` on success if that action requires clearing. An action that should preserve selection does nothing to selection.

Do not build one generic mutation executor merely to route unrelated endpoints.

## Row-model ownership

`clearSelection()` is a shared semantic name, not one implementation covering every row model.

### Client-Side

The Client selection controller clears native AG Grid selection with `GridApi.deselectAll()` and resets its renderable count/observer.

### Infinite

The Infinite selection controller knows whether selection is:

- page/manual native AG Grid state; or
- filtered/all compact application state for unloaded rows.

Its `clearSelection()` clears the correct owner without enumerating unloaded server rows.

### SSRM

The SSRM selection controller clears both possible ownership paths correctly:

- native server-side selection state; and
- the project's custom All Filtered state.

A feature root should call the controller's `clearSelection()` rather than reproducing those mechanics.

## Config-driven actions later

If a future configurable action system genuinely needs selectable behavior, configuration may use a safe behavior key resolved through a frontend registry, for example:

```text
configuration key
    ↓
frontend behavior registry
    ↓
existing executable behavior such as clearSelection
```

That registry should be introduced only when actions are actually configuration-driven. Do not add an `if/else` policy layer or no-op preserve handler to hardcoded actions merely because multiple behaviors are theoretically possible.

## Focused automated coverage

Current focused coverage checks that:

- status buttons emit only the chosen status value;
- the selected Transaction mutation sends only the real backend request;
- the success callback runs only after backend success;
- Client successful status update clears native selection and refreshes data;
- Infinite successful status update clears through the Infinite controller and refreshes data;
- SSRM successful status update clears through the SSRM controller and refreshes data;
- Client selected export does not clear selection;
- row-model-specific selection-controller tests continue to cover their own clear mechanics.

Manual browser regression remains part of the later consolidated verification pass and is not claimed complete here.
