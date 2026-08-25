import { useCallback } from 'react';
import type { RefObject } from 'react';
import type { GridApi, IRowNode } from 'ag-grid-community';
import { useCurrentPageEditTarget } from '@/shared/grid/editing/useCurrentPageEditTarget';
import type { Transaction } from '../api/transactions.contracts';
import type {
  TransactionChanges,
  TransactionEditTarget,
  TransactionLastEdit,
} from './transactionEditing';

interface TransactionEditEngine {
  lastEdit?: TransactionLastEdit;
  applyChangesToNodes: (
    nodes: readonly IRowNode<Transaction>[],
    changes: TransactionChanges,
  ) => void;
}

/**
 * Transactions-specific composition of two current prototype behaviors:
 * - repeat the latest direct edit;
 * - apply an explicit field set.
 *
 * Current-page/selected-row target resolution itself is shared grid behavior and comes from
 * `useCurrentPageEditTarget`, so another table does not need to reimplement pagination/loading/
 * selected-node semantics merely to offer similar actions.
 */
export function useTransactionEditFlows(
  editing: TransactionEditEngine,
  gridApi: RefObject<GridApi<Transaction> | null>,
) {
  const target = useCurrentPageEditTarget(gridApi);

  const applyLastEdit = useCallback(
    (editTarget: TransactionEditTarget) => {
      if (!editing.lastEdit) return false;

      const nodes = target.resolveTarget(editTarget);
      if (!nodes) return false;

      editing.applyChangesToNodes(nodes, {
        [editing.lastEdit.field]: editing.lastEdit.value,
      });

      return true;
    },
    [editing, target.resolveTarget],
  );

  const applyBulkChanges = useCallback(
    (editTarget: TransactionEditTarget, changes: TransactionChanges) => {
      const nodes = target.resolveTarget(editTarget);
      if (!nodes) return false;

      editing.applyChangesToNodes(nodes, changes);
      return true;
    },
    [editing, target.resolveTarget],
  );

  return {
    error: target.error,
    applyLastEdit,
    applyBulkChanges,
  };
}
