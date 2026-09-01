# Configurable SSRM manual verification

Use this checklist for `/configurable-ssrm`. It documents scenarios to run; it is **not** a statement that the scenarios have already passed.

## Setup

1. Start the normal frontend/backend development flow documented by the repository.
2. Open `/configurable-ssrm`.
3. Keep browser Console and Network visible.
4. Open Application/Storage → Local Storage for the current origin.
5. Development-only keys:

```text
aggrid.devAccessProfile
aggrid.devActiveEntity
```

Supported profiles:

```text
loanOnly
financeOnly
transactionOnly
loanAndFinance
allEntities
loanReadOnly
loanRestricted
```

Supported active entities:

```text
loan
finance
transaction
```

Default profile when missing/invalid:

```text
allEntities
```

After changing a value, reload the route.

## Default/all-entity projection

1. Remove both localStorage keys.
2. Reload `/configurable-ssrm`.
3. Confirm displayed profile is `allEntities`.
4. Confirm available entities are `loan, finance, transaction`.
5. Confirm Loan is the fallback first entity when no active entity is stored.
6. Confirm the grid renders without page errors.

Pass criteria: missing/invalid development selectors do not crash the feature and the default profile resolves all three entities.

## Loan backend/runtime

1. Set profile `allEntities`, active entity `loan`, then reload.
2. Confirm Loan columns include `Borrower`, `Principal`, `Currency`, `Loan status`, `Origination date`, `Region`, and `Internal score`.
3. Confirm rows use stable IDs such as `LN-1000`.
4. In Network, confirm loading uses:

```text
POST /api/review/loans/query/
```

5. Inspect the request and confirm Loan uses the flat contract:

```text
offset
limit
sort
filters
```

6. Sort an enabled Loan column and confirm the next request contains the expected Loan field/direction.
7. Apply a supported simple filter and confirm the request contains the mapped Loan filter field/operator/value.

Pass criteria: Loan sort/filter semantics are executed through the Loan adapter/backend, not inferred directly by the generic grid.

## Finance backend/runtime is intentionally different

1. Set profile `allEntities`, active entity `finance`, then reload.
2. Confirm Finance columns include `Facility`, `Counterparty`, `Exposure`, `Currency`, `Desk`, `Review status`, `Utilization`, and `Next review date`.
3. Confirm rows use stable IDs such as `FIN-5000` from `recordKey`, not a universal `id` assumption.
4. In Network, confirm loading uses:

```text
POST /api/review/finance/search/
```

5. Inspect the request and confirm Finance uses its different wire contract:

```text
window
orderBy
criteria
```

6. Confirm the response uses `records` + `counts` rather than Loan's `rows` + totals vocabulary.
7. Sort/filter and confirm the Finance mapper translates AG Grid state into `attribute/comparison/operand` semantics.

Pass criteria: the same configurable SSRM root renders Finance while the generic grid remains unaware of Finance backend vocabulary.

## Transaction as a Review entity

1. Set profile `allEntities`, active entity `transaction`, then reload.
2. Confirm the entity heading is `Transactions` and columns include `Reference`, `Access`, `Account`, `Amount`, `Currency`, `Status`, and `Transaction date`.
3. Confirm loading uses the existing:

```text
POST /api/transactions/query/
```

4. Confirm Transaction row IDs remain the existing stable `txn-*` IDs.
5. Confirm Transaction row interaction restrictions still affect selection/editability as on the existing SSRM references.

Pass criteria: Transaction participates in Review through a thin Review adapter while reusing the existing authoritative Transaction configurable definition/API/mappers.

## Access projection and fallback

1. Set profile `loanOnly` and deliberately store active entity `finance`.
2. Reload.
3. Confirm active entity falls back to `loan`.
4. Confirm only `loan` is listed as available.
5. Confirm `Internal score` is absent even though it exists in the base Loan definition.
6. Confirm Finance and Transaction columns are absent.

Pass criteria: inaccessible entities/fields are removed by resolution rather than merely hidden with CSS.

## Read-only projection

1. Set profile `loanReadOnly`, active entity `loan`, then reload.
2. Double-click Borrower, Principal, Currency, Loan status and other normally editable cells.
3. Confirm none enters edit mode.
4. Exercise paste/Fill Handle where practical and confirm read access is not bypassed.
5. Confirm edited row/cell counts remain zero.
6. Confirm the common `Submit` action is absent because this profile does not permit it.

