import type { AgGridReactProps } from 'ag-grid-react';
import {
  serverBackedGridDefaults,
  type ServerBackedGridOptions,
} from '@/shared/grid/config/serverBackedGridDefaults';
import type { InfiniteSelectionMode } from '@/shared/grid/selection/serverSelection';
import type { Transaction } from './api/transactions.contracts';

export type TransactionsRowModel = 'infinite' | 'ssrm';

type TransactionsGridStateOptions = Pick<
  AgGridReactProps<Transaction>,
  'initialState' | 'onStateUpdated'
>;

/**
 * Feature-level editing lifecycle passed to either native row-model implementation.
 *
 * These are native AG Grid events, not a wrapper API. `TransactionsPage` uses them to accumulate
 * edited row/field values and restore those values when server-backed rows are rendered again.
 */
type TransactionsGridEditingOptions = Pick<
  AgGridReactProps<Transaction>,
  'onCellValueChanged' | 'onFirstDataRendered' | 'onViewportChanged'
>;

export type TransactionsInfiniteGridOptions = ServerBackedGridOptions<Transaction> &
  TransactionsGridStateOptions &
  TransactionsGridEditingOptions;
export type TransactionsSsrmGridOptions = ServerBackedGridOptions<Transaction> &
  TransactionsGridStateOptions &
  TransactionsGridEditingOptions;

interface TransactionsGridConfig {
  activeGrid: TransactionsRowModel;

  infinite: {
    selectionScope: InfiniteSelectionMode;
    gridOptions: TransactionsInfiniteGridOptions;
  };

  ssrm: {
    gridOptions: TransactionsSsrmGridOptions;
  };
}

/**
 * Transactions inherits shared server-backed defaults for both row models. Editing callbacks are
 * composed later by `TransactionsPage`; they are lifecycle behavior, not static application defaults.
 */
export const transactionsGridConfig: TransactionsGridConfig = {
  activeGrid: 'infinite',

  infinite: {
    selectionScope: 'page',
    gridOptions: {
      ...serverBackedGridDefaults,
    },
  },

  ssrm: {
    gridOptions: {
      ...serverBackedGridDefaults,
    },
  },
};
