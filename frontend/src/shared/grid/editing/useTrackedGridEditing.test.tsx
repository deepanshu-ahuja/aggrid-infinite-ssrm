import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CellValueChangedEvent, GridApi, RowNode } from 'ag-grid-community';
import type { GridRowInteractionMode } from '@/shared/grid/rows/gridRowInteraction';
import type { Transaction } from '@/features/transactions/api/transactions.contracts';
import { transactionEditingConfig } from '@/features/transactions/grid/transactionEditing';
import { buildSelectedTrackedGridUpdatePayload } from './trackedGridEditing';
import { useTrackedGridEditing } from './useTrackedGridEditing';

function transaction(
  status: Transaction['status'],
  interactionMode: GridRowInteractionMode = 'enabled',
  id = 'txn-a',
): Transaction {
  return {
    id,
    reference: `REF-${id}`,
    account: 'Account',
    amount: 100,
    currency: 'USD',
    status,
    transactionDate: '2026-08-24',
    interactionMode,
  };
}

describe('useTrackedGridEditing', () => {
  it('keeps Discard clean and idempotent even if AG Grid reports the restore later', () => {
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

    let restoredValueEvent: CellValueChangedEvent<Transaction> | undefined;
    const node = {
      data: row,
      setDataValue: vi.fn(
        (field: keyof Transaction, value: unknown, source?: string) => {
          const oldValue = row[field];
          (row as unknown as Record<string, unknown>)[field] = value;

          // Keep the event until after Discard returns. This reproduces the timing that previously
          // turned the restored value into a new draft and made repeated Discard clicks toggle values.
          restoredValueEvent = {
            data: row,
            colDef: { field },
            oldValue,
            newValue: value,
            source,
          } as unknown as CellValueChangedEvent<Transaction>;
          return true;
        },
      ),
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

    act(() => {
      if (!restoredValueEvent) throw new Error('Expected setDataValue to produce an event.');
      result.current.handleCellValueChanged(restoredValueEvent);
    });

    // A selected clean row must not remain eligible for "Save selected edits".
    expect(
      buildSelectedTrackedGridUpdatePayload(result.current.state, {
        mode: 'include',
        ids: ['txn-a'],
      }).updates,
    ).toEqual([]);

    // Once the first Discard clears the row, another Discard is a no-op rather than a value toggle.
    act(() => {
      result.current.discardRow(api, 'txn-a');
    });

    expect(row.status).toBe('Pending');
    expect(node.setDataValue).toHaveBeenCalledTimes(1);
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

  it('does not let programmatic edit flows write through a read-only row', () => {
    const editableRow = transaction('Pending', 'enabled', 'txn-enabled');
    const readOnlyRow = transaction('Pending', 'readOnly', 'txn-read-only');
    const editableNode = {
      data: editableRow,
      setDataValue: vi.fn(),
    } as unknown as RowNode<Transaction>;
    const readOnlyNode = {
      data: readOnlyRow,
      setDataValue: vi.fn(),
    } as unknown as RowNode<Transaction>;

    const { result } = renderHook(() => useTrackedGridEditing(transactionEditingConfig));

    act(() => {
      result.current.applyChangesToNodes([editableNode, readOnlyNode], {
        status: 'Failed',
      });
    });

    expect(editableNode.setDataValue).toHaveBeenCalledWith('status', 'Failed', 'data');
    expect(readOnlyNode.setDataValue).not.toHaveBeenCalled();
    expect(result.current.state.changesById).toEqual({
      'txn-enabled': { status: 'Failed' },
    });
  });

  it('does not record a direct cell event for a read-only row', () => {
    const readOnlyRow = transaction('Completed', 'readOnly');
    const { result } = renderHook(() => useTrackedGridEditing(transactionEditingConfig));

    act(() => {
      result.current.handleCellValueChanged({
        data: readOnlyRow,
        colDef: { field: 'status' },
        oldValue: 'Pending',
        newValue: 'Completed',
      } as unknown as CellValueChangedEvent<Transaction>);
    });

    expect(result.current.state.changesById).toEqual({});
    expect(result.current.lastEdit).toBeUndefined();
  });
});
