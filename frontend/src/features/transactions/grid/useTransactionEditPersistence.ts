import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
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
  /** Current application-owned drafts. The hook snapshots these when a user starts a save. */
  updates: TransactionUpdate[];
  /** Clears only values that still match the submitted request, preserving newer in-flight edits. */
  acknowledgeChanges: (updates: TransactionUpdate[]) => void;
  /** Row-model owner decides how authoritative backend rows should be reloaded/reconciled. */
  onPersistedRows: (rows: Transaction[]) => void;
}

/**
 * Transactions persistence lifecycle for tracked grid edits.
 *
 * TanStack Query owns mutation pending/error/success state. This hook owns the domain decision of
 * calling the single-row endpoint for one explicit Save Row action and the bulk endpoint for Save All.
 * It deliberately does not know whether the caller renders Infinite or SSRM; cache refresh remains at
 * the concrete grid root because those row models have different native APIs.
 */
export function useTransactionEditPersistence({
  updates,
  acknowledgeChanges,
  onPersistedRows,
}: UseTransactionEditPersistenceOptions) {
  const mutation = useMutation({
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
  });

  const saveRow = useCallback(
    (rowId: string) => {
      const update = updates.find((item) => item.id === rowId);
      if (!update || mutation.isPending) return;
      mutation.mutate({ kind: 'row', updates: [update] });
    },
    [mutation, updates],
  );

  const saveAll = useCallback(() => {
    if (updates.length === 0 || mutation.isPending) return;
    mutation.mutate({ kind: 'bulk', updates: [...updates] });
  }, [mutation, updates]);

  return {
    saveRow,
    saveAll,
    isSaving: mutation.isPending,
    saveError:
      mutation.error instanceof Error
        ? mutation.error.message
        : mutation.error
          ? 'Transaction changes could not be saved.'
          : undefined,
  };
}
