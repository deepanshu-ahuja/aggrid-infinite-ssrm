import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/shared/query/queryClient';
import {
  bulkUpdateTransactions,
  updateTransaction,
} from '../api/transactions.api';
import type { Transaction } from '../api/transactions.contracts';
import type { TransactionUpdatePayload } from './transactionEditing';

type TransactionUpdate = TransactionUpdatePayload['updates'][number];

type SaveCommand =
  | { kind: 'row'; updates: [TransactionUpdate] }
  | { kind: 'bulk'; updates: TransactionUpdate[] };

interface UseTransactionEditPersistenceOptions {
  updates: TransactionUpdate[];
  acknowledgeChanges: (updates: TransactionUpdate[]) => void;
  onPersistedRows: (rows: Transaction[]) => void;
}

/**
 * Transactions persistence lifecycle for tracked grid edits.
 *
 * TanStack Query owns request lifecycle. The feature hook chooses single vs bulk backend endpoint;
 * the concrete grid root still owns Infinite/SSRM refresh because those native APIs differ.
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
          const response = await updateTransaction(update.id, update.changes);
          return [response.row];
        }

        const response = await bulkUpdateTransactions({ updates: command.updates });
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

  const saveAll = useCallback(() => {
    if (updates.length === 0 || isPending) return;
    mutate({ kind: 'bulk', updates: [...updates] });
  }, [isPending, mutate, updates]);

  return {
    saveRow,
    saveAll,
    isSaving: isPending,
    saveError:
      error instanceof Error
        ? error.message
        : error
          ? 'Transaction changes could not be saved.'
          : undefined,
  };
}
