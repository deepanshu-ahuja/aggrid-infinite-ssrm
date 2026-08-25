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

  /** Publishes logical `include/exclude` selection; it does not execute a backend action. */
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;

  /** Publishes AG Grid's currently applied filter model for later action-time payload building. */
  onFilterModelChange?: (filterModel: FilterModel) => void;
}

/**
 * Composes the Transactions Infinite table with the behavior Infinite does NOT provide natively:
 * dataset-wide Select All over unloaded rows.
 *
 * The total-count states below are application/supporting data, not copies of AG Grid state:
 * - filteredTotal is the accepted backend-query size used by the custom header;
 * - allTotal comes from an intentionally unfiltered backend count request;
 * - totalError presents failure of that supporting request.
 */
export function TransactionsInfiniteDatasetGrid({
  selectionScope,
  gridOptions,
  onSelectionChange,
  onFilterModelChange,
}: TransactionsInfiniteDatasetGridProps) {
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [allTotal, setAllTotal] = useState(0);
  const [totalError, setTotalError] = useState<string>();

  useEffect(() => {
    if (selectionScope !== 'all') return;

    /** We need only the unfiltered total count, not row data, so one row is sufficient. */
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
   * This shared Infinite hook still owns the compact logical dataset-selection model. It exists
   * because Infinite cannot natively represent unloaded Select All. Ordinary page selection no
   * longer uses this hook and is AG Grid-owned.
   */
  const selection = useDatasetSelection({
    scope: selectionScope,
    totalRowCount: selectionScope === 'filtered' ? filteredTotal : allTotal,
    onSelectionChange,
  });

  return (
    <TransactionsInfiniteTable
      gridOptions={gridOptions}
      selectionMode="dataset"
      selection={selection}
      selectionError={totalError}
      onFilteredTotalChange={
        selectionScope === 'filtered' ? setFilteredTotal : undefined
      }
      onFilterModelChange={onFilterModelChange}
    />
  );
}
