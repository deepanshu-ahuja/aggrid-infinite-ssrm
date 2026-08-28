// GRIDCAP-ACTION-SELECTED
import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/shared/query/queryClient';
import { updateTransactionsBySelection } from '../api/transactions.api';
import type { TransactionSelectionActionRequest } from '../api/transactions.contracts';
import type { SelectionAfterSuccessPolicy } from './transactionSelectionAction';

interface UseTransactionSelectionActionOptions {
  onApplied: (selectionAfterSuccess: SelectionAfterSuccessPolicy) => void;
}

interface TransactionSelectionActionMutation {
  request: TransactionSelectionActionRequest;
  selectionAfterSuccess: SelectionAfterSuccessPolicy;
}

/**
 * Network lifecycle for backend actions against the current logical Transaction selection.
 *
 * Infinite/SSRM may provide compact dataset-wide include/exclude targets. Client-Side supplies exact
 * include IDs because its complete working set is already local. This hook owns only mutation state;
 * each concrete row-model root owns how its selection becomes the request target, how rows refresh,
 * and how its native/custom selection state is cleared when the feature action requests that policy.
 */
export function useTransactionSelectionAction({ onApplied }: UseTransactionSelectionActionOptions) {
  const { mutate, isPending, error } = useMutation(
    {
      // TanStack supplies mutation context separately. Keep that framework argument away from the
      // API client's optional AbortSignal parameter by forwarding only the request variable.
      mutationFn: ({ request }: TransactionSelectionActionMutation) =>
        updateTransactionsBySelection(request),
      // Post-success selection policy is frontend-only lifecycle metadata. Never serialize it into the
      // backend mutation request; the API only needs the logical target + business changes.
      onSuccess: (_response, mutation) => onApplied(mutation.selectionAfterSuccess),
    },
    queryClient,
  );

  const applySelectionAction = useCallback(
    (
      request: TransactionSelectionActionRequest,
      selectionAfterSuccess: SelectionAfterSuccessPolicy,
    ) => {
      if (isPending) return;
      mutate({ request, selectionAfterSuccess });
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
