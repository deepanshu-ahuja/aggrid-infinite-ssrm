import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/shared/query/queryClient';
import {
  bulkUpdateTransactions,
  updateTransaction,
} from '../api/transactions.api';
import type { Transaction } from '../api/transactions.contracts';
import type { TransactionUpdatePayload } from './transactionEditing';
import {
  mapTransactionBulkUpdateItems,
  mapTransactionUpdateChanges,
} from './transactionUpdate.mapper';

type TransactionUpdate = TransactionUpdatePayload['updates'][number];

type SaveCommand =
  | { kind: 'row'; updates: [TransactionUpdate] }
  | { kind: 'bulk'; updates: TransactionUpdate[] };

interface UseTransactionEditPersistenceOptions {
  /** All current drafts are needed for single-row Save lookup. */
  updates: TransactionUpdate[];
  acknowledgeChanges: (updates: TransactionUpdate[]) => void;
  onPersistedRows: (rows: Transaction[]) => void;
}

/**
 * Transactions persistence lifecycle for tracked grid edits.
 *
 * TanStack Query owns request lifecycle. The feature hook chooses single vs bulk backend endpoint and
 * maps the generic tracked-edit shape into the strict Transactions contract. Infinite/SSRM cache
 * refresh remains at the concrete grid root because those native APIs differ.
 *
 * Bulk selection semantics intentionally stay OUTSIDE this hook. The concrete grid root owns current
 * selection, intersects that selection with dirty drafts, then passes only those explicit updates to
 * `saveBulk`. This prevents an unselected dirty row from leaking into a bulk request.
 */
export function useTransactionEditPersistence({
  updates,
  acknowledgeChanges,
  onPersistedRows,
}: UseTransactionEditPersistenceOptions) {
  const { mutate, isPending, error } = useMutation(
    {
      mutationFn: async (command: SaveCommand) => {
        if (command.kind === 'row') {
          const update = command.updates[0];
          const response = await updateTransaction(
            update.id,
            mapTransactionUpdateChanges(update.changes),
          );
          return [response.row];
        }

        const response = await bulkUpdateTransactions({
          updates: mapTransactionBulkUpdateItems(command.updates),
        });
        return response.rows;
      },
      onSuccess: (rows, command) => {
        acknowledgeChanges(command.updates);
        onPersistedRows(rows);
      },
    },
    queryClient,
  );

  const saveRow = useCallback(
    (rowId: string) => {
      const update = updates.find((item) => item.id === rowId);
      if (!update || isPending) return;
      mutate({ kind: 'row', updates: [update] });
    },
    [isPending, mutate, updates],
  );

  const saveBulk = useCallback(
    (bulkUpdates: TransactionUpdate[]) => {
      if (bulkUpdates.length === 0 || isPending) return;
      mutate({ kind: 'bulk', updates: [...bulkUpdates] });
    },
    [isPending, mutate],
  );

  return {
    saveRow,
    saveBulk,
    isSaving: isPending,
    saveError:
      error instanceof Error
        ? error.message
        : error
          ? 'Transaction changes could not be saved.'
          : undefined,
  };
}