Pass criteria: user access is applied before AG Grid receives final editability/action metadata.

## Restricted projection

1. Set profile `loanRestricted`, active entity `loan`, then reload.
2. Confirm only Borrower, Principal, Currency, and Loan status are present.
3. Confirm Borrower/Currency are read-only.
4. Confirm Principal/Loan status remain editable.
5. Confirm `Submit` remains available after selecting a row.

Pass criteria: the access object behaves as a default-deny allowlist and not as a partial copy of Loan grid configuration.

## Native validation and BASE + LOCAL drafts

1. Set profile `loanOnly`, active entity `loan`, then reload.
2. Edit Borrower in `LN-1000`.
3. Clear the value and press Enter.
4. Confirm AG Grid blocks the invalid commit and leaves the editor active.
5. Confirm dirty counts remain zero.
6. Enter a valid non-empty Borrower and commit.
7. Confirm dirty counts become one row / one cell.
8. Repeat representative parser/validation checks such as uppercase Currency, number range, select editor, and ISO date validation.

Pass criteria: configurable metadata compiles to native editor/parser/formatter/validation behavior before BASE + LOCAL draft tracking observes committed changes.

## Common Submit, different entity APIs

### Loan

1. Use `loanOnly` + `loan`.
2. Select one eligible row.
3. Confirm the common button reads `Submit` and selected count updates.
4. Click Submit.
5. Confirm Network uses:

```text
POST /api/review/loans/submit/
```

6. Confirm the payload uses Loan selection/filter vocabulary.
7. Confirm success clears selection and causes the Loan SSRM store to refresh.

### Finance

1. Use `financeOnly` + `finance`.
2. Select one row and click the same `Submit` button.
3. Confirm Network uses:

```text
POST /api/review/finance/commands/submit/
```

4. Confirm Finance sends its command shape, including `command: SUBMIT_REVIEW` and Finance target vocabulary.
5. Confirm success clears selection and refreshes Finance SSRM rows.

### Failure lifecycle

1. Using devtools/proxy/test tooling, force the active Submit request to fail.
2. Confirm an error is shown.
3. Confirm the existing selection is preserved.
4. Confirm the grid does not perform a successful-action refresh lifecycle.

Pass criteria: Review owns one mutation UI while entity runtimes own endpoint/payload/response differences and the grid owns selection/refresh lifecycle.

## SSRM selection controls

For Loan and Finance, verify representative cases:

1. Select one row manually.
2. Use **Select current page**.
3. Use **Clear selection**.
4. Apply a filter and use **Select all filtered**.
5. Use the native header checkbox for All Records.
6. Confirm selected counts follow the current total/filtered count semantics.
7. Confirm changing a defining filter clears filter-dependent selection as expected by the shared SSRM controller.

For Transaction, also confirm backend-derived restricted rows remain unavailable for selection where applicable.

## Entity lifecycle / cleanup

1. Navigate away while Review is mounted and return.
2. Change active entity repeatedly through localStorage + reload.
3. Change profiles repeatedly, including inaccessible stored entity combinations.
4. Confirm no destroyed-GridApi warnings, duplicate datasource requests caused by leaked instances, or uncaught page errors.

The implementation also keys the active Review entity subtree by entity identity so a future in-page entity change can remount cleanly rather than hot-swapping a live GridApi/datasource.

## Current deliberate omissions

Do not expect these on the configurable Review route yet:

- configurable row Save / Save Selected / Discard persistence for cell drafts;
- masking/unmask/sensitive-value retrieval;
- entity-specific secondary action rendering;
- real auth/backend-authoritative access provider;
- backend-delivered configuration/access metadata;
- configurable Grid State/access reconciliation;
- REMOTE conflict/concurrency/versioning;
- grouping/tree/pivot/aggregation.

`TransactionsSsrmNativeEditingGrid` remains an intentional native-editing reference and must not be treated as obsolete just because Review is configurable.

## Security interpretation

localStorage profile/entity values are development simulation only. They are freely editable and are not authorization. Real backend APIs must enforce actual permissions independently when authentication/access is introduced.

## Pass record

Record:

- browser/OS;
- exact commit SHA;
- profile/entity combinations actually exercised;
- API requests inspected;
- failures/console warnings;
- whether the exact same SHA passed Playwright/CI.

Do not mark this checklist complete based only on automated tests or another SSRM route.
