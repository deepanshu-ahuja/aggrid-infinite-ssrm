import { useCallback, useMemo, useRef, useState } from 'react';
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
 * It owns the repeated mechanics around datasource identity, visible load-error state and native
 * `retryServerSideLoads()` behavior. Endpoint/request mapping remains feature-owned, and the feature
 * root still wires the returned datasource/error directly into native AG Grid props.
 *
 * Normal backend page responses already include both `totalCount` and `filteredCount`, so selection
 * presentation reuses those values instead of issuing count-only requests. `totalCount` is safe to
 * publish from any successful request because it is filter-independent. `filteredCount` needs an
 * extra stale-response guard because an older filter request can finish after a newer one.
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

  /**
   * Tracks the newest filter universe requested by SSRM.
   *
   * Multiple cache blocks for the same filter legitimately overlap and all report the same filtered
   * total. When a new filter starts, however, a slower response from the old filter must not overwrite
   * the count that the UI now associates with the new filter.
   */
  const activeFilterKey = useRef<string>();

  /** Clear the old visible error only after an actual backend request has recovered successfully. */
  const loadRowsWithRecovery = useCallback<GridRowsLoader<TData>>(
    async (request, context) => {
      const filterKey = JSON.stringify(request.filterModel ?? {});

      if (activeFilterKey.current !== filterKey) {
        // A new filter defines a new selectable universe. Reset the rendered filtered total until a
        // response for THIS filter arrives instead of briefly showing the previous filter's count.
        activeFilterKey.current = filterKey;
        setFilteredCount(0);
      }

      const result = await loadRows(request, context);

      // `totalCount` is filter-independent, so any successful block may publish it safely.
      setTotalCount(result.totalCount);

      if (activeFilterKey.current === filterKey) {
        // Only the newest filter universe may publish its count. Older in-flight responses can still
        // finish, but their `filteredCount` is now stale for presentation/selection semantics.
        setFilteredCount(result.filteredCount);
      }

      setError(undefined);
      return result;
    },
    [loadRows],
  );

  /** Stable datasource identity prevents normal React renders from rebuilding SSRM request state. */
  const datasource = useMemo(
    () =>
      createServerSideDatasource<TData>({
        loadRows: loadRowsWithRecovery,
        onError: () => setError(errorMessage),
        defaultBlockSize,
      }),
    [defaultBlockSize, errorMessage, loadRowsWithRecovery],
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
