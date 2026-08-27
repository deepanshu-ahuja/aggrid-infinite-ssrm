# API and Data Flow

Both row-model paths use the same flat row-loading flow while keeping their AG Grid adapters separate:

```text
AG Grid block request
  -> Infinite or SSRM datasource adapter
  -> feature request mapper
  -> typed frontend API client
  -> DRF serializer validation
  -> transaction query service
  -> { rows, totalCount, filteredCount }
  -> row-model success callback
```

Each returned Transaction row also carries its backend-provided `interactionMode` (`enabled`, `selectionDisabled`, or `readOnly`). That is feature/domain data describing row capability; it is not AG Grid selection state.

The datasource factories handle AG Grid callback and cancellation lifecycles. `transactionRequest.mapper.ts` is the deliberate boundary where column IDs, filter models and sort items become the backend contract:

```json
{
  "offset": 0,
  "limit": 50,
  "sort": [{ "field": "amount", "direction": "desc" }],
  "filters": [{ "field": "status", "operator": "equals", "value": "Completed" }]
}
```

Raw AG Grid request objects never cross the HTTP boundary. Both frontend mapping and DRF serializers allow-list fields and operators. Unsupported combined filters fail explicitly instead of silently producing incorrect results.

The response contains the current block, the complete dataset count, and the current filtered count. That flat contract works for Infinite Row Model and the current flat SSRM path. Group routes, aggregation results and pivot metadata are intentionally absent; design those only when a real SSRM feature needs them.

## Row interaction flow

For loaded rows, the feature maps backend `interactionMode` to the shared row-interaction predicates and then to native AG Grid behavior:

```text
backend row.interactionMode
  -> feature row-policy adapter
  -> native rowSelection.isRowSelectable
  -> native column editable callbacks
  -> shared programmatic-edit row predicate
```

The generic meaning is:

```text
enabled
-> selectable and editable

selectionDisabled
-> not selectable / not part of selection-based bulk actions
-> still editable

readOnly
-> not selectable / not part of selection-based bulk actions
-> not editable / no modifying row actions
```

Frontend selection code does not collect disabled IDs. A disabled row is outside the selectable universe rather than an automatic `exclude` exception.

The backend independently enforces the same business eligibility because Select All can target rows that the browser never loaded.

## Editing persistence flow

Tracked local edits and logical selection actions are different backend operations.

Single-row Save persists one concrete dirty-row patch:

```text
tracked row changes
  -> PATCH /api/transactions/{id}/
  -> backend resolves the explicit row
  -> backend rejects it if row is readOnly
  -> backend applies the explicit patch
  -> row-model-specific native refresh
```

A `selectionDisabled` row remains eligible for direct editing; only the stronger `readOnly` state blocks direct persistence.

Aggregate Save persists concrete accumulated dirty rows selected by the user:

```text
changesById
  ∩
current logical selection
  -> explicit [{ id, changes }, ...] payload
  -> PATCH /api/transactions/bulk/
  -> backend resolves every row and validates editability first
  -> if any target is readOnly, reject before mutating any row
  -> otherwise apply those concrete row patches
  -> row-model-specific native refresh
```

The `/bulk/` endpoint is deliberately ID-based. It does not use the logical `include/exclude` selection contract to manufacture edits for unloaded or untouched rows.

This is separate from `/selection/`, which applies one business change to the logical server-backed selection and can therefore target unloaded rows.

## Selection-action flow

Selection actions do not enumerate loaded RowNodes to decide backend membership. They use the logical selection owned by the appropriate row-model selection controller.

The reusable logical selection is:

```json
{
  "mode": "include | exclude",
  "ids": []
}
```

The action wire contract intentionally has no separate `scope` field and no disabled-row ID list:

```text
include + ids
-> resolve those exact ids
-> keep only backend selection-eligible rows

exclude + translated filters
-> rows matching the filters
-> keep only backend selection-eligible rows
-> remove user exception ids

exclude without filters
-> all records
-> keep only backend selection-eligible rows
-> remove user exception ids
```

Manual selection, current-page selection and accumulated cross-page selection all become `include + ids`. Loaded disabled rows cannot enter that selection through native AG Grid selection.

Select All Filtered becomes `exclude + ids` plus the same feature-translated filters used by normal row loading. Select All Records becomes `exclude + ids` without filter context. In both cases disabled rows are **not** added to `ids`; Python removes them from the action target whether loaded or unloaded.

The frontend still knows internally whether an exclude selection came from filtered or all-record Select All because Infinite and SSRM have different native/custom selection capabilities. That row-model context is used only while constructing the request; it is not duplicated into the serialized selection.

Example filtered action:

```json
{
  "selection": {
    "mode": "exclude",
    "ids": ["txn-00010"]
  },
  "filters": [
    { "field": "status", "operator": "equals", "value": "Pending" }
  ],
  "changes": {
    "status": "Failed"
  }
}
```

Here `txn-00010` is a **user deselection exception**. Backend-disabled rows are not represented in that array.

After a successful backend write, each row model refreshes through its own native API:

```text
Infinite -> refreshInfiniteCache()
SSRM     -> refreshServerSide()
```

For Infinite, that refreshes only blocks currently resident in its bounded browser cache. Evicted or never-loaded blocks are not fetched just because a dataset-wide action changed them; when the user later visits those rows, the backend-authoritative values and interaction mode are fetched normally.

## Current transaction write endpoints

```text
POST  /api/transactions/query/
PATCH /api/transactions/{id}/
PATCH /api/transactions/bulk/
PATCH /api/transactions/selection/
```

Their responsibilities stay intentionally distinct:

- `query/` loads server-backed rows plus their interaction policy;
- `{id}/` saves one explicit dirty row and rejects read-only rows;
- `bulk/` saves explicit dirty-row patches and validates row editability atomically;
- `selection/` applies a feature action to the logical include/exclude target after backend row-eligibility filtering.

See `docs/row-interaction.md` for the reusable row-policy contract.
