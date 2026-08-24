import type { FilterModel } from 'ag-grid-community';
import {
  buildGridBulkSelection,
  type GridBulkSelection,
} from '@/shared/grid/selection/gridBulkSelection';
import type {
  InfiniteSelectionMode,
  ServerSelectionIntent,
} from '@/shared/grid/selection/serverSelection';
import type { TransactionFilter } from '../api/transactions.contracts';
import { mapTransactionFilterModel } from './transactionRequest.mapper';

/**
 * Final selection shape that a future Transactions bulk-action request can send.
 *
 * The shared contract is specialised with:
 *
 * - Transaction row IDs (`string`);
 * - Transactions backend filter objects (`TransactionFilter`).
 *
 * This remains only the SELECTION portion of a future action request. A real endpoint may add
 * action-specific fields such as status, export format, approval reason, etc.
 */
export type TransactionBulkSelection = GridBulkSelection<
  string,
  TransactionFilter
>;

/**
 * Context required to interpret dataset-level `exclude` selection.
 *
 * `page`
 * ------
 * Current-page selection is always explicit/include selection. There is no valid page-level
 * dataset Select All representation.
 *
 * `filtered`
 * ----------
 * If `exclude` is active, the AG Grid applied filter model defines the selected backend dataset.
 *
 * `all`
 * -----
 * If `exclude` is active, the selected dataset is the complete unfiltered Transactions dataset.
 *
 * Keeping this context separate from `ServerSelectionIntent` preserves the design rule that
 * logical selection itself contains only:
 *
 *     mode + ids
 */
export type TransactionBulkSelectionContext =
  | {
      selectionScope: Extract<InfiniteSelectionMode, 'page'>;
    }
  | {
      selectionScope: Extract<InfiniteSelectionMode, 'filtered'>;
      /**
       * Applied AG Grid filter model at the time the action payload is built.
       *
       * The model is converted through `mapTransactionFilterModel()` so bulk actions use exactly the
       * same backend filter semantics as normal grid row loading.
       */
      filterModel: FilterModel;
    }
  | {
      selectionScope: Extract<InfiniteSelectionMode, 'all'>;
    };

/**
 * Builds the Transactions selection payload for a future bulk action.
 *
 * This function is deliberately PURE:
 *
 * - it does not call a backend;
 * - it does not own React state;
 * - it does not read GridApi itself;
 * - it does not trigger Select All.
 *
 * A UI/action handler will call it only when the user eventually invokes a real action such as
 * Export, Delete, Approve, etc.
 *
 * RULE 1 — INCLUDE
 * ----------------
 * Manual selection is exact-ID selection in every UI mode.
 *
 * Examples:
 *
 *     page + include [A, B]
 *     filtered + include [A, B]
 *     all + include [A, B]
 *
 * all mean exactly:
 *
 *     { mode: 'include', ids: ['A', 'B'] }
 *
 * The visible filter must not redefine those explicit IDs.
 *
 * RULE 2 — FILTERED EXCLUDE
 * -------------------------
 * `exclude` under the filtered strategy means Select All Filtered is active.
 *
 * We must map the applied AG Grid filter model through the SAME Transactions filter mapper used by
 * normal datasource loading:
 *
 *     AG Grid filter model
 *          ↓
 *     mapTransactionFilterModel(...)
 *          ↓
 *     backend TransactionFilter[]
 *
 * Then the shared builder produces:
 *
 *     {
 *       mode: 'exclude',
 *       ids: [...exceptions],
 *       filters: [...mapped backend filters]
 *     }
 *
 * RULE 3 — ALL EXCLUDE
 * --------------------
 * `exclude` under the all-record strategy means the complete dataset is selected, so the backend
 * query is intentionally unfiltered:
 *
 *     filters: []
 *
 * RULE 4 — PAGE EXCLUDE IS INVALID
 * --------------------------------
 * The page header never switches to dataset-level exclude semantics. It only adds/removes visible
 * row IDs from include selection.
 *
 * Therefore:
 *
 *     selectionScope = 'page'
 *     selection.mode = 'exclude'
 *
 * indicates an impossible/inconsistent application state and fails loudly rather than silently
 * widening the action to a dataset-level operation.
 */
export function buildTransactionBulkSelection(
  selection: ServerSelectionIntent<string>,
  context: TransactionBulkSelectionContext,
): TransactionBulkSelection {
  /**
   * Exact IDs fully define include selection.
   *
   * `buildGridBulkSelection` requires a filters argument by design, but filters are discarded for
   * include mode. Passing [] here makes that irrelevance explicit.
   */
  if (selection.mode === 'include') {
    return buildGridBulkSelection(selection, []);
  }

  if (context.selectionScope === 'filtered') {
    return buildGridBulkSelection(
      selection,
      mapTransactionFilterModel(context.filterModel),
    );
  }

  if (context.selectionScope === 'all') {
    return buildGridBulkSelection(selection, []);
  }

  /**
   * Current-page selection can never legitimately produce exclude state.
   *
   * Throwing protects future action handlers from accidentally interpreting corrupted/impossible
   * state as "all records".
   */
  throw new Error(
    'Invalid Transactions selection: page selection cannot use exclude mode.',
  );
}
