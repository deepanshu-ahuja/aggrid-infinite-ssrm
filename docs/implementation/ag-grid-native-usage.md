# AG Grid Native Usage Reference

This document records the AG Grid runtime surface used by the repository and the application-owned mechanics required where native behavior does not represent the required meaning.

## Native-first rule

Current architecture deliberately relies on AG Grid directly:

```text
native AG Grid capability
        ↓ if insufficient
row-model-specific native capability
        ↓ if still insufficient
smallest application-owned semantic state/mechanic
```

The project does not recreate AG Grid behind a universal wrapper.

## Direct `AgGridReact` roots

Current concrete roots render `AgGridReact` directly:

```text
TransactionsClientGrid
TransactionsInfiniteGrid
TransactionsSsrmGrid
```

Each root owns its authoritative `GridApi` and row-model lifecycle.

## Client-Side Row Model

Client-Side uses native AG Grid for the complete locally held dataset:

- `rowData` for the complete bounded working set;
- native local sorting;
- native local filtering;
- native pagination;
- native row selection;
- native Select All scopes `currentPage`, `filtered`, and `all`;
- native selected-row enumeration;
- native CSV export for Current Page and Selected rows;
- native Grid State for supported view preferences.

Application code supplies editable row copies so AG Grid cell mutation does not mutate the authoritative TanStack Query cache object used as REMOTE state.

## Infinite Row Model

Infinite uses native AG Grid datasource and cache lifecycle for row loading:

- `rowModelType="infinite"`;
- Infinite datasource callbacks;
- native block/cache demand;
- native pagination over the loaded model;
- native concrete RowNode selection;
- native cache refresh through `refreshInfiniteCache()`.

Application-owned compact selection state is used for filtered/all dataset-wide selection because unloaded Infinite rows do not have RowNodes.

## Server-Side Row Model

SSRM uses native Enterprise server-side behavior wherever it represents the required meaning:

- `rowModelType="serverSide"`;
- server-side datasource/store lifecycle;
- native server-side selection state for explicit and All Records selection;
- native `refreshServerSide()`;
- native `retryServerSideLoads()`;
- native Grid State where supported.

Application-owned selection state is used only for the current All Filtered semantic gap.

## Stable row identity

All row models use stable backend row IDs through `getRowId` where required.

Stable identity supports:

- selection;
- editing drafts;
- refresh/recreation;
- conflict reconciliation;
- backend actions;
- Grid State interactions that depend on durable row identity.

Displayed row index is not durable identity.

## Current Page

Current Page is resolved from AG Grid's native pagination model.

For server-backed models, the expected current-page RowNodes must be fully materialised before an exact Current Page operation proceeds. Partial page actions/exports are not silently accepted.

Native CSV serialization remains AG Grid-owned after the exact page boundary is resolved.

## Row selection

### Client-Side

Native Client selection represents all supported scopes because the complete working set is local.

### Infinite

Native selection owns concrete loaded/manual/current-page rows. Application state represents dataset-wide filtered/all intent across unloaded rows.

### SSRM

Native server-side selection state owns explicit and All Records selection. Current Page operates on concrete page RowNodes. Application state represents All Filtered.

## Row interaction

Native `isRowSelectable` and `editable` callbacks apply loaded-row interaction rules.

Current generic meanings are:

```text
enabled
selectionDisabled
readOnly
```

Backend services independently enforce authoritative business eligibility and write policy.

## Editing

AG Grid owns cell-edit interaction, while durable unsaved edit state lives outside transient RowNodes.

The tracked editing layer records BASE/LOCAL/REMOTE values by stable row ID and field.

Programmatic writes used to restore LOCAL values are marked so they are not reinterpreted as fresh direct user edits or authoritative REMOTE convergence.

## Grid State

Native AG Grid Grid State is used for the supported durable view preferences:

- column order;
- pinning;
- sizing;
- visibility;
- filters;
- sort.

Pagination position and business row selection remain transient.

## Export

Native AG Grid CSV owns serialization for browser-resolved exports.

Current Page uses native CSV over the exact resolved page.

Client Selected uses native selected-row CSV across pagination pages.

Server-backed Selected export is backend-owned because the authoritative selected universe may contain unloaded rows.

## Refresh and retry

Refresh remains row-model-specific:

```text
Client
→ authoritative TanStack Query cache update/refetch
→ new rowData

Infinite
→ refreshInfiniteCache()

SSRM
→ refreshServerSide()
```

SSRM load retry uses `retryServerSideLoads()`.

## Teardown

Concrete roots clear their authoritative GridApi refs during grid pre-destroy lifecycle.

Datasource destruction cancels obsolete in-flight requests.

Custom code that can run during/after teardown guards against calling a destroyed GridApi.
