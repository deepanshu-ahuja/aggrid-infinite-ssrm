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
 * WHY THIS IS A HOOK
 * ------------------
 * Every server-backed Infinite table otherwise repeats the same four pieces of orchestration:
 * datasource identity, visible load-error state, clearing that error after recovery, and native
 * `refreshInfiniteCache()` retry behavior. Those pieces form one lifecycle and should move together.
 *
 * WHAT THIS DOES NOT OWN
 * ----------------------
 * The hook does not know endpoints, request mappers, columns, overlays or feature UI. The concrete
 * grid still decides how to render `error` and wires `datasource` directly to `<AgGridReact>`.
 */
export function useInfiniteRowLoading<TData>({
  gridApi,
  loadRows,
  errorMessage = 'Rows could not be loaded. Please retry.',
}: UseInfiniteRowLoadingOptions<TData>) {
  /**
   * Renderable failure state for the current datasource. It clears only after a real request
   * succeeds or the user explicitly retries, so stale errors do not survive successful recovery.
   */
  const [error, setError] = useState<string>();

  /**
   * Wrap the feature loader only to own this loading lifecycle. Request translation/API work remains
   * in the feature loader supplied above.
   */
  const loadRowsWithRecovery = useCallback<GridRowsLoader<TData>>(
    async (request, context) => {
      const result = await loadRows(request, context);
      setError(undefined);
      return result;
    },
    [loadRows],
  );

  /**
   * Stable datasource identity prevents ordinary React renders from resetting Infinite cache state.
   * A new datasource is created only when the actual feature loader/error message changes.
   */
  const datasource = useMemo(
    () =>
      createInfiniteDatasource<TData>({
        loadRows: loadRowsWithRecovery,
        onError: () => setError(errorMessage),
      }),
    [errorMessage, loadRowsWithRecovery],
  );

  /** Clear the rendered error and ask AG Grid to retry its Infinite cache natively. */
  const retry = useCallback(() => {
    setError(undefined);
    gridApi.current?.refreshInfiniteCache();
  }, [gridApi]);

  /**
   * Cross-capability events such as a filter change may start a fresh query before a request runs;
   * expose a narrow clear operation rather than leaking the state setter to the feature root.
   */
  const clearError = useCallback(() => {
    setError(undefined);
  }, []);

  return {
    datasource,
    error,
    retry,
    clearError,
  };
}
