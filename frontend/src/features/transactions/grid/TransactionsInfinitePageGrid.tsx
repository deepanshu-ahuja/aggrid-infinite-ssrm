import type { FilterModel } from 'ag-grid-community';
import { useCurrentPageSelection } from '@/shared/grid/selection/infinite/useCurrentPageSelection';
import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';
import type { TransactionsInfiniteGridOptions } from '../transactionsGrid.config';
import { TransactionsInfiniteTable } from './TransactionsInfiniteTable';

interface TransactionsInfinitePageGridProps {
  /** Native AG Grid options resolved by Transactions feature configuration. */
  gridOptions: TransactionsInfiniteGridOptions;

  /**
   * Publishes logical explicit/include selection for a future action.
   *
   * The current-page header is only a UI shortcut. Selected IDs can accumulate across pages.
   */
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;

  /**
   * Publishes AG Grid's currently applied filter model to the parent validation/action layer.
   *
   * Page selection itself does not need filters for membership, but keeping the table lifecycle
   * wiring identical across Infinite strategies avoids special-case grid implementations.
   */
  onFilterModelChange?: (filterModel: FilterModel) => void;
}

/**
 * Composes the Transactions Infinite table with current-page-header selection.
 *
 * This child declares the small contract it consumes directly instead of importing the parent's
 * prop type back from `TransactionsInfiniteGrid.tsx`. That keeps dependencies one-directional.
 */
export function TransactionsInfinitePageGrid({
  gridOptions,
  onSelectionChange,
  onFilterModelChange,
}: TransactionsInfinitePageGridProps) {
  /**
   * Page header selection always remains include/exact-ID selection.
   *
   * Pagination changes only which IDs the header operates on; it does not clear IDs selected on
   * previous pages.
   */
  const { selection, setCurrentPageIds } = useCurrentPageSelection({
    onSelectionChange,
  });

  return (
    <TransactionsInfiniteTable
      gridOptions={gridOptions}
      selection={selection}
      onCurrentPageIdsChange={setCurrentPageIds}
      onFilterModelChange={onFilterModelChange}
    />
  );
}