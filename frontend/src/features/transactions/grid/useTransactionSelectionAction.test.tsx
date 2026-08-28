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
  it('keeps post-success policy on the frontend while sending the unchanged backend request', async () => {
    transactionApi.updateTransactionsBySelection.mockResolvedValue({ updatedCount: 1 });
    const onApplied = vi.fn();
    const { result } = renderHook(() => useTransactionSelectionAction({ onApplied }));

    act(() => result.current.applySelectionAction(request, 'preserve'));

    await waitFor(() => {
      expect(transactionApi.updateTransactionsBySelection).toHaveBeenCalledWith(request);
      expect(onApplied).toHaveBeenCalledWith('preserve');
    });
  });

  it('does not apply clear/preserve lifecycle when the backend mutation fails', async () => {
    transactionApi.updateTransactionsBySelection.mockRejectedValue(new Error('Update failed'));
    const onApplied = vi.fn();
    const { result } = renderHook(() => useTransactionSelectionAction({ onApplied }));

    act(() => result.current.applySelectionAction(request, 'clear'));

    await waitFor(() => expect(result.current.selectionActionError).toBe('Update failed'));
    expect(onApplied).not.toHaveBeenCalled();
  });
});
