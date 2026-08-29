# Transaction Import

## Current contract

Transaction Import is a separate workflow from ordinary tracked cell editing.

The current implementation is deliberately narrow:

```text
CSV file
→ update existing Transactions only
→ stable `id` identifies each target row
→ one or more editable field columns
→ Preview validates without mutation
→ Apply revalidates and applies atomically
→ active row model refreshes authoritative data
```

Supported editable columns are:

- `account`
- `amount`
- `currency`
- `status`
- `transactionDate`

`id` is required. `reference`, `interactionMode`, `interactionReason` and unknown columns are not import-writable.

The Import action provides a CSV template with:

```csv
id,account,amount,currency,status,transactionDate
```

A narrower CSV is valid when it contains `id` plus at least one editable field column, for example:

```csv
id,account
txn-00001,Operating International
```

## Why Import is not tracked editing

Tracked editing answers:

> What unsaved LOCAL changes has this user made in grid cells?

Import answers:

> What external file should the backend validate and apply as one explicit business operation?

Import therefore does not create tracked LOCAL drafts, does not call Row Save/Save Selected, and does not route through `useTransactionEditPersistence()`.

The two workflows meet only after successful persistence when the grid obtains authoritative data again.

## Preview and Apply

### Preview

`POST /api/transactions/import/preview/`

Request:

```json
{
  "filename": "transactions.csv",
  "content": "id,account\ntxn-00001,Imported account\n"
}
```

Preview:

- accepts `.csv` filenames only;
- rejects missing/duplicate/unsupported headers;
- requires `id` plus at least one editable field column;
- rejects duplicate Transaction IDs within the file;
- rejects unknown Transaction IDs;
- rejects `readOnly` targets;
- allows `selectionDisabled` targets because they remain individually editable;
- validates imported field values through the same backend `TransactionChangesSerializer` used by normal persistence;
- returns row/field errors;
- never mutates authoritative data.

### Apply

`POST /api/transactions/import/apply/`

Apply receives the same request shape but does **not** trust a previous Preview result. It parses and validates the file again at the mutation boundary.

If any file, target or field error exists:

```text
Apply → HTTP 400
→ no Transaction changes are applied
```

If the complete file is valid, the current in-memory backend applies the explicit updates through `bulk_update_transactions()`, whose current contract resolves/checks every target before mutation.

The current behavior is therefore all-or-nothing. A future database implementation must preserve that contract with a real database transaction.

## Validation reuse

Frontend validation still improves cell-editing UX, but Import does not execute frontend validators row-by-row as its authority.

Backend Import reuses `TransactionChangesSerializer`, so imported persisted values and ordinary persisted cell edits share the same authoritative constraints.

This avoids a second security/data-integrity rule set in the browser.

## Row eligibility

Import update eligibility follows explicit edit semantics, not checkbox-selection semantics:

```text
enabled
→ import editable

selectionDisabled
→ import editable

readOnly
→ import rejected
```

This matches the existing direct/bulk edit contract.

## Authoritative refresh and existing LOCAL drafts

After successful Apply, the feature UI calls a callback owned by the concrete grid root.

```text
Client
→ TanStack Query collection refetch

Infinite
→ refreshInfiniteCache()

SSRM
→ refreshServerSide()
```

Import does not clear current checkbox selection merely because data changed.

Existing tracked LOCAL edits are not discarded. When refreshed authoritative rows arrive, the existing BASE/LOCAL/REMOTE reconciliation runs normally:

```text
imported REMOTE == BASE
→ keep LOCAL dirty

imported REMOTE == LOCAL
→ local draft converges/cleans

imported REMOTE differs from BASE and LOCAL
→ ordinary edit conflict
→ keep LOCAL visible and remember imported REMOTE
```

This is intentionally the same reconciliation behavior as any other fresh authoritative data arrival.

## Current error presentation

Preview displays structured file/row/field errors in the Import dialog and keeps Apply disabled when Preview is invalid.

Apply can still return validation errors because it revalidates. The dialog treats that as authoritative failure and requires the user to correct/re-preview the current file.

## Current limitations / deliberate non-goals

Not implemented in the current slice:

- create semantics;
- upsert semantics;
- matching by `reference` or any unstable/display field;
- XLSX or other spreadsheet formats;
- configurable field mapping UI;
- partial-success Import;
- downloadable error CSV;
- asynchronous job progress;
- cancellation of a long-running import;
- backend optimistic-concurrency/version checks.

Those are not hidden capabilities. They require explicit product contracts before implementation.

The current dataset is 750 in-process rows, so job orchestration/progress/cancellation would add complexity without solving a current scale problem.

## Implementation boundaries

```text
frontend/src/features/transactions/grid/TransactionImportAction.tsx
→ file selection, template download, Preview/Apply dialog, error presentation

frontend/src/features/transactions/api/transactions.api.ts
frontend/src/features/transactions/api/transactions.contracts.ts
→ typed Import HTTP boundary

TransactionsClientGrid.tsx
TransactionsInfiniteGrid.tsx
TransactionsSsrmGrid.tsx
→ row-model-specific authoritative refresh only

backend/apps/transactions/api/import_csv.py
→ CSV parsing + authoritative import validation orchestration

backend/apps/transactions/api/import_views.py
→ mutation-free Preview + revalidating Apply HTTP endpoints

backend/apps/transactions/services.py
→ existing authoritative bulk mutation/editability behavior
```

Search frontend extraction points with `GRIDCAP-IMPORT`.

## Automated verification

Focused backend coverage verifies:

- Preview does not mutate;
- successful Apply updates rows;
- invalid Apply is atomic;
- duplicate/missing/read-only target errors;
- `selectionDisabled` remains import editable;
- unsupported columns/non-CSV filename rejection.

Focused frontend coverage verifies Preview-before-Apply behavior, invalid Preview presentation and post-Apply refresh callback ownership.

Playwright covers a successful Preview/Apply/authoritative-refresh flow independently on Client, Infinite and SSRM.

Manual verification remains documented separately and is not considered complete unless actually run.
