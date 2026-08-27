import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';
import type {
  TransactionSelectionActionRequest,
  TransactionUpdateChanges,
} from '../api/transactions.contracts';
import { mapTransactionFilterModel } from './transactionRequest.mapper';

export type TransactionExcludeScope = 'filtered' | 'all';

/** An include selection is empty only when it has no explicit ids; exclude always represents a dataset. */
export function hasTransactionSelection(selection: ServerSelectionIntent<string>) {
  return selection.mode === 'exclude' || selection.ids.length > 0;
}

/**
 * Translate the grid's logical include/exclude state into the backend action contract.
 *
 * Explicit ids stay exact even when filters are visible. Only Select All Filtered carries the
 * current filter model because that filter is part of the selected dataset's meaning.
 */
export function buildTransactionSelectionActionRequest(
  selection: ServerSelectionIntent<string>,
  excludeScope: TransactionExcludeScope,
  filterModel: object,
  changes: TransactionUpdateChanges,
): TransactionSelectionActionRequest {
  if (selection.mode === 'include') {
    return {
      selection: {
        scope: 'explicit',
        mode: 'include',
        ids: [...selection.ids],
      },
      changes,
    };
  }

  if (excludeScope === 'filtered') {
    return {
      selection: {
        scope: 'filtered',
        mode: 'exclude',
        ids: [...selection.ids],
      },
      filters: mapTransactionFilterModel(filterModel),
      changes,
    };
  }

  return {
    selection: {
      scope: 'all',
      mode: 'exclude',
      ids: [...selection.ids],
    },
    changes,
  };
}
