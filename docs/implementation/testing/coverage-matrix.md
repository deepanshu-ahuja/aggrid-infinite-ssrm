# Grid regression coverage matrix

## Purpose

This document is the current cross-layer testing inventory for implemented grid capabilities.

It answers two different questions:

```text
1. Is the underlying logic/contract protected at the right deterministic boundary?
2. Is the important real React + AG Grid + Django integration protected in a browser where that adds evidence?
```

Playwright is not expected to duplicate every unit/state permutation. A capability can be sufficiently covered without browser automation when its risk is purely algorithmic and the real browser adds little signal.

## Legend

| Mark | Meaning |
| --- | --- |
| ✅ | meaningful automated coverage exists at this layer |
| ◐ | some coverage exists, but an important implemented scenario remains to add |
| ☐ | implemented capability has a material coverage gap at this layer |
| — | layer is not materially applicable |

For the three Playwright columns, ✅ means a real-browser scenario exists for that row model. It does not mean every logical permutation is repeated in Playwright.

## Current capability matrix

| Implemented capability | Focused frontend/state/component | Backend/API | Playwright Client | Playwright Infinite | Playwright SSRM | Current browser gap / rationale |
| --- | --- | --- | --- | --- | --- | --- |
| Initial grid loading + real API wiring | ✅ root/datasource tests | ✅ collection/query API tests | ✅ | ✅ | ✅ | Browser helpers wait for authoritative response + stable seeded RowNodes and collect page errors. |
| Server request mapping: sort/filter allow-list | ✅ mapper tests | ✅ query filtering/sorting tests | — | ◐ | ◐ | Logic is well covered; add one real sort/filter request-lifecycle scenario for Infinite/SSRM to prove UI → mapper → backend → displayed rows. |
| Pagination / Current Page boundary | ✅ current-page/selection helpers + root tests | — | ◐ | ◐ | ◐ | Current-page export exercises the boundary; add explicit page navigation/row identity coverage, especially server-backed page materialisation. |
| Request-start-order freshness | ✅ datasource/loading tests | — | — | — | — | Deterministic race tests are the correct primary layer; browser timing would be slower and less deterministic unless a regression proves additional value. |
| Datasource cancellation / destroyed-API guards | ✅ datasource/root lifecycle tests | — | — | — | — | Focused lifecycle tests are the appropriate layer; do not manufacture browser races merely for matrix symmetry. |
| Explicit row select/deselect | ✅ selection-controller tests | ✅ authoritative selected-target behavior | ✅ | ✅ | ✅ | Current browser flow selects one known eligible row; add explicit deselect/count assertion when selection suite is expanded. |
| Current Page selection | ✅ shared + row-model selection tests | ✅ server selected resolution where applicable | ☐ | ◐ | ◐ | Browser coverage should prove exact visible-page selection and restricted-row handling without confusing page with cache/store block. |
| Select All Records | ✅ Client/Infinite/SSRM selection tests | ✅ logical resolver/action/export tests | ☐ | ☐ | ☐ | Material real-browser gap: select-all state, displayed count, user exception, backend target. |
| Select All Filtered | ✅ Client/Infinite/SSRM/filter persistence tests | ✅ filtered logical resolver tests | ☐ | ☐ | ☐ | Material real-browser gap: defining filter, selected count, exception and filter-change reset semantics. |
| Filter-dependent selection lifecycle | ✅ Infinite dataset + SSRM/controller tests | — | ☐ | ☐ | ☐ | Add browser proof that All Filtered resets when defining filter changes while All Records/explicit meaning is preserved as implemented. |
| Selected-row count | ✅ selectionCount/controller tests | ✅ query counts / authoritative resolver | ◐ | ◐ | ◐ | One-row count is covered; page/filtered/all counts and exception behavior still need browser coverage. |
| Row interaction: enabled / selectionDisabled / readOnly | ✅ shared + feature/root tests | ✅ backend edit/selection policy tests | ✅ | ✅ | ✅ | Known seeded rows prove disabled selection, readOnly edit block and selectionDisabled individual edit. |
| Selected Change Status success + clear selection | ✅ action/request/hook/root tests | ✅ selected-update API tests | ✅ | ✅ | ✅ | Success lifecycle covered end-to-end. |
| Selected Change Status failure retains selection | ✅ hook/root failure tests | ✅ API error contracts | ☐ | ☐ | ☐ | High-value browser gap; network failure should leave selection usable and surface error. |
| Current Page CSV export | ✅ export/page helper/root tests | — | ✅ | ✅ | ✅ | Browser waits for the all-or-nothing page contract and confirms a real download. |
| Selected CSV export | ✅ selected-export/root tests | ✅ backend CSV + logical resolver tests | ✅ | ✅ | ✅ | One explicit-row target covered; dataset-wide logical selected export remains part of selection-scope browser work. |
| Direct committed editing | ✅ tracked-edit/root tests | ✅ update API tests | ✅ | ✅ | ✅ | Covered through Account editor + Save/Discard flows. |
| MUI Account custom editor | ✅ validation/root integration | ✅ update validation | ✅ | ✅ | ✅ | Stable editor test ID avoids collision with Flow 2 Account checkbox. |
| Transaction Date editor / persistence contract | ✅ mapper/validation/root tests | ✅ DRF DateField update validation | ✅ | ✅ | ✅ | Invalid date/editor integration covered; add valid persisted Date Save only if a later defect justifies separate browser case. |
| Flow 1: apply last edit to current page | ✅ current-page editing/root tests | — | ☐ | ☐ | ☐ | Material user flow still needs real-grid browser coverage. |
| Flow 2: valid programmatic current-page edit | ✅ current-page editing/root tests | — | ◐ | ◐ | ◐ | Invalid Amount/Currency paths are browser-covered; add a valid multi-row Flow 2 application and dirty-count assertion. |
| Dirty-row count | ✅ tracked editing + root tests | — | ◐ | ◐ | ◐ | Current browser flows create dirty rows but do not yet prove row-count semantics for multiple fields/rows. |
| Row Save | ✅ persistence/root tests | ✅ single update API | ✅ | ✅ | ✅ | Real PATCH response and visible persisted value are asserted. |
| Row Discard | ✅ tracked edit/root tests | — | ✅ | ✅ | ✅ | Known seeded original value is restored without persistence. |
| Save Selected Dirty exact `dirty ∩ selection` | ✅ tracked/root tests | ✅ bulk update API | ☐ | ☐ | ☐ | High-value browser gap: dirty selected row saves while unrelated dirty/unselected row remains LOCAL. |
| Discard Selected Dirty exact target | ✅ tracked/root tests | — | ☐ | ☐ | ☐ | High-value browser gap parallel to selected Save targeting. |
| Safe in-flight acknowledgement | ✅ tracked/persistence tests | ✅ update APIs | — | — | — | State-machine tests are the right deterministic layer; browser concurrency work remains deferred with backend stale-write contract. |
| Validation rules/state | ✅ rule + tracked + integration tests | ✅ serializer validation | ✅ | ✅ | ✅ | Browser covers blank Currency/Amount, field-local presentation and Save guard. |
| Validation correction / manual revert | ✅ tracked validation tests | — | ☐ | ☐ | ☐ | Add one browser scenario proving error clears and Save re-enables after correction/revert. |
| Backend validation rejection remains LOCAL | ✅ persistence/error mapping tests | ✅ DRF structured errors | ☐ | ☐ | ☐ | Material cross-layer gap; browser should exercise/intercept authoritative rejection and keep rejected draft visible. |
| BASE/LOCAL/REMOTE unchanged/converged/divergent reconciliation | ✅ tracked editing tests | — | ☐ | ☐ | ☐ | Logic is covered, but real-grid conflict creation after authoritative refresh is high-value browser integration. |
| Conflict `Use server` | ✅ tracked/root tests | — | ☐ | ☐ | ☐ | Add real conflict popover/resolution browser flow. |
| Conflict `Keep my edit` | ✅ tracked/root tests | — | ☐ | ☐ | ☐ | Add real conflict popover/resolution browser flow and confirm row remains dirty. |
| Validation + conflict coexistence | ✅ tracked validation/conflict tests | — | ☐ | ☐ | ☐ | Browser should prove both meanings remain visible/guarded without neighboring-cell contamination. |
| LOCAL edit survives Client authoritative row replacement | ✅ Client/root + tracked tests | — | ◐ | — | — | Save/refresh integration exists; add explicit unsaved LOCAL preservation only if needed alongside conflict suite. |
| LOCAL edit survives Infinite cache eviction/reload | ✅ Infinite/root + tracked tests | — | — | ☐ | — | High-value AG Grid browser gap: edit, force cache eviction, revisit row, LOCAL overlay remains. |
| LOCAL edit survives SSRM store refresh/recreation | ✅ SSRM/root + tracked tests | — | — | — | ☐ | High-value AG Grid browser gap: unsaved LOCAL survives refreshed/recreated store row. |
| Grid State persistence: column/filter/sort preferences | ✅ persistence + root tests | — | ☐ | ☐ | ☐ | Material browser gap: change view preference, remount route, confirm supported state restores while business selection remains transient. |
| Server-backed load error + retry | ✅ datasource/root tests | ✅ query API failure handling boundary | — | ☐ | ☐ | Add browser route interception: first query fails, overlay appears, Retry succeeds. |
| Formatter resilience to invalid LOCAL Currency/Date | ✅ formatter/validation tests | — | ✅ | ✅ | ✅ | Validation browser scenarios assert no uncaught page errors while invalid drafts render. |
| Capability marker registry coverage | ✅ registry/source tests where applicable | — | — | — | — | Static/source discoverability concern; Playwright adds no value. |

## Browser-hardening work order

The current remaining browser gaps should be closed in risk/value order rather than table order:

```text
1. deterministic data isolation + stable selectors
2. Save/Discard Selected exact-target flows
3. selection scopes/counts/filter lifecycle
4. conflict creation + both resolution choices + validation coexistence
5. Infinite cache eviction and SSRM store recreation with LOCAL edits
6. server-backed error/retry
7. Grid State persistence
8. sort/filter/page real-network smoke coverage
```

A gap can remain intentionally non-Playwright when the matrix documents why a deterministic focused test is the stronger boundary.

## Maintenance rule

When an implemented capability changes:

1. inspect its row in this matrix;
2. update focused frontend/backend tests at the stable logic boundary;
3. add/update Playwright when the change materially affects real browser/AG Grid/network integration;
4. update the relevant manual guide;
5. update this matrix to describe the coverage that actually exists;
6. do not mark a browser cell ✅ merely because a test was written — the exact CI/browser run must have executed successfully before reporting it as passed in PR/status communication.
