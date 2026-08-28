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
  /** Application-owned function that loads one range of rows. */
  loadRows: GridRowsLoader<TData>;

  /** Optional application-level error handler in addition to AG Grid's `failCallback()`. */
  onError?: GridLoadErrorHandler;

  /** Called when the request stream moves to a different filter universe. */
  onFilterChanged?: () => void;

  /**
   * Publishes successful API metadata without making the React hook inspect AG Grid internals.
   *
   * `isLatestRequest` is intentionally about request start order, not page number. If the user moves
   * 1 -> 2 -> 3 or 3 -> 2 -> 1, the last request they caused is the only one allowed to replace the
   * displayed count metadata when older requests finish later.
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
 * COUNT OWNERSHIP
 * ---------------
 * The normal API response contains:
 * - `totalCount`: complete dataset size before filters;
 * - `filteredCount`: current query result size.
 *
 * AG Grid receives `filteredCount` as the current Infinite row-model size. The application receives the
 * same successful response through `onLoadSuccess` so All Records / All Filtered selection totals can
 * use API `totalCount` / `filteredCount` directly. We do not make a second count-only request.
 */
export function createInfiniteDatasource<TData>({
  loadRows,
  onError,
  onFilterChanged,
  onLoadSuccess,
}: CreateInfiniteDatasourceOptions<TData>): IDatasource {
  const activeRequests = new Set<AbortController>();
  let activeFilterKey: string | undefined;
  let latestRequestSequence = 0;

  return {
    /** Called whenever Infinite Row Model needs another range of rows. */
    async getRows(params: IGetRowsParams) {
      const controller = new AbortController();
      activeRequests.add(controller);

      const request: FlatGridBlockRequest = {
        startRow: params.startRow,
        endRow: params.endRow,
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
          // A response can be correct for its own page/filter and still be stale for UI metadata.
          // Request sequence, not row/page number, decides which completed call may publish counts.
          isLatestRequest: requestSequence === latestRequestSequence,
        });

        // AG Grid sizes THIS request's query with the backend filtered total. Its own datasource lifecycle
        // decides whether an older response still belongs to the current row model.
        params.successCallback(result.rows, result.filteredCount);
      } catch (error) {
        // Datasource destruction intentionally aborts old work; only genuine failures reach the UI/grid.
        if (!controller.signal.aborted) {
          onError?.(error);
          params.failCallback();
        }
      } finally {
        activeRequests.delete(controller);
      }
    },

    destroy() {
      activeRequests.forEach((controller) => controller.abort());
      activeRequests.clear();
    },
  };
}
