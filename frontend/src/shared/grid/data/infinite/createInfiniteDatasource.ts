import type { IDatasource, IGetRowsParams } from 'ag-grid-community';
import type {
  FlatGridBlockRequest,
  GridBlockResult,
  GridLoadErrorHandler,
  GridRowsLoader,
} from '../gridData.types';

interface InfiniteLoadSuccessMeta {
  /** True only for the most recently started request in this datasource instance. */
  isLatestRequest: boolean;
}

/**
 * Dependencies required to build an AG Grid Infinite Row Model datasource.
 *
 * The datasource knows only how to translate between AG Grid's `getRows` contract and our generic
 * `GridRowsLoader` contract. It deliberately does not know anything about Transactions, HTTP
 * endpoints, Django, Databricks, or feature-specific request mapping.
 */
interface CreateInfiniteDatasourceOptions<TData> {
  /**
   * Application-owned function that loads one range of rows.
   *
   * Keeping the actual data-loading function outside this adapter prevents AG Grid-specific APIs from
   * leaking into feature/API code. The feature decides how start/end row, sort and filter models map
   * into its backend contract.
   */
  loadRows: GridRowsLoader<TData>;

  /**
   * Optional application-level error handler.
   *
   * AG Grid still receives `failCallback()` for a real failure. This callback lets the application
   * additionally display the error without coupling presentation concerns to the datasource.
   */
  onError?: GridLoadErrorHandler;

  /**
   * Called when the request stream moves to a different filter universe.
   *
   * Page/range movement alone does not change the filtered universe. This hook exists so the consumer
   * can clear filter-dependent UI metadata immediately when a genuinely different filter starts.
   */
  onFilterChanged?: () => void;

  /**
   * Publishes successful API metadata without making React inspect AG Grid internals.
   *
   * `isLatestRequest` is deliberately based on request START ORDER, not the numerical page/range. So
   * both 1 -> 2 -> 3 and 3 -> 2 -> 1 behave the same: an older in-flight request cannot overwrite count
   * metadata after a newer request has started.
   */
  onLoadSuccess?: (
    result: GridBlockResult<TData>,
    request: FlatGridBlockRequest,
    meta: InfiniteLoadSuccessMeta,
  ) => void;
}

/**
 * Creates the datasource consumed by AG Grid's Infinite Row Model.
 *
 * AG Grid does not receive the complete dataset up front. As scrolling/pagination needs another
 * range, it calls `getRows(params)` with a half-open range such as 0..100 (rows 0 through 99).
 *
 * This adapter owns four row-model responsibilities:
 * 1. translate AG Grid's range request into our generic loading request;
 * 2. forward server-side sort/filter metadata to the feature loader;
 * 3. report success/failure back through AG Grid's datasource callbacks;
 * 4. abort unfinished requests when AG Grid destroys/replaces this datasource.
 *
 * COUNT OWNERSHIP
 * ---------------
 * The normal API response contains two different counts:
 * - `totalCount`: complete dataset size before filters;
 * - `filteredCount`: current query result size.
 *
 * AG Grid MUST receive `filteredCount`, because its visible Infinite model represents the current
 * query. Passing `totalCount` while a filter is active would make the grid believe rows exist beyond
 * the filtered result.
 *
 * The application also observes the same normal API response through `onLoadSuccess` so logical
 * selected totals can use API `totalCount` / `filteredCount` directly. No second count-only endpoint is
 * needed, and Infinite/SSRM can expose the same count semantics while retaining different selection
 * implementations.
 */
export function createInfiniteDatasource<TData>({
  loadRows,
  onError,
  onFilterChanged,
  onLoadSuccess,
}: CreateInfiniteDatasourceOptions<TData>): IDatasource {
  /**
   * Every `getRows` call may be in flight independently. A shared AbortController would be incorrect:
   * cancelling one range could cancel unrelated ranges. Tracking each request lets `destroy()` abort
   * exactly the work that belongs to this datasource instance.
   */
  const activeRequests = new Set<AbortController>();

  /**
   * Filter identity and request order solve different problems:
   *
   * - `activeFilterKey` tells us when filter-dependent metadata must be reset;
   * - `latestRequestSequence` prevents an older response from replacing metadata after a newer API call.
   *
   * Crucially, request sequence is monotonic and unrelated to page number. Going backwards through the
   * grid is therefore handled exactly the same as going forwards.
   */
  let activeFilterKey: string | undefined;
  let latestRequestSequence = 0;

  return {
    /** Called whenever Infinite Row Model needs another range of rows. */
    async getRows(params: IGetRowsParams) {
      const controller = new AbortController();
      activeRequests.add(controller);

      const request: FlatGridBlockRequest = {
        /** AG Grid uses a half-open range: `endRow` is excluded. */
        startRow: params.startRow,
        endRow: params.endRow,

        /** Backend sorting/filtering semantics remain the feature mapper's responsibility. */
        sortModel: params.sortModel,
        filterModel: params.filterModel ?? {},
      };
      const filterKey = JSON.stringify(request.filterModel);
      const requestSequence = ++latestRequestSequence;

      if (activeFilterKey !== filterKey) {
        activeFilterKey = filterKey;
        onFilterChanged?.();
      }

      try {
        const result = await loadRows(request, { signal: controller.signal });

        onLoadSuccess?.(result, request, {
          // A response can be valid for AG Grid's own datasource lifecycle and still be stale for
          // rendered metadata. Compare request start order; never infer freshness from row/page number.
          isLatestRequest: requestSequence === latestRequestSequence,
        });

        /**
         * Resolving `loadRows` alone does not update AG Grid; its callback must be invoked. The second
         * argument is the size of the CURRENT query, so use `filteredCount`, not the all-record total.
         */
        params.successCallback(result.rows, result.filteredCount);
      } catch (error) {
        /**
         * `destroy()` intentionally aborts old requests. Those aborts are lifecycle cleanup, not user-
         * visible load failures, so only genuine non-aborted errors are reported to the app/grid.
         */
        if (!controller.signal.aborted) {
          onError?.(error);
          params.failCallback();
        }
      } finally {
        activeRequests.delete(controller);
      }
    },

    /**
     * AG Grid calls this when the datasource is replaced/destroyed. Cancelling outstanding requests
     * prevents stale async work from reporting into a grid that has moved to another datasource/query.
     */
    destroy() {
      activeRequests.forEach((controller) => controller.abort());
      activeRequests.clear();
    },
  };
}
