import type { IDatasource, IGetRowsParams } from 'ag-grid-community';
import type { GridLoadErrorHandler, GridRowsLoader } from '../gridData.types';

interface CreateInfiniteDatasourceOptions<TData> {
  loadRows: GridRowsLoader<TData>;
  onError?: GridLoadErrorHandler;
}

/**
 * Creates the datasource consumed by AG Grid's Infinite Row Model.
 *
 * The feature loader returns both complete-dataset and current-query counts. AG Grid must receive the
 * current-query `filteredCount` as its row-model size; the complete `totalCount` is application
 * metadata for capabilities such as All Records selection and must not widen the visible row model.
 */
export function createInfiniteDatasource<TData>({
  loadRows,
  onError,
}: CreateInfiniteDatasourceOptions<TData>): IDatasource {
  const activeRequests = new Set<AbortController>();

  return {
    async getRows(params: IGetRowsParams) {
      const controller = new AbortController();
      activeRequests.add(controller);

      try {
        const result = await loadRows(
          {
            startRow: params.startRow,
            endRow: params.endRow,
            sortModel: params.sortModel,
            filterModel: params.filterModel,
          },
          { signal: controller.signal },
        );

        params.successCallback(result.rows, result.filteredCount);
      } catch (error) {
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
