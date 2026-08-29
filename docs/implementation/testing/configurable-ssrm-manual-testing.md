# Configurable SSRM Manual Verification

These are manual scenarios for the isolated `/configurable-ssrm` experiment. They are instructions only; this document does not claim they have been run.

## 1. Metadata-compiled table loads

1. Open `/configurable-ssrm`.
2. Confirm the page shows `Configurable SSRM experiment`.
3. Confirm the grid loads real Transaction rows from the backend.
4. Confirm the visible metadata-driven columns include Reference, Access, Account, Amount, Currency, Status and Transaction date.
5. Confirm Amount/date/status/access presentation is rendered normally rather than as raw metadata objects.

Expected: the route renders an ordinary AG Grid SSRM table whose columns were compiled from the local JSON-safe definition.

## 2. Server sort/filter remain native SSRM mechanics

1. Sort Reference ascending, then descending.
2. Apply a supported text filter such as Status contains `Pending`.
3. Remove the filter.

Expected: the table reloads through the normal server-query lifecycle; metadata controls the supported column definition but does not introduce a second application-owned sort/filter state.

## 3. Backend row interaction still applies

1. Find a normal enabled row and confirm its checkbox is selectable.
2. Find a `selectionDisabled` row and confirm its checkbox is disabled while the row remains otherwise usable according to the existing policy.
3. Find a `readOnly` row and confirm its checkbox is disabled and the existing read-only presentation remains visible.

Expected: metadata composition does not bypass backend-derived row interaction policy.

## 4. Existing routes remain independent

1. Open `/client`, `/infinite`, and `/ssrm` after using the configurable route.
2. Confirm each route still loads and retains its established row-model behavior.

Expected: the configurable experiment has not replaced or wrapped the three proven composition roots.

## 5. Configuration failure presentation during development

When intentionally testing an invalid local definition in a development change, use one controlled invalid value at a time, such as an unsupported schema version or unknown required renderer key.

Expected: the configurable route shows a controlled configuration error and does not execute arbitrary metadata or silently fall back to guessed behavior. Restore the valid definition before committing normal application code.
