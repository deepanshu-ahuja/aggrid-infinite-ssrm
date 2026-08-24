import type { FilterModel } from 'ag-grid-community';
import {
  buildGridBulkSelection,
  type GridBulkSelection,
} from '@/shared/grid/selection/gridBulkSelection';
import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';
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
 * Dataset/query context required only when logical selection is `exclude`.
 *
 * This builder is intentionally row-model-neutral. Both Infinite Row Model and SSRM can produce the
 * same backend meanings even though their UI/AG Grid mechanics differ.
 *
 * `page`
 * ------
 * Current-page/manual selection is explicit IDs. `page + exclude` is invalid.
 *
 * `filtered`
 * ----------
 * `exclude` means every Transaction matching the defining AG Grid filter, except `ids`.
 *
 * `all`
 * -----
 * `exclude` means every Transaction in the complete unfiltered dataset, except `ids`.
 *
 * Keeping this context outside `ServerSelectionIntent` preserves the rule that logical selection
 * itself contains only:
 *
 *     mode + ids
 */
export type TransactionBulkSelectionContext =
  | {
      selectionScope: 'page';
    }
  | {
      selectionScope: 'filtered';

      /**
       * Applied AG Grid filter model that DEFINES the selected dataset.
       *
       * It is translated by `mapTransactionFilterModel()` so normal row loading and filtered bulk
       * actions use exactly the same backend filter semantics.
       */
      filterModel: FilterModel;
    }
  | {
      selectionScope: 'all';
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
 * The caller supplies the logical selection plus the dataset/query context that was active when
 * dataset-level Select All was chosen.
 *
 * RULE 1 — INCLUDE
 * ----------------
 * Manual/explicit selection is exact-ID selection regardless of row model or visible filter:
 *
 *     include [A, B]
 *
 * means exactly A and B.
 *
 * RULE 2 — FILTERED EXCLUDE
 * -------------------------
 * `exclude` with filtered context means Select All Filtered. The applied AG Grid filter is mapped
 * through the SAME Transactions filter mapper used by normal Infinite/SSRM row loading.
 *
 * RULE 3 — ALL EXCLUDE
 * --------------------
 * `exclude` with all-record context means the complete Transactions dataset is selected, so the
 * backend query is intentionally unfiltered (`filters: []`).
 *
 * RULE 4 — PAGE EXCLUDE IS INVALID
 * --------------------------------
 * Current-page selection is explicit IDs only. Treating `page + exclude` as a dataset action could
 * accidentally widen a bulk operation, so it fails loudly.
 */
export function buildTransactionBulkSelection(
  selection: ServerSelectionIntent<string>,
  context: TransactionBulkSelectionContext,
): TransactionBulkSelection {
  /** Exact IDs completely define include selection; visible filters are irrelevant. */
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

  throw new Error(
    'Invalid Transactions selection: page selection cannot use exclude mode.',
  );
}
