import type { IDatasource, IGetRowsParams } from 'ag-grid-community';
import type { GridLoadErrorHandler, GridRowsLoader } from '../gridData.types';

/**
 * Dependencies required to build an AG Grid Infinite Row Model datasource.
 *
 * The datasource knows only how to translate between AG Grid's `getRows` contract and our generic
 * `GridRowsLoader` contract. It deliberately does not know anything about Transactions, HTTP
 * endpoints, Django, Databricks, or feature-specific request mapping.
 */
interface CreateInfiniteDatasourceOptions<TData> {
  /**
   * Application-owned function that loads one block of rows.
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
   * additionally display/log the error without coupling presentation concerns to the datasource.
   */
  onError?: GridLoadErrorHandler;
}

/**
 * Creates the datasource consumed by AG Grid's Infinite Row Model.
 *
 * AG Grid does not receive the complete dataset up front. As scrolling/pagination needs another
 * block, it calls `getRows(params)` with a half-open range such as 0..100 (rows 0 through 99).
 *
 * This adapter owns four row-model responsibilities:
 * 1. translate AG Grid's block request into our generic loading request;
 * 2. forward server-side sort/filter metadata to the feature loader;
 * 3. report success/failure back through AG Grid's datasource callbacks;
 * 4. abort unfinished requests when AG Grid destroys/replaces this datasource.
 *
 * COUNT OWNERSHIP
 * ---------------
 * The generic loader now returns two different counts:
 * - `totalCount`: complete dataset size before filters;
 * - `filteredCount`: current query result size.
 *
 * AG Grid MUST receive `filteredCount`, because its visible pagination/cache represents the current
 * query. Passing `totalCount` while a filter is active would make the grid believe rows exist beyond
 * the filtered result. `totalCount` remains application metadata consumed elsewhere (for example,
 * Infinite All Records selection) and is intentionally not interpreted by this adapter.
 */
export function createInfiniteDatasource<TData>({
  loadRows,
  onError,
}: CreateInfiniteDatasourceOptions<TData>): IDatasource {
  /**
   * Every `getRows` call may be in flight independently. A shared AbortController would be incorrect:
   * cancelling one block could cancel unrelated blocks. Tracking each request lets `destroy()` abort
   * exactly the work that belongs to this datasource instance.
   */
  const activeRequests = new Set<AbortController>();

  return {
    /** Called whenever Infinite Row Model needs another block of rows. */
    async getRows(params: IGetRowsParams) {
      const controller = new AbortController();
      activeRequests.add(controller);

      try {
        const result = await loadRows(
          {
            /** AG Grid uses a half-open range: `endRow` is excluded. */
            startRow: params.startRow,
            endRow: params.endRow,

            /** Backend sorting/filtering semantics remain the feature mapper's responsibility. */
            sortModel: params.sortModel,
            filterModel: params.filterModel,
          },
          { signal: controller.signal },
        );

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
