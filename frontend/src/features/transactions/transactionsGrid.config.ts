import {
  clientSideGridDefaults,
  type ClientSideGridOptions,
} from '@/shared/grid/config/clientSideGridDefaults';
import {
  serverBackedGridDefaults,
  type ServerBackedGridOptions,
} from '@/shared/grid/config/serverBackedGridDefaults';
import type { ClientSideSelectionScope } from '@/shared/grid/selection/client-side/useClientSideSelectionController';
import type { InfiniteSelectionMode } from '@/shared/grid/selection/serverSelection';
import type { Transaction } from './api/transactions.contracts';

/**
 * Native AG Grid options that may be supplied to the concrete row-model roots.
 *
 * Grid lifecycle handlers (GridApi ownership, preferences, editing, selection) are intentionally
 * composed inside each concrete Transactions grid root, not hidden in one common page/controller.
 */
export type TransactionsClientGridOptions = ClientSideGridOptions<Transaction>;
export type TransactionsInfiniteGridOptions = ServerBackedGridOptions<Transaction>;
export type TransactionsSsrmGridOptions = ServerBackedGridOptions<Transaction>;

interface TransactionsGridConfig {
  client: {
    selectionScope: ClientSideSelectionScope;
    gridOptions: TransactionsClientGridOptions;
  };

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
  client: {
    // Current Page is a useful conservative default for this demo. Client-Side also supports native
    // `filtered` and `all` header selection without changing the controller implementation.
    selectionScope: 'page',
    gridOptions: {
      ...clientSideGridDefaults,
    },
  },

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
