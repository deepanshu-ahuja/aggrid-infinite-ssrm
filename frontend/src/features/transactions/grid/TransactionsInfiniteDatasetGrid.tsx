import { useEffect, useState } from 'react';
import type { FilterModel } from 'ag-grid-community';
import { useDatasetSelection } from '@/shared/grid/selection/infinite/useDatasetSelection';
import type {
  DatasetSelectionScope,
  ServerSelectionIntent,
} from '@/shared/grid/selection/serverSelection';
import { listTransactions } from '../api/transactions.api';
import type { TransactionsInfiniteGridOptions } from '../transactionsGrid.config';
import { TransactionsInfiniteTable } from './TransactionsInfiniteTable';

interface TransactionsInfiniteDatasetGridProps {
  /**
   * Dataset represented by the custom Infinite Select-All header.
   *
   * - `filtered`: all rows matching the active backend filter.
   * - `all`: every row in the dataset, independent of visible filters.
   */
  selectionScope: DatasetSelectionScope;

  /** Native AG Grid options resolved by Transactions feature configuration. */
  gridOptions: TransactionsInfiniteGridOptions;

  /**
   * Publishes logical selection only:
   *
   *     { mode: 'include' | 'exclude', ids: [...] }
   *
   * It does not execute a backend bulk action.
   */
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;

  /**
   * Publishes AG Grid's current applied filter model upward.
   *
   * The filtered strategy needs this only when a later user action converts `exclude` selection
   * into a backend query. Selection changes themselves still do not call a bulk endpoint.
   */
  onFilterModelChange?: (filterModel: FilterModel) => void;
}

/**
 * Composes the Transactions Infinite table with dataset-level selection.
 *
 * WHY PROPS ARE DECLARED HERE
 * ---------------------------
 * `TransactionsInfiniteGrid` is the parent/router that imports this child.
 *
 * This child deliberately does not import the parent's prop type back from
 * `TransactionsInfiniteGrid.tsx`. That avoids parent <-> child type coupling and keeps dependencies
 * pointed in one direction.
 */
export function TransactionsInfiniteDatasetGrid({
  selectionScope,
  gridOptions,
  onSelectionChange,
  onFilterModelChange,
}: TransactionsInfiniteDatasetGridProps) {
  /**
   * Total rows matching AG Grid's CURRENT accepted filter model.
   *
   * Used only by filtered Select All to calculate header state without loading every matching row.
   */
  const [filteredTotal, setFilteredTotal] = useState(0);

  /**
   * Total records in the complete dataset, ignoring visible grid filters.
   *
   * Used only by Select All Records.
   */
  const [allTotal, setAllTotal] = useState(0);

  /**
   * Failure of the supporting all-record total-count request.
   *
   * This is independent from datasource row-loading errors.
   */
  const [totalError, setTotalError] = useState<string>();

  useEffect(() => {
    if (selectionScope !== 'all') return;

    /**
     * We need only the unfiltered total count, not row data, so one row is sufficient.
     */
    const controller = new AbortController();

    void listTransactions(
      {
        offset: 0,
        limit: 1,
        sort: [],
        filters: [],
      },
      controller.signal,
    )
      .then(({ totalCount }) => {
        setAllTotal(totalCount);
        setTotalError(undefined);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTotalError(
            'The total row count required for all-record selection could not be loaded.',
          );
        }
      });

    return () => controller.abort();
  }, [selectionScope]);

  /**
   * Lifecycle rules are implemented in the shared hook:
   *
   * - filtered + include -> preserve explicit IDs on filter change;
   * - filtered + exclude -> clear because Select All Filtered belonged to the old query;
   * - all + include      -> preserve;
   * - all + exclude      -> preserve.
   */
  const selection = useDatasetSelection({
    scope: selectionScope,
    totalRowCount: selectionScope === 'filtered' ? filteredTotal : allTotal,
    onSelectionChange,
  });

  return (
    <TransactionsInfiniteTable
      gridOptions={gridOptions}
      selection={selection}
      selectionError={totalError}
      onFilteredTotalChange={
        selectionScope === 'filtered' ? setFilteredTotal : undefined
      }
      onFilterModelChange={onFilterModelChange}
    />
  );
}