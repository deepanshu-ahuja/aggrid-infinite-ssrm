# API and Data Flow

Both row-model paths use the same flat data flow:

```text
AG Grid block request
  -> row-model datasource adapter
  -> feature request mapper
  -> typed frontend API client
  -> DRF serializer validation
  -> transaction query service
  -> { rows, totalCount }
  -> AG Grid success callback
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

The response contains the current block and `totalCount`. That contract works for Infinite Row Model and the flat SSRM trial. Group routes, aggregation results and pivot metadata are intentionally absent; they should be designed only if a future SSRM feature actually needs them.

For selection, page scope submits explicit IDs. Filtered/all scopes use an exclude intent so unloaded records do not need to enter the browser. A future bulk endpoint must combine that intent with a feature-mapped filter snapshot; raw AG Grid filter models still must not cross the HTTP boundary.
