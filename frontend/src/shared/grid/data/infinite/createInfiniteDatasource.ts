import type { IDatasource, IGetRowsParams } from 'ag-grid-community';
import type { GridLoadErrorHandler, GridRowsLoader } from '../gridData.types';

/**
 * Dependencies required to build an AG Grid Infinite Row Model datasource.
 *
 * The datasource itself should know only how to translate between AG Grid's
 * `getRows` contract and our application's generic `GridRowsLoader` contract.
 * It deliberately does not know anything about transactions, HTTP endpoints,
 * Django, or feature-specific request mapping.
 */
interface CreateInfiniteDatasourceOptions<TData> {
  /**
   * Application-owned function that loads one block of rows.
   *
   * Keeping the actual data-loading function outside this adapter prevents
   * AG Grid-specific APIs from leaking into feature/API code. The feature can
   * decide how `startRow`, `endRow`, sorting, and filtering become an HTTP request.
   */
  loadRows: GridRowsLoader<TData>;

  /**
   * Optional application-level error handler.
   *
   * AG Grid still receives `failCallback()` when a real request fails. This
   * callback exists so the application can additionally report/log/display the
   * error without coupling that concern to AG Grid.
   */
  onError?: GridLoadErrorHandler;
}

/**
 * Creates the datasource consumed by AG Grid's **Infinite Row Model**.
 *
 * ## What an Infinite Row Model datasource does
 *
 * AG Grid does not receive the complete dataset up front. Instead, as the user
 * scrolls or pagination needs another block, AG Grid calls `getRows(params)` and
 * tells us which row range it currently needs.
 *
 * Example:
 * - `startRow = 0`
 * - `endRow = 100`
 *
 * means AG Grid is requesting rows 0 through 99. `endRow` is an exclusive bound.
 *
 * This adapter performs four jobs:
 * 1. Translate AG Grid's `IGetRowsParams` into our generic grid-loading request.
 * 2. Forward AG Grid's sort/filter models to the feature-owned loader.
 * 3. Report success or failure back to AG Grid using its datasource callbacks.
 * 4. Abort unfinished requests when AG Grid destroys/replaces the datasource.
 *
 * It intentionally does **not** know how the backend API works. That translation
 * belongs in the feature/API mapping layer, which keeps this shared utility reusable.
 */
export function createInfiniteDatasource<TData>({
  loadRows,
  onError,
}: CreateInfiniteDatasourceOptions<TData>): IDatasource {
  /**
   * Every `getRows` call can be in flight independently.
   *
   * AG Grid may ask for another block before an earlier request has completed,
   * so one shared AbortController would be incorrect: aborting one request would
   * accidentally abort all other active requests as well.
   *
   * Tracking controllers in a Set lets `destroy()` cancel exactly the requests
   * that are still outstanding when this datasource is no longer used.
   */
  const activeRequests = new Set<AbortController>();

  return {
    /**
     * Called by AG Grid whenever the Infinite Row Model needs a block of rows.
     *
     * `params` is owned by AG Grid. Besides the requested row range, it contains
     * the current grid-side sort/filter models and callbacks that MUST be used to
     * tell AG Grid whether the request succeeded or failed.
     *
     * We do not call the backend directly here. Instead we pass a framework-neutral
     * request to `loadRows`, so the shared grid layer stays independent of any
     * particular feature or API implementation.
     */
    async getRows(params: IGetRowsParams) {
      // A separate controller is created for this specific block request.
      // Its signal is forwarded to the application's fetch/loading layer.
      const controller = new AbortController();
      activeRequests.add(controller);

      try {
        const result = await loadRows(
          {
            // AG Grid uses a half-open range: startRow is included, endRow is not.
            // For example, 0..100 means "return up to 100 rows: indexes 0-99".
            startRow: params.startRow,
            endRow: params.endRow,

            // With the Infinite Row Model, sorting/filtering are normally executed
            // by the backend. AG Grid describes the current UI state; the feature
            // mapper decides how those models translate into our backend contract.
            sortModel: params.sortModel,
            filterModel: params.filterModel,
          },
          { signal: controller.signal },
        );

        /**
         * Tell AG Grid that this block loaded successfully.
         *
         * - `result.rows` contains the rows requested for this block.
         * - `result.totalCount` tells AG Grid the known size of the full result set,
         *   allowing it to size pagination/scrolling correctly and stop requesting
         *   blocks after the end of the dataset.
         *
         * Calling AG Grid's success callback is essential: resolving `loadRows`
         * alone does not update the grid.
         */
        params.successCallback(result.rows, result.totalCount);
      } catch (error) {
        /**
         * An aborted request is intentionally ignored.
         *
         * `destroy()` aborts active requests when this datasource is being removed.
         * In that situation there is no useful failure to show to the user and the
         * old datasource should not report a failed block back into AG Grid.
         *
         * For a genuine request failure, notify the application first and then tell
         * AG Grid the block failed so the grid can leave its loading state correctly.
         */
        if (!controller.signal.aborted) {
          onError?.(error);
          params.failCallback();
        }
      } finally {
        // Whether the request succeeded, failed, or was aborted, it is no longer
        // an active request after this `getRows` invocation finishes.
        activeRequests.delete(controller);
      }
    },

    /**
     * AG Grid calls the datasource's optional cleanup hook when the datasource is
     * destroyed/replaced.
     *
     * Cancelling outstanding requests is important because an old request may
     * otherwise finish after the grid has moved to a different datasource/query.
     * Apart from wasting network work, that creates opportunities for stale async
     * work to report back after the component/grid lifecycle has moved on.
     */
    destroy() {
      activeRequests.forEach((controller) => controller.abort());
      activeRequests.clear();
    },
  };
}
