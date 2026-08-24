import type { IServerSideDatasource, IServerSideGetRowsParams } from 'ag-grid-community';
import type { GridLoadErrorHandler, GridRowsLoader } from '../gridData.types';

interface CreateServerSideDatasourceOptions<TData> {
  loadRows: GridRowsLoader<TData>;
  onError?: GridLoadErrorHandler;
  defaultBlockSize?: number;
}

export function createServerSideDatasource<TData>({
  loadRows,
  onError,
  defaultBlockSize = 100,
}: CreateServerSideDatasourceOptions<TData>): IServerSideDatasource<TData> {
  const activeRequests = new Set<AbortController>();

  return {
    async getRows(params: IServerSideGetRowsParams<TData>) {
      const controller = new AbortController();
      activeRequests.add(controller);

      const startRow = params.request.startRow ?? 0;
      const endRow = params.request.endRow ?? startRow + defaultBlockSize;

      try {
        // Only flat paging/sort/filter metadata is mapped today. Grouping, aggregation and pivoting
        // stay native SSRM concerns to add when an actual feature requires their richer contract.
        const result = await loadRows(
          {
            startRow,
            endRow,
            sortModel: params.request.sortModel,
            filterModel: params.request.filterModel ?? {},
          },
          { signal: controller.signal },
        );

        params.success({
          rowData: result.rows,
          rowCount: result.totalCount,
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
