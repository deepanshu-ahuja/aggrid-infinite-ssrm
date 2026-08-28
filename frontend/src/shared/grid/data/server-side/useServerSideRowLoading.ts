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
 * The normal API response supplies `totalCount` and `filteredCount`. The datasource also tells this
 * hook whether a completed response belongs to the latest started request, so a slower older call
 * cannot overwrite newer count metadata. Page direction does not matter; request start order does.
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
          // The previous filter total is no longer meaningful once a different filter request starts.
          setFilteredCount(0);
        },
        onLoadSuccess: (result, _request, { isLatestRequest }) => {
          if (!isLatestRequest) return;

          // Publish the two counts from the same newest normal API response used by the grid request.
          // This is intentionally the same count-source rule used by Infinite Row Model.
          setTotalCount(result.totalCount);
          setFilteredCount(result.filteredCount);
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
