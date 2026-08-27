import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/shared/query/queryClient';
import { updateTransactionsBySelection } from '../api/transactions.api';
import type { TransactionSelectionActionRequest } from '../api/transactions.contracts';

interface UseTransactionSelectionActionOptions {
  onApplied: () => void;
}

/** Network lifecycle for actions that operate on the complete logical server-backed selection. */
export function useTransactionSelectionAction({ onApplied }: UseTransactionSelectionActionOptions) {
  const { mutate, isPending, error } = useMutation(
    {
      mutationFn: updateTransactionsBySelection,
      onSuccess: () => onApplied(),
    },
    queryClient,
  );

  const applySelectionAction = useCallback(
    (request: TransactionSelectionActionRequest) => {
      if (isPending) return;
      mutate(request);
    },
    [isPending, mutate],
  );

  return {
    applySelectionAction,
    isApplyingSelectionAction: isPending,
    selectionActionError:
      error instanceof Error
        ? error.message
        : error
          ? 'The selected Transactions could not be updated.'
          : undefined,
  };
}
