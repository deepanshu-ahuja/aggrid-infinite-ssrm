import { useCallback, useEffect, useState } from 'react';
import type { InfiniteSelectionMode } from '@/shared/grid/selection/serverSelection';

interface UseInfiniteDatasetSelectionSupportOptions {
  /** Current Infinite selection behavior chosen by the concrete grid root. */
  scope: InfiniteSelectionMode;

  /**
   * Feature-owned way to fetch the COMPLETE unfiltered dataset total.
   *
   * The shared hook owns request lifetime/error/reset behavior; it deliberately knows nothing about
   * the feature's API contract, request mapper or row type. The callback is optional because page and
   * filtered modes never need the all-record total.
   */
  loadAllTotal?: (signal: AbortSignal) => Promise<number>;
}

/**
 * Supporting totals required by Infinite Select-All semantics over unloaded rows.
 *
 * WHY THIS IS SHARED
 * ------------------
 * Every Infinite table that offers dataset-wide Select All needs the same lifecycle:
 * - filtered mode derives its total from AG Grid's accepted filtered model;
 * - all mode separately loads the complete UNFILTERED dataset total;
 * - filter changes must invalidate the old filtered total immediately;
 * - the all-total request must be abortable on unmount/scope changes;
 * - supporting-count failure must stay separate from normal datasource failure.
 *
 * The hook owns only that lifecycle. Feature code still owns HOW an unfiltered total is fetched.
 */
export function useInfiniteDatasetSelectionSupport({
  scope,
  loadAllTotal,
}: UseInfiniteDatasetSelectionSupportOptions) {
  /**
   * Row count for AG Grid's currently accepted FILTERED Infinite query.
   *
   * This is React state because the custom selection header renders from it. The concrete grid root
   * updates it only after AG Grid confirms the current model/last-row state, which avoids stale
   * datasource requests publishing an older query's total.
   */
  const [filteredTotal, setFilteredTotal] = useState(0);

  /**
   * Complete UNFILTERED dataset count used only when `scope === 'all'`.
   * It intentionally survives visible filter changes because "all records" is independent of the
   * filters currently applied to the grid.
   */
  const [allTotal, setAllTotal] = useState(0);

  /**
   * Failure of the supporting all-total request.
   * Normal row loading can still succeed, so callers should present this separately from datasource
   * errors instead of disabling the whole grid.
   */
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (scope !== 'all' || !loadAllTotal) return;

    /**
     * The loader may outlive the render that started it. Abort on scope/unmount changes so a late
     * response cannot overwrite state after all-record selection is no longer active.
     */
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

  /**
   * Clear the old query's filtered total as soon as filters change.
   * Keeping it until new rows arrive would make the custom selection header temporarily describe the
   * previous query, which is semantically wrong even though the numeric value may look plausible.
   */
  const resetFilteredTotal = useCallback(() => {
    setFilteredTotal(0);
  }, []);

  /**
   * The consumer needs one effective count. Page mode returns zero because page selection is native
   * AG Grid behavior and does not depend on this application-owned dataset-total capability.
   */
  const totalRowCount =
    scope === 'all'
      ? allTotal
      : scope === 'filtered'
        ? filteredTotal
        : 0;

  return {
    totalRowCount,
    error,
    /** Updated by the concrete grid only from AG Grid's accepted filtered model. */
    setFilteredTotal,
    resetFilteredTotal,
  };
}
