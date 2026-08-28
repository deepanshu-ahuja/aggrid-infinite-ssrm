import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listAllTransactions } from './transactions.api';
import type { Transaction } from './transactions.contracts';

export const transactionsClientCollectionQueryKey = ['transactions', 'client-collection'] as const;

/**
 * Application data boundary for the Transactions Client-Side grid.
 *
 * TanStack Query owns the complete authoritative collection request/cache. AG Grid receives fresh
 * shallow row copies rather than the query-cache objects themselves because Client-Side cell editing
 * mutates row data in browser memory. Mutating the cache directly would destroy the REMOTE/authoritative
 * value needed by the existing BASE/LOCAL/REMOTE edit reconciliation model.
 */
export function useClientTransactions() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: transactionsClientCollectionQueryKey,
    queryFn: ({ signal }) => listAllTransactions(signal),
  });

  const rows = useMemo(
    () => query.data?.map((row) => ({ ...row })) ?? [],
    [query.data],
  );

  /**
   * Merge rows returned by successful explicit Save operations into the authoritative query cache.
   * The next Client rowData projection then contains those backend values and any recomputed row policy.
   */
  const applyAuthoritativeRows = useCallback(
    (updatedRows: Transaction[]) => {
      if (updatedRows.length === 0) return;
      const updatedById = new Map(updatedRows.map((row) => [row.id, row]));

      queryClient.setQueryData<Transaction[]>(transactionsClientCollectionQueryKey, (current) => {
        if (!current) return current;
        return current.map((row) => updatedById.get(row.id) ?? row);
      });
    },
    [queryClient],
  );

  return {
    rows,
    isLoading: query.isPending,
    error:
      query.error instanceof Error
        ? query.error.message
        : query.error
          ? 'Transactions could not be loaded.'
          : undefined,
    // TanStack already provides a stable, lifecycle-aware refetch function. Return it directly rather
    // than wrapping it in another callback that would add no behavior and complicate hook dependencies.
    refetch: query.refetch,
    applyAuthoritativeRows,
  };
}
