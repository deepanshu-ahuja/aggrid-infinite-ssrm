# Configurable SSRM manual verification

Use this checklist for the isolated `/configurable-ssrm` route. This is a browser checklist, not a statement that the scenarios have already passed.

## Setup

1. Start the normal Django backend and Vite frontend using the repository's documented local flow.
2. Open `/configurable-ssrm`.
3. Open browser developer tools and keep Console and Network visible.
4. Confirm the grid loads Transaction rows through `/api/transactions/query/`.

## Configuration compilation

1. Confirm the visible headers are `Reference`, `Access`, `Account`, `Amount`, `Currency`, `Status`, and `Transaction date`.
2. Confirm `Amount` has numeric-column presentation and `Status`/`Access` use the registered Transaction renderers.
3. Confirm pagination uses the configurable SSRM defaults/overrides.
4. Confirm no unknown-component or normalization error is shown in the console.

Pass criteria: the route renders from compiled definitions without falling back to the existing static SSRM column array.

## Server sort/filter mapping

1. Sort `Amount` ascending, then descending.
2. Inspect `/api/transactions/query/` requests.
3. Verify the backend request uses the existing Transaction field mapping (`amount`) and matching sort direction.
4. Open the `Account` filter. Confirm only the configured one-condition operators are offered.
5. Apply an Account filter and inspect the query request.
6. Repeat with Number and Date filters.

Pass criteria: configurable native column/filter metadata drives AG Grid UI, while requests still use the existing explicit Transaction adapter/backend contract. No arbitrary frontend-only column is sent as a server field.

## Native validation and draft tracking

1. Double-click an editable `Account` cell on an enabled row.
2. Clear the value and press Enter.
3. Confirm AG Grid keeps the invalid editor active because `invalidEditValueMode = block`.
4. Confirm the edited row/cell counters remain zero because invalid editor input never committed.
5. Enter a valid Account value and commit.
6. Confirm the cell changes and the counters show one edited row / one edited cell.
7. Edit the same field back to its original value.
8. Confirm the dirty counts return to zero.

Repeat with Amount outside/inside the configured range, invalid/valid Currency, Status, and invalid/valid `YYYY-MM-DD` Transaction date.

Pass criteria: editor validation is native AG Grid lifecycle; only committed valid values enter BASE + LOCAL draft state.

## Native Cell Selection / Fill Handle / clipboard

1. Make a valid edit in an editable column.
2. Exercise Cell Selection and Fill Handle across editable loaded rows.
3. Paste into an editable cell/range.
4. Confirm read-only rows are not made editable by these alternative entry points.
5. Confirm committed values increment dirty counts by row/cell rather than manufacturing drafts for untouched rows.

Pass criteria: the compiler's final native `editable` callback controls all native edit entry points; there is no custom range-edit controller.

## SSRM recreation and LOCAL restoration

1. Create an unsaved valid LOCAL edit.
2. Navigate/scroll so the relevant SSRM store block can be recreated or evicted.
3. Return to the row.
4. Confirm the LOCAL value is restored and the dirty count remains correct.
5. Inspect Network and confirm authoritative rows still load through the SSRM datasource rather than a React Query row cache.

## Row interaction

Confirm `selectionDisabled` cannot be selected but remains individually editable, `readOnly` cannot be selected or edited, and the Access renderer matches backend interaction mode.

## Negative lifecycle checks

Navigate away while row requests are active and confirm no destroyed-GridApi warnings. Exercise the existing server-load Retry flow if available and confirm it remains native SSRM lifecycle.

## Current deliberate omissions

Do not expect configurable Save/Discard controls, selected business actions, Grid State persistence, conflict reconciliation, or configurable security/action schemas on this route. Those are not part of this foundation batch.

## Pass record

Record browser/OS, commit SHA, scenarios actually executed, failures/console warnings, and whether Playwright also passed on the exact same SHA. Do not mark the checklist complete based only on unit tests or a different SSRM route.
