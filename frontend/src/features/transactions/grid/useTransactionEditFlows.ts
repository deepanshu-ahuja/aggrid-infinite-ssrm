import { useCallback, useState } from 'react';
import type { RefObject } from 'react';
import type { GridApi, IRowNode } from 'ag-grid-community';
import { getCurrentPageNodes } from '@/shared/grid/pagination/getCurrentPageNodes';
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
 * Reusable behavior behind the two current-page editing flows.
 *
 * The concrete Infinite/SSRM root owns the authoritative GridApi and passes that SAME ref here.
 * This hook never captures a second GridApi and never mirrors native selection/pagination state.
 *
 * FLOW 1
 * ------
 * Propagates the user's latest directly edited field/value to the chosen current-page target.
 *
 * FLOW 2
 * ------
 * Applies one or more explicitly chosen fields to the chosen current-page target.
 *
 * SHARED TARGET RULE
 * ------------------
 * `page`     -> every resolved row on the current pagination page.
 * `selected` -> only native selected RowNodes among those same current-page rows.
 *
 * The final UI can change independently because this hook contains behavior, not presentation.
 */
export function useTransactionEditFlows(
  editing: TransactionEditEngine,
  gridApi: RefObject<GridApi<Transaction> | null>,
) {
  const [error, setError] = useState<string>();

  const resolveTarget = useCallback(
    (target: TransactionEditTarget) => {
      const api = gridApi.current;

      if (!api) {
        setError('The grid is not ready yet.');
        return undefined;
      }

      const pageNodes = getCurrentPageNodes(api);

      if (!pageNodes) {
        setError('The current page is still loading. Try again when its rows are visible.');
        return undefined;
      }

      const nodes =
        target === 'page'
          ? pageNodes
          : pageNodes.filter((node) => node.isSelected() === true);

      if (target === 'selected' && nodes.length === 0) {
        setError('No rows are selected on the current page.');
        return undefined;
      }

      setError(undefined);
      return nodes;
    },
    [gridApi],
  );

  const applyLastEdit = useCallback(
    (target: TransactionEditTarget) => {
      if (!editing.lastEdit) return false;

      const nodes = resolveTarget(target);
      if (!nodes) return false;

      editing.applyChangesToNodes(nodes, {
        [editing.lastEdit.field]: editing.lastEdit.value,
      });

      return true;
    },
    [editing, resolveTarget],
  );

  const applyBulkChanges = useCallback(
    (target: TransactionEditTarget, changes: TransactionChanges) => {
      const nodes = resolveTarget(target);
      if (!nodes) return false;

      editing.applyChangesToNodes(nodes, changes);
      return true;
    },
    [editing, resolveTarget],
  );

  return {
    error,
    applyLastEdit,
    applyBulkChanges,
  };
}
