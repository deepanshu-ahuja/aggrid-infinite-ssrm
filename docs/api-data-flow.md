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

## Editing persistence flow

Tracked local edits and logical selection actions are different backend operations.

Single-row Save persists one concrete dirty-row patch:

```text
tracked row changes
  -> PATCH /api/transactions/{id}/
  -> backend validates/applies the explicit patch
  -> row-model-specific native refresh
```

Aggregate Save persists concrete accumulated dirty rows selected by the user:

```text
changesById
  ∩
current logical selection
  -> explicit [{ id, changes }, ...] payload
  -> PATCH /api/transactions/bulk/
  -> backend validates/applies those concrete row patches
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

The action wire contract intentionally has no separate `scope` field:

```text
include + ids
-> exactly those ids

exclude + translated filters
-> rows matching the filters, minus exception ids

exclude without filters
-> all records, minus exception ids
```

Manual selection, current-page selection and accumulated cross-page selection all become `include + ids`. The visible filter is not sent for those exact IDs.

Select All Filtered becomes `exclude + ids` plus the same feature-translated filters used by normal row loading. Select All Records becomes `exclude + ids` without filter context.

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

After a successful backend write, each row model refreshes through its own native API:

```text
Infinite -> refreshInfiniteCache()
SSRM     -> refreshServerSide()
```

For Infinite, that refreshes only blocks currently resident in its bounded browser cache. Evicted or never-loaded blocks are not fetched just because a dataset-wide action changed them; when the user later visits those rows, the backend-authoritative values are fetched normally.

## Current transaction write endpoints

```text
POST  /api/transactions/query/
PATCH /api/transactions/{id}/
PATCH /api/transactions/bulk/
PATCH /api/transactions/selection/
```

Their responsibilities stay intentionally distinct:

- `query/` loads server-backed rows;
- `{id}/` saves one explicit dirty row;
- `bulk/` saves explicit dirty-row patches;
- `selection/` applies a feature action to the logical include/exclude target.
