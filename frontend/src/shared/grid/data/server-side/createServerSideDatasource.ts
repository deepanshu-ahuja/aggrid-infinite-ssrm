import type { IServerSideDatasource, IServerSideGetRowsParams } from 'ag-grid-community';
import type {
  FlatGridBlockRequest,
  GridBlockResult,
  GridLoadErrorHandler,
  GridRowsLoader,
} from '../gridData.types';

interface ServerSideLoadSuccessMeta {
  /** True only when this response belongs to the newest filter universe requested by this datasource. */
  isLatestFilter: boolean;
}

interface CreateServerSideDatasourceOptions<TData> {
  loadRows: GridRowsLoader<TData>;
  onError?: GridLoadErrorHandler;
  onFilterChanged?: () => void;
  onLoadSuccess?: (
    result: GridBlockResult<TData>,
    request: FlatGridBlockRequest,
    meta: ServerSideLoadSuccessMeta,
  ) => void;
  defaultBlockSize?: number;
}

export function createServerSideDatasource<TData>({
  loadRows,
  onError,
  onFilterChanged,
  onLoadSuccess,
  defaultBlockSize = 100,
}: CreateServerSideDatasourceOptions<TData>): IServerSideDatasource<TData> {
  const activeRequests = new Set<AbortController>();

  /**
   * Mutable request-order state belongs to this datasource instance, not React.
   *
   * SSRM can have an old filter request still in flight when a new filter starts. Both responses may
   * be valid for their own request, but only the newest filter is allowed to publish UI metadata such
   * as `filteredCount`. Keeping the key in this closure avoids mirroring datasource lifecycle in a
   * React ref and lets the hook receive a simple `isLatestFilter` fact on success.
   */
  let activeFilterKey: string | undefined;

  return {
    async getRows(params: IServerSideGetRowsParams<TData>) {
      const controller = new AbortController();
      activeRequests.add(controller);

      const startRow = params.request.startRow ?? 0;
      const endRow = params.request.endRow ?? startRow + defaultBlockSize;
      const request: FlatGridBlockRequest = {
        startRow,
        endRow,
        sortModel: params.request.sortModel,
        filterModel: params.request.filterModel ?? {},
      };
      const filterKey = JSON.stringify(request.filterModel);

      if (activeFilterKey !== filterKey) {
        activeFilterKey = filterKey;
        onFilterChanged?.();
      }

      try {
        // Only flat paging/sort/filter metadata is mapped today. Grouping, aggregation and pivoting
        // stay native SSRM concerns to add when an actual feature requires their richer contract.
        const result = await loadRows(request, { signal: controller.signal });

        onLoadSuccess?.(result, request, {
          // A slower response from an older filter can still finish, but it must not overwrite count
          // metadata associated with the filter the user is currently viewing.
          isLatestFilter: activeFilterKey === filterKey,
        });

        // SSRM must size the query represented by THIS request. AG Grid owns whether an older request
        // is still relevant to its current store; our metadata callback above independently guards UI
        // state from stale-filter responses.
        params.success({
          rowData: result.rows,
          rowCount: result.filteredCount,
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          onError?.(error);
          params.fail();
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
