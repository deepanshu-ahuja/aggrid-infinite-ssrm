import type { FilterModel } from 'ag-grid-community';
import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';
import type { TransactionsInfiniteGridOptions } from '../transactionsGrid.config';
import { TransactionsInfiniteTable } from './TransactionsInfiniteTable';

interface TransactionsInfinitePageGridProps {
  /** Native AG Grid options resolved by Transactions feature configuration. */
  gridOptions: TransactionsInfiniteGridOptions;

  /**
   * Publishes native explicit/include selection for a future action.
   *
   * The current-page header is only a native RowNode shortcut. AG Grid itself owns the selected IDs,
   * including selections accumulated on previously visited pages.
   */
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;

  /** Publishes AG Grid's currently applied filter model to the action/validation layer. */
  onFilterModelChange?: (filterModel: FilterModel) => void;
}

/**
 * Infinite current-page composition.
 *
 * There is intentionally no React selection hook here anymore. Stable `getRowId` lets AG Grid own
 * ordinary Infinite row selection, while the shared selection-column header operates on the native
 * current-page RowNodes via GridApi.
 */
export function TransactionsInfinitePageGrid({
  gridOptions,
  onSelectionChange,
  onFilterModelChange,
}: TransactionsInfinitePageGridProps) {
  return (
    <TransactionsInfiniteTable
      gridOptions={gridOptions}
      selectionMode="page"
      onNativeSelectionChange={onSelectionChange}
      onFilterModelChange={onFilterModelChange}
    />
  );
}
