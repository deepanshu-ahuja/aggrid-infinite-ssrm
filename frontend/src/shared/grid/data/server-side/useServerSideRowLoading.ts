import { useCallback, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import type { GridApi } from 'ag-grid-community';
import { createServerSideDatasource } from './createServerSideDatasource';
import type { GridRowsLoader } from '../gridData.types';

interface UseServerSideRowLoadingOptions<TData> {
  /** Root-owned GridApi used only for native SSRM retry. */
  gridApi: RefObject<GridApi<TData> | null>;

  /** Feature-owned flat row loader shared across row-model adapters. */
  loadRows: GridRowsLoader<TData>;

  /** Cache block fallback passed to the SSRM datasource adapter. */
  defaultBlockSize?: number;

  /** Optional feature-facing message for real datasource failures. */
  errorMessage?: string;
}

/**
 * Reusable SSRM loading lifecycle.
 *
 * It owns datasource identity, visible load-error state, native retry, and the normal API counts used
 * by server-wide selection presentation. Request-order bookkeeping stays inside the datasource closure;
 * React receives only the latest publishable counts.
 */
export function useServerSideRowLoading<TData>({
  gridApi,
  loadRows,
  defaultBlockSize = 100,
  errorMessage = 'Rows could not be loaded. Please retry.',
}: UseServerSideRowLoadingOptions<TData>) {
  /** Renderable SSRM datasource failure state; unrelated selection/edit errors stay separate. */
  const [error, setError] = useState<string>();
  const [totalCount, setTotalCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);

  /** Stable datasource identity prevents normal React renders from rebuilding SSRM request state. */
  const datasource = useMemo(
    () =>
      createServerSideDatasource<TData>({
        loadRows,
        defaultBlockSize,
        onFilterChanged: () => {
          // The previous filter's count is no longer meaningful as soon as a new filter request starts.
          // Keep the UI at zero until a response for the new universe is accepted for metadata.
          setFilteredCount(0);
        },
        onLoadSuccess: (result, _request, { isLatestFilter }) => {
          // `totalCount` is filter-independent, so every successful response may publish it.
          setTotalCount(result.totalCount);

          if (isLatestFilter) {
            // Only the newest filter universe may drive the rendered All Filtered selected total.
            setFilteredCount(result.filteredCount);
          }

          setError(undefined);
        },
        onError: () => setError(errorMessage),
      }),
    [defaultBlockSize, errorMessage, loadRows],
  );

  /** Clear the rendered error and let AG Grid retry failed server-side blocks natively. */
  const retry = useCallback(() => {
    setError(undefined);
    gridApi.current?.retryServerSideLoads();
  }, [gridApi]);

  const clearError = useCallback(() => {
    setError(undefined);
  }, []);

  return {
    datasource,
    error,
    totalCount,
    filteredCount,
    retry,
    clearError,
  };
}
