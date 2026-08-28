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
 * The normal API response already contains the two dataset-wide counts needed by selection UI:
 * `totalCount` for All Records and `filteredCount` for All Filtered. The datasource marks whether a
 * response belongs to the latest started request so an older response cannot overwrite newer count
 * metadata, regardless of whether the user paged forward or backward.
 */
export function useInfiniteRowLoading<TData>({
  gridApi,
  loadRows,
  errorMessage = 'Rows could not be loaded. Please retry.',
}: UseInfiniteRowLoadingOptions<TData>) {
  const [error, setError] = useState<string>();
  const [totalCount, setTotalCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);

  const datasource = useMemo(
    () =>
      createInfiniteDatasource<TData>({
        loadRows,
        onFilterChanged: () => {
          // The old filtered universe stops being authoritative as soon as a new filter request starts.
          setFilteredCount(0);
        },
        onLoadSuccess: (result, _request, { isLatestRequest }) => {
          if (!isLatestRequest) return;

          // Both displayed dataset-wide counts come from one accepted normal API response. This keeps
          // Infinite aligned with SSRM and avoids a separate count endpoint or AG Grid-derived count.
          setTotalCount(result.totalCount);
          setFilteredCount(result.filteredCount);
          setError(undefined);
        },
        onError: () => setError(errorMessage),
      }),
    [errorMessage, loadRows],
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
    filteredCount,
    retry,
    clearError,
  };
}
