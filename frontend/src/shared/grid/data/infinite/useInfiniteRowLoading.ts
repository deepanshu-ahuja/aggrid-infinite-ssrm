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
 * Besides datasource identity/error/retry mechanics, this hook exposes the normal API counts used by
 * dataset-wide selected totals:
 *
 * - `totalCount` -> All Records universe;
 * - `filteredCount` -> All Filtered universe.
 *
 * Both come from the SAME row-loading response; Select All does not trigger another count endpoint.
 * The datasource publishes whether a response belongs to the newest started request, so React never
 * needs to compare page numbers, inspect AG Grid's cache, or read request-order refs during render.
 */
export function useInfiniteRowLoading<TData>({
  gridApi,
  loadRows,
  errorMessage = 'Rows could not be loaded. Please retry.',
}: UseInfiniteRowLoadingOptions<TData>) {
  /** User-visible datasource failure state; selection/edit/export errors are owned elsewhere. */
  const [error, setError] = useState<string>();

  /**
   * Dataset-wide counts from the latest accepted normal API response.
   *
   * These are query metadata, not a copy of AG Grid row data. Keeping only the two numbers in React
   * lets the selected-count UI rerender without creating a second source of truth for loaded rows.
   */
  const [totalCount, setTotalCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);

  /**
   * Stable datasource identity prevents ordinary React rerenders from resetting Infinite request state.
   * Request ordering itself stays inside the datasource closure where the async lifecycle actually lives.
   */
  const datasource = useMemo(
    () =>
      createInfiniteDatasource<TData>({
        loadRows,
        onFilterChanged: () => {
          // The previous filtered universe stops being meaningful as soon as a different filter starts.
          // Clear only the filter-dependent number; `totalCount` is filter-independent.
          setFilteredCount(0);
        },
        onLoadSuccess: (result, _request, { isLatestRequest }) => {
          // Freshness is request-order based, not page-number based. Therefore forward and backward
          // navigation follow the same rule: an older response cannot replace a newer API result.
          if (!isLatestRequest) return;

          // Both server-backed row models now use the normal API's dataset/query totals for dataset-wide
          // selected counts. This deliberately replaces the old Infinite-only `isLastRowIndexKnown()`
          // count derivation and gives one reusable contract across Infinite + SSRM.
          setTotalCount(result.totalCount);
          setFilteredCount(result.filteredCount);
          setError(undefined);
        },
        onError: () => setError(errorMessage),
      }),
    [errorMessage, loadRows],
  );

  /** Clear the visible error and let AG Grid refresh the Infinite datasource natively. */
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
