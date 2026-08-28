import type { IServerSideDatasource, IServerSideGetRowsParams } from 'ag-grid-community';
import type {
  FlatGridBlockRequest,
  GridBlockResult,
  GridLoadErrorHandler,
  GridRowsLoader,
} from '../gridData.types';

interface ServerSideLoadSuccessMeta {
  /** True only for the most recently started request in this datasource instance. */
  isLatestRequest: boolean;
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
  let activeFilterKey: string | undefined;
  let latestRequestSequence = 0;

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
      const requestSequence = ++latestRequestSequence;

      if (activeFilterKey !== filterKey) {
        activeFilterKey = filterKey;
        onFilterChanged?.();
      }

      try {
        // Only flat paging/sort/filter metadata is mapped today. Grouping, aggregation and pivoting
        // stay native SSRM concerns to add when an actual feature requires their richer contract.
        const result = await loadRows(request, { signal: controller.signal });

        onLoadSuccess?.(result, request, {
          // Page direction is irrelevant: 1 -> 2 -> 3 and 3 -> 2 -> 1 use the same rule. If an older
          // request finishes after a newer one, it may complete for AG Grid but must not replace the
          // newest API count metadata rendered by React.
          isLatestRequest: requestSequence === latestRequestSequence,
        });

        // SSRM must size the query represented by THIS request. AG Grid owns whether an older request
        // is still relevant to its current store; count metadata is guarded independently above.
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
