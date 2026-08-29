# Selected Business Action — Post-Success Selection Lifecycle

This document records what happens to grid selection after a selected-row business action completes.

## Contract

Selection lifecycle after a business action is a **feature/action decision**, not a hidden shared-grid default.

Every selected mutation explicitly chooses one frontend-only policy:

```text
clear
preserve
```

The policy is applied **only after backend success**.

```text
request fails
-> keep current selection
-> user can inspect/retry without reconstructing the target

request succeeds + policy = clear
-> clear current selection using the owning row-model mechanic
-> refresh authoritative rows

request succeeds + policy = preserve
-> keep current selection
-> refresh authoritative rows
```

The policy is never serialized to the backend. The backend request continues to contain only:

```text
which rows were targeted
+
what business change should be applied
```

Checkbox lifecycle is frontend behavior.

## Current Transactions policy

The current selected status mutations all choose `clear`:

- Mark Completed;
- Mark Pending;
- Mark Failed.

These actions can change the visible/filter universe and row eligibility. Clearing after success avoids accidentally carrying an old logical selection into a newly changed dataset.

Selected export is non-mutating and remains a separate export capability. Export does **not** clear selection.

## Row-model ownership

The action chooses only `clear` or `preserve`. It does not know how a row model stores selection.

### Client-Side

Client selection is native AG Grid selection. `clear` uses native `GridApi.deselectAll()` through the Client selection controller.

### Infinite

Infinite has two ownership modes:

- page/manual selection -> native AG Grid explicit selection;
- filtered/all dataset selection -> compact application include/exclude state because unloaded rows have no RowNodes.

`clear` delegates to the Infinite selection controller, which clears the correct owner. Dataset-wide clearing does not enumerate or load missing server rows.

### SSRM

SSRM may have either:

- native server-side explicit/All Records state; or
- the project's custom All Filtered state.

`clear` delegates to the SSRM selection controller so both possible ownership models are reset correctly.

## Architecture rule

Do not create a universal post-action grid wrapper.

The reusable rule is only:

```text
action chooses clear/preserve
-> concrete row-model root delegates to its selection controller
```

A future Payables/Invoices/Orders action may choose a different policy without changing shared selection semantics.

## Focused automated coverage

Current focused coverage checks that:

- Transaction status actions explicitly request `clear`;
- the action policy is frontend-only and the backend request shape is unchanged;
- Client status mutation clears native selection after success;
- Client selected export preserves selection;
- Client explicit clear resets its renderable selected count/observer;
- Infinite page selection clears through native AG Grid;
- Infinite dataset-wide selection clears compact logical state without enumerating unloaded rows;
- existing SSRM clear-selection coverage continues to prove native/custom SSRM selection can be reset.

Manual browser regression remains part of the later consolidated verification pass and is not claimed complete here.
