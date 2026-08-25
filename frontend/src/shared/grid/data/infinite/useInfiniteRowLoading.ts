import { useCallback, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import type { GridApi } from 'ag-grid-community';
import { createInfiniteDatasource } from './createInfiniteDatasource';
import type { GridRowsLoader } from '../gridData.types';

interface UseInfiniteRowLoadingOptions<TData> {
  /** Root-owned GridApi used only for the native retry operation. */
  gridApi: RefObject<GridApi<TData> | null>;

  /** Feature-owned loader that translates a flat AG Grid request into the feature API contract. */
  loadRows: GridRowsLoader<TData>;

  /** Optional message rendered by the feature root when the datasource reports a real failure. */
  errorMessage?: string;
}

/**
 * Reusable Infinite Row Model loading lifecycle.
 *
 * Besides datasource identity/error/retry mechanics, this hook exposes the complete unfiltered count
 * returned by the NORMAL page request. That avoids a second count-only request for All Records
 * selection. The current filtered/query count still belongs to AG Grid's accepted row model and is
 * read there by the selection controller, avoiding stale overlapping-request races.
 */
export function useInfiniteRowLoading<TData>({
  gridApi,
  loadRows,
  errorMessage = 'Rows could not be loaded. Please retry.',
}: UseInfiniteRowLoadingOptions<TData>) {
  const [error, setError] = useState<string>();
  const [totalCount, setTotalCount] = useState(0);

  const loadRowsWithRecovery = useCallback<GridRowsLoader<TData>>(
    async (request, context) => {
      const result = await loadRows(request, context);

      // `totalCount` is independent of the current filter, so any successful normal page response
      // can safely publish it even when multiple row requests overlap.
      setTotalCount(result.totalCount);
      setError(undefined);
      return result;
    },
    [loadRows],
  );

  const datasource = useMemo(
    () =>
      createInfiniteDatasource<TData>({
        loadRows: loadRowsWithRecovery,
        onError: () => setError(errorMessage),
      }),
    [errorMessage, loadRowsWithRecovery],
  );

  const retry = useCallback(() => {
    setError(undefined);
    gridApi.current?.refreshInfiniteCache();
  }, [gridApi]);

  const clearError = useCallback(() => {
    setError(undefined);
  }, []);

  return {
    datasource,
    error,
    totalCount,
    retry,
    clearError,
  };
}
