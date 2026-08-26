import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CellValueChangedEvent, GridApi, RowNode } from 'ag-grid-community';
import type { Transaction } from '@/features/transactions/api/transactions.contracts';
import { transactionEditingConfig } from '@/features/transactions/grid/transactionEditing';
import { useTrackedGridEditing } from './useTrackedGridEditing';

function transaction(status: Transaction['status']): Transaction {
  return {
    id: 'txn-a',
    reference: 'REF-txn-a',
    account: 'Account',
    amount: 100,
    currency: 'USD',
    status,
    transactionDate: '2026-08-24',
  };
}

describe('useTrackedGridEditing', () => {
  it('does not recreate a draft when Discard restores the original value through setDataValue', () => {
    const row = transaction('Completed');
    const { result } = renderHook(() => useTrackedGridEditing(transactionEditingConfig));

    act(() => {
      result.current.handleCellValueChanged({
        data: row,
        colDef: { field: 'status' },
        oldValue: 'Pending',
        newValue: 'Completed',
      } as unknown as CellValueChangedEvent<Transaction>);
    });

    expect(result.current.state.changesById['txn-a']).toEqual({
      status: 'Completed',
    });

    const node = {
      data: row,
      setDataValue: vi.fn((field: keyof Transaction, value: unknown) => {
        const oldValue = row[field];
        (row as unknown as Record<string, unknown>)[field] = value;

        // AG Grid can emit cellValueChanged when application code writes through setDataValue.
        result.current.handleCellValueChanged({
          data: row,
          colDef: { field },
          oldValue,
          newValue: value,
        } as unknown as CellValueChangedEvent<Transaction>);
        return true;
      }),
    } as unknown as RowNode<Transaction>;

    const api = {
      forEachNode: vi.fn((callback: (rowNode: RowNode<Transaction>) => void) => {
        callback(node);
      }),
    } as unknown as GridApi<Transaction>;

    act(() => {
      result.current.discardRow(api, 'txn-a');
    });

    expect(row.status).toBe('Pending');
    expect(result.current.state.changesById).toEqual({});
    expect(result.current.state.originalsById).toEqual({});
  });

  it('still clears a draft when the user manually edits a field back to its original value', () => {
    const row = transaction('Completed');
    const { result } = renderHook(() => useTrackedGridEditing(transactionEditingConfig));

    act(() => {
      result.current.handleCellValueChanged({
        data: row,
        colDef: { field: 'status' },
        oldValue: 'Pending',
        newValue: 'Completed',
      } as unknown as CellValueChangedEvent<Transaction>);
    });

    act(() => {
      row.status = 'Pending';
      result.current.handleCellValueChanged({
        data: row,
        colDef: { field: 'status' },
        oldValue: 'Completed',
        newValue: 'Pending',
      } as unknown as CellValueChangedEvent<Transaction>);
    });

    expect(result.current.state.changesById).toEqual({});
    expect(result.current.state.originalsById).toEqual({});
  });
});
