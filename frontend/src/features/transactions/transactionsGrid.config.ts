import type { AgGridReactProps } from 'ag-grid-react';
import {
  serverBackedGridDefaults,
  type ServerBackedGridOptions,
} from '@/shared/grid/config/serverBackedGridDefaults';
import type { InfiniteSelectionMode } from '@/shared/grid/selection/serverSelection';
import type { Transaction } from './api/transactions.contracts';

/** The two AG Grid row-model implementations supported by Transactions. */
export type TransactionsRowModel = 'infinite' | 'ssrm';

/**
 * Native Grid State props accepted by both Transactions grids.
 *
 * Keep these separate from `ServerBackedGridOptions`: persisted user state is a table-preference
 * concern, not a server pagination/cache default.
 */
type TransactionsGridStateOptions = Pick<
  AgGridReactProps<Transaction>,
  'initialState' | 'onStateUpdated'
>;

export type TransactionsInfiniteGridOptions = ServerBackedGridOptions<Transaction> &
  TransactionsGridStateOptions;
export type TransactionsSsrmGridOptions = ServerBackedGridOptions<Transaction> &
  TransactionsGridStateOptions;

interface TransactionsGridConfig {
  /** Chooses which separate implementation `TransactionsPage` renders. */
  activeGrid: TransactionsRowModel;

  infinite: {
    /**
     * Defines what the Infinite custom header selection represents.
     *
     * Page / filtered / all are Transactions UI/product choices, so this remains feature-specific
     * rather than becoming an application-wide AG Grid default.
     */
    selectionScope: InfiniteSelectionMode;
    gridOptions: TransactionsInfiniteGridOptions;
  };

  ssrm: {
    /**
     * SSRM remains separate because its datasource, cache lifecycle, native selection APIs and
     * failure/retry behavior differ from Infinite Row Model.
     */
    gridOptions: TransactionsSsrmGridOptions;
  };
}

/**
 * Transactions currently inherits the shared server-backed defaults for both row models.
 *
 * If Transactions later needs a genuine exception, override only that native AG Grid property and
 * document why it differs rather than copying the whole defaults object.
 *
 * Use an explicit `TransactionsGridConfig` annotation rather than `satisfies` here. `satisfies`
 * would preserve `activeGrid` as the exact literal currently written below, making TypeScript treat
 * the other row-model branch in `TransactionsPage` as unreachable whenever this value is switched.
 */
export const transactionsGridConfig: TransactionsGridConfig = {
  activeGrid: 'infinite',

  infinite: {
    /**
     * `page` means only that the HEADER checkbox operates on the current page. Explicit selected IDs
     * can still accumulate across pages and remain logical `include` selection.
     */
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
