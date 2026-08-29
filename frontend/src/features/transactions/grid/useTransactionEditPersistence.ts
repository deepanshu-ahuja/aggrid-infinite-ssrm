// GRIDCAP-EDIT-SAVE-ROW | GRIDCAP-EDIT-SAVE-SELECTED | GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-VALIDATION | GRIDCAP-LIFECYCLE-REFRESH
import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/apiError';
import { queryClient } from '@/shared/query/queryClient';
import { bulkUpdateTransactions, updateTransaction } from '../api/transactions.api';
import type { Transaction } from '../api/transactions.contracts';
import type { TransactionUpdatePayload } from './transactionEditing';
import {
  mapTransactionBulkUpdateItems,
  mapTransactionUpdateChanges,
} from './transactionUpdate.mapper';
import { mapTransactionServerValidationErrors } from './transactionValidation';

type TransactionUpdate = TransactionUpdatePayload['updates'][number];

type SaveCommand =
  { kind: 'row'; updates: [TransactionUpdate] } | { kind: 'bulk'; updates: TransactionUpdate[] };

interface UseTransactionEditPersistenceOptions {
  /** All current drafts are needed for single-row Save lookup. */
  updates: TransactionUpdate[];
  acknowledgeChanges: (updates: TransactionUpdate[]) => void;
  onPersistedRows: (rows: Transaction[]) => void;
  onServerValidationErrors: ReturnType<typeof mapTransactionServerValidationErrors> extends infer TResult
    ? (errors: TResult) => void
    : never;
}

/** Transactions persistence lifecycle for tracked grid edits. */
export function useTransactionEditPersistence({
  updates,
  acknowledgeChanges,
  onPersistedRows,
  onServerValidationErrors,
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
      onError: (mutationError, command) => {
        if (!(mutationError instanceof ApiError) || mutationError.status !== 400) return;
        const fieldErrors = mapTransactionServerValidationErrors(
          mutationError.details,
          command.updates,
        );
        if (fieldErrors.length > 0) onServerValidationErrors(fieldErrors);
      },
    },
    queryClient,
  );

  // GRIDCAP-EDIT-SAVE-ROW
  const saveRow = useCallback(
    (rowId: string) => {
      const update = updates.find((item) => item.id === rowId);
      if (!update || isPending) return;
      mutate({ kind: 'row', updates: [update] });
    },
    [isPending, mutate, updates],
  );

  // GRIDCAP-EDIT-SAVE-SELECTED
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
