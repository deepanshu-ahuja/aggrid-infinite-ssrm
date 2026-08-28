// GRIDCAP-ROWMODEL-SSRM | GRIDCAP-DATA-LOAD | GRIDCAP-REQUEST-FRESHNESS | GRIDCAP-ERROR-RETRY | GRIDCAP-LIFECYCLE-REFRESH | GRIDCAP-COUNT-SELECTED
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
 * It owns the repeated mechanics around datasource identity, visible load-error state, native
 * `retryServerSideLoads()` behavior, and the renderable API count metadata used by dataset-wide
 * selected totals. Endpoint/request mapping remains feature-owned, and the feature root still wires
 * the returned datasource/error/counts directly into native AG Grid behavior.
 *
 * The normal API response supplies `totalCount` and `filteredCount`. Request freshness is decided by
 * the datasource from request START ORDER, never by page number. That matters equally when navigating
 * forward or backward.
 */
export function useServerSideRowLoading<TData>({
  gridApi,
  loadRows,
  defaultBlockSize = 100,
  errorMessage = 'Rows could not be loaded. Please retry.',
}: UseServerSideRowLoadingOptions<TData>) {
  /** Renderable SSRM datasource failure state; unrelated selection/edit errors stay separate. */
  const [error, setError] = useState<string>();

  /**
   * Dataset/query totals from the newest accepted normal row request.
   *
   * These numbers are deliberately separate from AG Grid RowNodes: All Records / All Filtered can
   * describe unloaded server rows, so the UI needs backend query metadata rather than loaded-row counts.
   */
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
          // Clear only filteredCount; totalCount describes the unfiltered dataset and stays meaningful.
          setFilteredCount(0);
        },
        onLoadSuccess: (result, _request, { isLatestRequest }) => {
          // GRIDCAP-REQUEST-FRESHNESS
          /**
           * Example: request A starts, then request B starts. B is now the latest request.
           *
           * - If B resolves first, publish B's totalCount/filteredCount.
           * - If A resolves afterwards, A is still allowed to finish for AG Grid's own lifecycle, but
           *   `isLatestRequest` is false so A MUST NOT replace the count metadata already owned by B.
           *
           * The exact same rule works page 1 -> 2 and page 3 -> 2. Direction is irrelevant; only the
           * order in which requests started decides which response may update the rendered counts.
           */
          if (!isLatestRequest) return;

          // Publish both values from the same newest normal API response. Infinite uses the identical
          // count-source rule, while the two row models keep their separate selection implementations.
          setTotalCount(result.totalCount);
          setFilteredCount(result.filteredCount);
          setError(undefined);
        },
        onError: () => setError(errorMessage),
      }),
    [defaultBlockSize, errorMessage, loadRows],
  );

  /** Clear the rendered error and let AG Grid retry failed server-side blocks natively. */
  // GRIDCAP-ERROR-RETRY
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
