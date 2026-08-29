// GRIDCAP-ACTION-SELECTED
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTransactionSelectionAction } from './useTransactionSelectionAction';

const transactionApi = vi.hoisted(() => ({
  updateTransactionsBySelection: vi.fn(),
}));

vi.mock('../api/transactions.api', () => transactionApi);

const request = {
  selection: { mode: 'include' as const, ids: ['txn-a'] },
  changes: { status: 'Failed' as const },
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('useTransactionSelectionAction', () => {
  it('sends only the business request and runs the success callback after the backend update', async () => {
    transactionApi.updateTransactionsBySelection.mockResolvedValue({ updatedCount: 1 });
    const onApplied = vi.fn();
    const { result } = renderHook(() => useTransactionSelectionAction({ onApplied }));

    act(() => result.current.updateSelectedTransactions(request));

    await waitFor(() => {
      expect(transactionApi.updateTransactionsBySelection).toHaveBeenCalledWith(request);
      expect(onApplied).toHaveBeenCalledTimes(1);
    });
  });

  it('does not run the success callback when the backend mutation fails', async () => {
    transactionApi.updateTransactionsBySelection.mockRejectedValue(new Error('Update failed'));
    const onApplied = vi.fn();
    const { result } = renderHook(() => useTransactionSelectionAction({ onApplied }));

    act(() => result.current.updateSelectedTransactions(request));

    await waitFor(() => expect(result.current.selectedTransactionUpdateError).toBe('Update failed'));
    expect(onApplied).not.toHaveBeenCalled();
  });
});
