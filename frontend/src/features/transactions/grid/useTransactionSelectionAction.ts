import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/shared/query/queryClient';
import { updateTransactionsBySelection } from '../api/transactions.api';
import type { TransactionSelectionActionRequest } from '../api/transactions.contracts';

interface UseTransactionSelectionActionOptions {
  onApplied: () => void;
}

/**
 * Network lifecycle for backend actions against the current logical Transaction selection.
 *
 * Infinite/SSRM may provide compact dataset-wide include/exclude targets. Client-Side supplies exact
 * include IDs because its complete working set is already local. This hook owns only mutation state;
 * each concrete row-model root owns how its selection becomes the request target and how rows refresh.
 */
export function useTransactionSelectionAction({ onApplied }: UseTransactionSelectionActionOptions) {
  const { mutate, isPending, error } = useMutation(
    {
      // TanStack supplies mutation context separately. Keep that framework argument away from the
      // API client's optional AbortSignal parameter by forwarding only the request variable.
      mutationFn: (request: TransactionSelectionActionRequest) =>
        updateTransactionsBySelection(request),
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
