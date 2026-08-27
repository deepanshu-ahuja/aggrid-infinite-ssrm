import {
  buildGridSelectionActionTarget,
  hasGridSelection,
  type GridSelectionExcludeScope,
} from '@/shared/grid/selection/gridSelectionActionTarget';
import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';
import type {
  TransactionSelectionActionRequest,
  TransactionUpdateChanges,
} from '../api/transactions.contracts';
import { mapTransactionFilterModel } from './transactionRequest.mapper';

export type TransactionExcludeScope = GridSelectionExcludeScope;

/** Transactions exposes the shared empty-selection rule without creating a second implementation. */
export const hasTransactionSelection = hasGridSelection;

/**
 * Transactions-specific composition around the shared server-backed selection target.
 *
 * The shared helper owns explicit/filtered/all selection meaning. This feature owns only the
 * Transactions filter translation and the domain action payload (`changes`). A future Payables table
 * can reuse the same shared helper with its own filter mapper and action payload.
 */
export function buildTransactionSelectionActionRequest(
  selection: ServerSelectionIntent<string>,
  excludeScope: TransactionExcludeScope,
  filterModel: object,
  changes: TransactionUpdateChanges,
): TransactionSelectionActionRequest {
  const filters =
    selection.mode === 'exclude' && excludeScope === 'filtered'
      ? mapTransactionFilterModel(filterModel)
      : [];

  return {
    ...buildGridSelectionActionTarget(selection, excludeScope, filters),
    changes,
  };
}
