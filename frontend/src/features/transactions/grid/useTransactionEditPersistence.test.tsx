import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from '@/shared/query/queryClient';
import type { Transaction } from '../api/transactions.contracts';
import { useTransactionEditPersistence } from './useTransactionEditPersistence';

const transactionApi = vi.hoisted(() => ({
  updateTransaction: vi.fn(),
  bulkUpdateTransactions: vi.fn(),
}));

vi.mock('../api/transactions.api', () => transactionApi);

function row(id: string): Transaction {
  return {
    id,
    reference: `REF-${id}`,
    account: 'Treasury',
    amount: 100,
    currency: 'USD',
    status: 'Completed',
    transactionDate: '2026-08-24',
  };
}

afterEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
});

describe('useTransactionEditPersistence', () => {
  it('uses the single-row endpoint for Save Row and acknowledges that snapshot', async () => {
    const acknowledgeChanges = vi.fn();
    const onPersistedRows = vi.fn();
    transactionApi.updateTransaction.mockResolvedValue({ row: row('txn-a') });

    const updates = [{ id: 'txn-a', changes: { status: 'Completed' as const } }];
    const { result } = renderHook(() =>
      useTransactionEditPersistence({
        updates,
        acknowledgeChanges,
        onPersistedRows,
      }),
    );

    act(() => result.current.saveRow('txn-a'));

    await waitFor(() => {
      expect(transactionApi.updateTransaction).toHaveBeenCalledWith('txn-a', {
        status: 'Completed',
      });
      expect(acknowledgeChanges).toHaveBeenCalledWith(updates);
      expect(onPersistedRows).toHaveBeenCalledWith([row('txn-a')]);
    });
  });

  it('bulk-saves only the explicit dirty updates supplied by the grid selection boundary', async () => {
    const acknowledgeChanges = vi.fn();
    const onPersistedRows = vi.fn();
    const allDrafts = [
      { id: 'txn-a', changes: { status: 'Failed' as const } },
      { id: 'txn-b', changes: { amount: 250 } },
    ];
    const selectedDrafts = allDrafts.slice(1);

    transactionApi.bulkUpdateTransactions.mockResolvedValue({
      rows: [row('txn-b')],
      updatedCount: 1,
    });

    const { result } = renderHook(() =>
      useTransactionEditPersistence({
        updates: allDrafts,
        acknowledgeChanges,
        onPersistedRows,
      }),
    );

    act(() => result.current.saveBulk(selectedDrafts));

    await waitFor(() => {
      expect(transactionApi.bulkUpdateTransactions).toHaveBeenCalledWith({
        updates: [{ id: 'txn-b', changes: { amount: 250 } }],
      });
      expect(acknowledgeChanges).toHaveBeenCalledWith(selectedDrafts);
      expect(onPersistedRows).toHaveBeenCalledWith([row('txn-b')]);
    });
  });
});
