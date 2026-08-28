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
 * It owns the repeated mechanics around datasource identity, visible load-error state and native
 * `retryServerSideLoads()` behavior. Endpoint/request mapping remains feature-owned, and the feature
 * root still wires the returned datasource/error directly into native AG Grid props.
 *
 * The hook also exposes the complete unfiltered `totalCount` returned by normal row loading. SSRM's
 * native selection state can represent Select All across unloaded rows, but it cannot manufacture the
 * business dataset size needed to display a logical selected-row total. Keeping the API-provided total
 * here avoids a second count request while leaving selection representation native to AG Grid.
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

  /** Clear the old visible error only after an actual backend request has recovered successfully. */
  const loadRowsWithRecovery = useCallback<GridRowsLoader<TData>>(
    async (request, context) => {
      const result = await loadRows(request, context);

      // The backend contract defines `totalCount` as filter-independent, so any successful block may
      // publish it even when SSRM has overlapping requests for different cache blocks/filter states.
      setTotalCount(result.totalCount);
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
    retry,
    clearError,
  };
}
