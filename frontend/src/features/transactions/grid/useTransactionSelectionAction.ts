// GRIDCAP-ACTION-SELECTED
import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/shared/query/queryClient';
import { updateTransactionsBySelection } from '../api/transactions.api';
import type { TransactionSelectionActionRequest } from '../api/transactions.contracts';

interface UseTransactionSelectionActionOptions {
  /** Runs only after the selected Transaction update succeeds. */
  onApplied: () => void;
}

/**
 * Network lifecycle for the current backend update against selected Transactions.
 *
 * This hook owns the request/pending/error lifecycle only. It does not carry a generic selection
 * behavior key. The current Change Status action family has one known success behavior, so each grid
 * root directly clears through its own selection controller in `onApplied` and then refreshes rows.
 * Future business actions with different endpoints should own separate mutations rather than asking
 * this hook to choose an endpoint from an action key.
 */
export function useTransactionSelectionAction({ onApplied }: UseTransactionSelectionActionOptions) {
  const { mutate, isPending, error } = useMutation(
    {
      // TanStack supplies mutation context separately. Keep that framework argument away from the
      // API client's optional AbortSignal parameter by forwarding only the actual business request.
      mutationFn: (request: TransactionSelectionActionRequest) =>
        updateTransactionsBySelection(request),
      onSuccess: () => onApplied(),
    },
    queryClient,
  );

  const updateSelectedTransactions = useCallback(
    (request: TransactionSelectionActionRequest) => {
      if (isPending) return;
      mutate(request);
    },
    [isPending, mutate],
  );

  return {
    updateSelectedTransactions,
    isUpdatingSelectedTransactions: isPending,
    selectedTransactionUpdateError:
      error instanceof Error
        ? error.message
        : error
          ? 'The selected Transactions could not be updated.'
          : undefined,
  };
}
