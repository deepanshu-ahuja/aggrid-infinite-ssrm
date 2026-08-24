import type { InfiniteSelectionMode } from '@/shared/grid/selection/serverSelection';
import {
  serverBackedGridDefaults,
  type ServerBackedGridOptions,
} from '@/shared/grid/config/serverBackedGridDefaults';
import type { Transaction } from './api/transactions.contracts';

/**
 * The two AG Grid row-model implementations that the Transactions feature currently supports.
 *
 * They intentionally remain separate implementations rather than one component with many
 * row-model-specific branches. `activeGrid` below selects which implementation the feature renders.
 */
export type TransactionsRowModel = 'infinite' | 'ssrm';

/**
 * Transactions currently uses the same native AG Grid server-backed option subset for both row
 * models.
 *
 * The shared type keeps these properties aligned across server-backed tables while retaining
 * AG Grid's real property names. If Transactions later needs a table-specific value, it can override
 * that individual property in `transactionsGridConfig` without redefining the whole default set.
 */
export type TransactionsInfiniteGridOptions = ServerBackedGridOptions<Transaction>;
export type TransactionsSsrmGridOptions = ServerBackedGridOptions<Transaction>;

/**
 * Feature-level configuration for the Transactions grids.
 *
 * Responsibility boundary:
 * - Shared grid configuration owns company/application defaults that are expected to repeat across
 *   many server-backed tables.
 * - This file owns choices that are specific to the Transactions feature.
 *
 * Therefore pagination/cache defaults should normally NOT be copied into this file. Add an override
 * here only when Transactions has an intentional reason to behave differently from the shared
 * default.
 */
interface TransactionsGridConfig {
  /**
   * Chooses which separate grid implementation `TransactionsPage` renders.
   *
   * This is a feature/deployment choice, not an AG Grid default. The application does not mount both
   * implementations or expose a row-model chooser to the end user.
   */
  activeGrid: TransactionsRowModel;

  infinite: {
    /**
     * Defines what the Infinite Row Model's custom header-selection behaviour represents.
     *
     * Selection is intentionally kept feature-specific for now because we have not yet completed the
     * selection-semantics review. Do not promote this value into shared defaults until those
     * semantics are validated.
     */
    selectionScope: InfiniteSelectionMode;

    /**
     * Native AG Grid options for the Transactions Infinite grid.
     *
     * Shared server-backed defaults are spread below. Any property added after that spread is an
     * explicit Transactions-specific override and should be documented with the reason it differs.
     */
    gridOptions: TransactionsInfiniteGridOptions;
  };

  ssrm: {
    /**
     * Native AG Grid options for the Transactions SSRM grid.
     *
     * SSRM remains a separate implementation because its datasource, cache lifecycle, selection
     * APIs, grouping capabilities, and failure/retry behaviour differ from the Infinite Row Model.
     */
    gridOptions: TransactionsSsrmGridOptions;
  };
}

/**
 * Transactions grid choices.
 *
 * Both row models currently use the same conservative server-backed defaults:
 * - pagination enabled;
 * - 25 rows per visible page;
 * - page-size choices of 10 / 25 / 50;
 * - 50-row datasource blocks;
 * - at most five cached blocks;
 * - a small block-load debounce;
 * - one concurrent datasource request.
 *
 * Those values live in `serverBackedGridDefaults` because they are application defaults, not
 * Transaction-domain rules.
 *
 * If Transactions later needs a genuine exception, override only that property:
 *
 * ```ts
 * gridOptions: {
 *   ...serverBackedGridDefaults,
 *   paginationPageSize: 50, // Explain why Transactions differs.
 * }
 * ```
 */
export const transactionsGridConfig = {
  activeGrid: 'infinite',

  infinite: {
    /**
     * `page` is the current UI strategy for the Infinite implementation.
     *
     * The word `page` describes only what the HEADER checkbox operates on. Explicit row IDs may be
     * retained across pagination pages.
     *
     * The UI mode is NOT copied into logical selection. For example, selecting rows across several
     * pages still serialises simply as:
     *
     *     { mode: 'include', ids: [...] }
     *
     * A future bulk-action builder uses the UI strategy only as separate action context when
     * dataset-level `exclude` selection needs to be interpreted.
     */
    selectionScope: 'page',

    gridOptions: {
      ...serverBackedGridDefaults,
    },
  },

  ssrm: {
    /**
     * No Transactions-specific SSRM pagination/cache overrides are required today.
     *
     * Keep this spread even though it currently contains no additional properties: it makes the
     * feature's inheritance point explicit and gives future table-specific overrides a clear home.
     */
    gridOptions: {
      ...serverBackedGridDefaults,
    },
  },
} satisfies TransactionsGridConfig;
