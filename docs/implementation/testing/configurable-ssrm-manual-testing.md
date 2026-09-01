# Configurable SSRM manual verification

Use this checklist for the isolated `/configurable-ssrm` Review route. This is a browser checklist, not a statement that the scenarios have already passed.

## Setup

1. Start the normal frontend/backend development flow documented by the repository.
2. Open `/configurable-ssrm`.
3. Open browser developer tools and keep Console visible.
4. Open Application/Storage → Local Storage for the current origin.
5. Know these development-only keys:

```text
aggrid.devAccessProfile
aggrid.devActiveEntity
```

Profile values currently supported:

```text
loanOnly
financeOnly
loanAndFinance
loanReadOnly
```

Entity values currently supported:

```text
loan
finance
```

After changing a value, reload the route.

## Default profile

1. Remove both keys from localStorage.
2. Reload `/configurable-ssrm`.
3. Confirm the displayed development profile is `loanAndFinance`.
4. Confirm both `loan` and `finance` are listed as available entities.
5. Confirm Loan is selected as the fallback first entity when no valid active entity is stored.

Pass criteria: missing/invalid localStorage does not crash the feature and the documented default profile is used.

## Same profile, different active entity

1. Set `aggrid.devAccessProfile = loanAndFinance`.
2. Set `aggrid.devActiveEntity = loan` and reload.
3. Confirm Loan headers: `Borrower`, `Principal`, `Loan status`, `Internal score`.
4. Confirm Finance-only headers such as `Facility` are absent.
5. Change only `aggrid.devActiveEntity = finance` and reload.
6. Confirm Finance headers: `Facility`, `Counterparty`, `Exposure`, `Currency`, `Review status`.
7. Confirm Loan-only headers such as `Borrower` are absent.

Pass criteria: one simulated current user can access both entities, while active-entity navigation is a separate choice from access-profile identity.

## Entity and field removal

1. Set `aggrid.devAccessProfile = loanOnly`.
2. Deliberately leave `aggrid.devActiveEntity = finance`.
3. Reload.
4. Confirm the route falls back to active entity `loan` because Finance is not available to this profile.
5. Confirm only `loan` is listed as available.
6. Confirm `Internal score` is absent even though it exists in the Loan base definition.
7. Confirm Finance fields are absent.

Pass criteria: inaccessible entities/fields are removed from the resolved configuration rather than merely visually hidden.

## Read-only projection

1. Set `aggrid.devAccessProfile = loanReadOnly` and `aggrid.devActiveEntity = loan`.
2. Reload.
3. Double-click Borrower, Principal and Loan status cells.
4. Confirm none enters edit mode.
5. Exercise paste/Fill Handle against those cells where practical and confirm read-only access is not bypassed.
6. Confirm edited row/cell counters remain zero.

Pass criteria: user-level `read` access is applied before AG Grid receives its final `ColDef.editable` behavior.

## Editable Loan validation and draft tracking

1. Set `aggrid.devAccessProfile = loanOnly` and `aggrid.devActiveEntity = loan`.
2. Reload.
3. Double-click `Borrower` in row `LN-1001`.
4. Clear the value and press Enter.
5. Confirm AG Grid keeps the invalid editor active because `invalidEditValueMode = block`.
6. Confirm dirty counts remain zero because invalid input has not committed.
7. Enter a non-empty Borrower and commit.
8. Confirm the value changes and dirty counts become one row / one cell.
9. Repeat with a negative/valid Principal value.

Pass criteria: access projection and configurable compilation still use AG Grid native validation before committed BASE + LOCAL draft tracking.

## Finance editability

1. Set `aggrid.devAccessProfile = financeOnly` and `aggrid.devActiveEntity = finance`.
2. Reload.
3. Confirm `Facility` and `Currency` are read-only.
4. Confirm `Counterparty`, `Exposure`, and `Review status` are editable.
5. Confirm the rows use Finance data (`FN-*`) rather than Loan data (`LN-*`).

Pass criteria: the same generic SSRM root handles a different row shape/entity configuration without Transaction- or Loan-specific branching.

## Local data-source boundary

1. Inspect Network while switching Loan and Finance.
2. Confirm this Review experiment does not invent Loan/Finance backend APIs.
3. Confirm the grid still behaves as SSRM, but current Review rows come from the documented FE-only local `GridRowsLoader` adapters.
4. Confirm sort/filter UI is not exposed for these local Review fields because those server semantics are not implemented by the local adapter.

Pass criteria: the access experiment does not falsely imply a backend query contract that does not exist.

## Negative lifecycle checks

1. Navigate away while the grid is mounted and return.
2. Switch profile/entity through localStorage and reload repeatedly.
3. Confirm no destroyed-GridApi warnings or uncaught page errors.

## Security interpretation

The localStorage values are only a development simulation. Do not treat them as authorization/security. A user can edit them freely. Future real authorization must be backend-authoritative and APIs must enforce access independently.

## Current deliberate omissions

Do not expect configurable Save/Discard controls, business actions, masking/unmask, backend user/profile APIs, row-specific authorization payloads, Grid State/access reconciliation, conflict reconciliation, or runtime schema/version negotiation on this route yet.

## Pass record

Record browser/OS, commit SHA, localStorage profile/entity combinations actually exercised, failures/console warnings, and whether Playwright also passed on the exact same SHA. Do not mark the checklist complete based only on unit tests or another SSRM route.
