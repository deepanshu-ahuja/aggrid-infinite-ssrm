import { useCallback, useEffect, useState } from 'react';
import type { InfiniteSelectionMode } from '@/shared/grid/selection/serverSelection';

interface UseInfiniteDatasetSelectionSupportOptions {
  scope: InfiniteSelectionMode;

  /**
   * Feature-owned way to fetch the complete unfiltered dataset total.
   *
   * The shared hook owns lifecycle/error/reset behavior; it deliberately knows nothing about the
   * feature's API contract or request mapper.
   */
  loadAllTotal?: (signal: AbortSignal) => Promise<number>;
}

/**
 * Supporting totals required by Infinite Select-All semantics over unloaded rows.
 *
 * `filteredTotal` comes from AG Grid's currently accepted Infinite model. `allTotal` comes from a
 * feature-supplied unfiltered count loader. Keeping this lifecycle shared prevents each Infinite
 * table from reimplementing the same count/error/reset state while preserving feature API ownership.
 */
export function useInfiniteDatasetSelectionSupport({
  scope,
  loadAllTotal,
}: UseInfiniteDatasetSelectionSupportOptions) {
  /** Authoritative row count for the currently accepted filtered Infinite query. */
  const [filteredTotal, setFilteredTotal] = useState(0);

  /** Complete unfiltered dataset count used only by all-record selection. */
  const [allTotal, setAllTotal] = useState(0);

  /** Supporting-count failure; normal datasource row loading may still remain usable. */
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (scope !== 'all' || !loadAllTotal) return;

    const controller = new AbortController();

    void loadAllTotal(controller.signal)
      .then((total) => {
        setAllTotal(total);
        setError(undefined);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(
            'The total row count required for all-record selection could not be loaded.',
          );
        }
      });

    return () => controller.abort();
  }, [loadAllTotal, scope]);

  /** Old filtered totals belong to the old query and must not drive a new header while reloading. */
  const resetFilteredTotal = useCallback(() => {
    setFilteredTotal(0);
  }, []);

  return {
    totalRowCount:
      scope === 'all' ? allTotal : scope === 'filtered' ? filteredTotal : 0,
    error,
    setFilteredTotal,
    resetFilteredTotal,
  };
}
