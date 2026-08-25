import {
  serverBackedGridDefaults,
  type ServerBackedGridOptions,
} from '@/shared/grid/config/serverBackedGridDefaults';
import type { InfiniteSelectionMode } from '@/shared/grid/selection/serverSelection';
import type { Transaction } from './api/transactions.contracts';

/**
 * Native AG Grid options that may be supplied to the concrete row-model roots.
 *
 * Grid lifecycle handlers (GridApi ownership, preferences, editing, selection) are intentionally
 * composed inside `TransactionsInfiniteGrid` / `TransactionsSsrmGrid`, not in a common page.
 */
export type TransactionsInfiniteGridOptions = ServerBackedGridOptions<Transaction>;
export type TransactionsSsrmGridOptions = ServerBackedGridOptions<Transaction>;

interface TransactionsGridConfig {
  infinite: {
    selectionScope: InfiniteSelectionMode;
    gridOptions: TransactionsInfiniteGridOptions;
  };

  ssrm: {
    gridOptions: TransactionsSsrmGridOptions;
  };
}

/** Static feature choices; each row-model root is otherwise independently usable. */
export const transactionsGridConfig: TransactionsGridConfig = {
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
