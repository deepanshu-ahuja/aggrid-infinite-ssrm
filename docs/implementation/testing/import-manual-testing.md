# Transaction Import Manual Verification

Use these checks when a manual browser pass is scheduled. Automated tests do not make this checklist complete automatically.

Run relevant scenarios independently on `/client`, `/infinite` and `/ssrm`.

## Basic Preview / Apply

1. Open the grid and choose **Import CSV**.
2. Download the template and confirm its headers are `id,account,amount,currency,status,transactionDate`.
3. Choose a CSV containing one enabled Transaction ID and one changed editable value.
4. Preview it.
5. Confirm the grid has not changed before Apply.
6. Apply the import.
7. Confirm the success count is correct.
8. Confirm the active row model refreshes and shows the authoritative imported value without a page reload.

Expected refresh ownership:

- Client: full collection refetch;
- Infinite: Infinite cache refresh;
- SSRM: server-side store refresh.

## Validation and target errors

Verify Preview reports errors and keeps Apply disabled for:

- missing `id` header;
- no editable field header;
- unknown/read-only columns such as `reference`;
- duplicate headers;
- duplicate Transaction IDs;
- unknown Transaction ID;
- a known `readOnly` Transaction;
- blank required text;
- invalid/negative/out-of-range amount;
- unsupported status;
- invalid date;
- non-CSV filename.

Confirm a `selectionDisabled` Transaction is still import-editable because it supports individual editing.

## Atomic behavior

Create a file with:

- one valid update;
- one invalid row.

Preview should be invalid. If Apply is forced through a crafted request, the backend should return validation failure and neither row should change.

## Existing tracked edit interaction

For each row model:

1. make a LOCAL unsaved edit to an enabled row;
2. import a different value for the same row/field;
3. Apply and let the row model refresh.

Expected:

- LOCAL remains visible;
- imported authoritative value becomes REMOTE;
- the existing conflict presentation appears;
- `Use server`, `Keep my edit`, Save and Discard keep their existing semantics.

Also verify:

- import a value equal to LOCAL → draft converges/cleans after authoritative refresh;
- import an unrelated field → original LOCAL field remains dirty without a false conflict.

## Selection lifecycle

Select rows before Import, then apply an unrelated valid Import.

Expected: Import does not deliberately clear selection. Selection may still be affected only by normal row-model/data-policy consequences if imported values change a row's eligibility.

## Dialog lifecycle

- choosing another file clears the prior Preview result;
- Apply remains disabled until the current chosen file has a valid Preview;
- successful Apply cannot be double-submitted from the same completed dialog state;
- closing/reopening remains usable for another import.

## Large-file/current limits

Confirm files larger than the current 1,000,000-character request limit are rejected by backend request validation. There is no asynchronous job progress or cancellation in the current implementation.
