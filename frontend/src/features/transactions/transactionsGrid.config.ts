// GRIDCAP-ROWMODEL-CLIENT | GRIDCAP-ROWMODEL-INFINITE | GRIDCAP-ROWMODEL-SSRM | GRIDCAP-PAGINATION | GRIDCAP-SEL-PAGE | GRIDCAP-SEL-FILTERED | GRIDCAP-SEL-ALL | GRIDCAP-ROW-ELIGIBILITY
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
import { transactionRowClassRules } from './grid/transactionRowInteraction';

/**
 * Native AG Grid options that may be supplied to the concrete row-model roots.
 *
 * Grid lifecycle handlers (GridApi ownership, preferences, editing, selection) are intentionally
 * composed inside each concrete Transactions grid root, not hidden in one common page/controller.
 * The GRIDCAP markers above make this feature-level configuration boundary discoverable alongside
 * each row-model implementation without turning the configuration object into a universal wrapper.
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
    // All Records is the Client demo default so the route visibly proves native AG Grid can select the
    // complete locally-held eligible dataset across pagination pages. The same controller still supports
    // `page` -> `currentPage` and `filtered` -> `filtered` without a separate Client grid implementation.
    selectionScope: 'all',
    gridOptions: {
      ...clientSideGridDefaults,
      rowClassRules: transactionRowClassRules,
    },
  },

  infinite: {
    selectionScope: 'page',
    gridOptions: {
      ...serverBackedGridDefaults,
      rowClassRules: transactionRowClassRules,
    },
  },

  ssrm: {
    gridOptions: {
      ...serverBackedGridDefaults,
      rowClassRules: transactionRowClassRules,
    },
  },
};
