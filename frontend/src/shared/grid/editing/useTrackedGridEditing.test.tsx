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

function cellEvent(
  row: Transaction,
  oldValue: Transaction['status'],
  newValue: Transaction['status'],
  node: RowNode<Transaction>,
) {
  return {
    data: row,
    node,
    colDef: { field: 'status' },
    oldValue,
    newValue,
  } as unknown as CellValueChangedEvent<Transaction>;
}

describe('useTrackedGridEditing', () => {
  it('keeps Discard clean and idempotent even if AG Grid reports the restore later', () => {
    const row = transaction('Completed');
    const initialNode = { data: row } as unknown as RowNode<Transaction>;
    const { result } = renderHook(() => useTrackedGridEditing(transactionEditingConfig));

    act(() => {
      result.current.handleCellValueChanged(cellEvent(row, 'Pending', 'Completed', initialNode));
    });

    expect(result.current.state.changesById['txn-a']).toEqual({ status: 'Completed' });

    let restoredValueEvent: CellValueChangedEvent<Transaction> | undefined;
    const node = {
      data: row,
      setDataValue: vi.fn((field: keyof Transaction, value: unknown, source?: string) => {
        const oldValue = row[field];
        (row as unknown as Record<string, unknown>)[field] = value;
        restoredValueEvent = {
          data: row,
          node,
          colDef: { field },
          oldValue,
          newValue: value,
          source,
        } as unknown as CellValueChangedEvent<Transaction>;
        return true;
      }),
    } as unknown as RowNode<Transaction>;

    const api = {
      forEachNode: vi.fn((callback: (rowNode: RowNode<Transaction>) => void) => callback(node)),
    } as unknown as GridApi<Transaction>;

    act(() => result.current.discardRow(api, 'txn-a'));

    expect(row.status).toBe('Pending');
    expect(result.current.state.changesById).toEqual({});
    expect(result.current.state.originalsById).toEqual({});
    expect(result.current.state.conflictsById).toEqual({});

    act(() => {
      if (!restoredValueEvent) throw new Error('Expected setDataValue to produce an event.');
      result.current.handleCellValueChanged(restoredValueEvent);
    });

    expect(
      buildSelectedTrackedGridUpdatePayload(result.current.state, {
        mode: 'include',
        ids: ['txn-a'],
      }).updates,
    ).toEqual([]);

    act(() => result.current.discardRow(api, 'txn-a'));
    expect(node.setDataValue).toHaveBeenCalledTimes(1);
  });

  it('does not treat a revisit of the same locally-overlaid RowNode as fresh server data', () => {
    const row = transaction('Failed');
    const node = {
      data: row,
      setDataValue: vi.fn(),
    } as unknown as RowNode<Transaction>;
    const api = {
      forEachNode: vi.fn((callback: (rowNode: RowNode<Transaction>) => void) => callback(node)),
    } as unknown as GridApi<Transaction>;
    const { result } = renderHook(() => useTrackedGridEditing(transactionEditingConfig));

    act(() => result.current.handleCellValueChanged(cellEvent(row, 'Pending', 'Failed', node)));
    act(() => result.current.restoreTrackedEdits(api));

    expect(result.current.state.changesById['txn-a']).toEqual({ status: 'Failed' });
    expect(result.current.state.conflictsById).toEqual({});
  });

  it('detects a conflict when a refreshed RowNode carries a different server value', () => {
    const editedRow = transaction('Failed');
    const editedNode = { data: editedRow } as unknown as RowNode<Transaction>;
    const { result } = renderHook(() => useTrackedGridEditing(transactionEditingConfig));

    act(() => result.current.handleCellValueChanged(cellEvent(editedRow, 'Pending', 'Failed', editedNode)));

    const refreshedRow = transaction('Completed');
    const refreshedNode = {
      data: refreshedRow,
      setDataValue: vi.fn((field: keyof Transaction, value: unknown) => {
        (refreshedRow as unknown as Record<string, unknown>)[field] = value;
        return true;
      }),
    } as unknown as RowNode<Transaction>;
    const api = {
      forEachNode: vi.fn((callback: (rowNode: RowNode<Transaction>) => void) => callback(refreshedNode)),
    } as unknown as GridApi<Transaction>;

    act(() => result.current.restoreTrackedEdits(api));

    expect(result.current.state.conflictsById['txn-a']).toEqual({
      status: { remoteValue: 'Completed' },
    });
    expect(refreshedRow.status).toBe('Failed');
    expect(result.current.conflictCount).toBe(1);
  });

  it('still clears a draft when the user manually edits a non-conflicted field back to BASE', () => {
    const row = transaction('Completed');
    const node = { data: row } as unknown as RowNode<Transaction>;
    const { result } = renderHook(() => useTrackedGridEditing(transactionEditingConfig));

    act(() => result.current.handleCellValueChanged(cellEvent(row, 'Pending', 'Completed', node)));
    act(() => {
      row.status = 'Pending';
      result.current.handleCellValueChanged(cellEvent(row, 'Completed', 'Pending', node));
    });

    expect(result.current.state.changesById).toEqual({});
    expect(result.current.state.originalsById).toEqual({});
  });

  it('does not let programmatic edit flows write through a read-only row', () => {
    const editableRow = transaction('Pending', 'enabled', 'txn-enabled');
    const readOnlyRow = transaction('Pending', 'readOnly', 'txn-read-only');
    const editableNode = { data: editableRow, setDataValue: vi.fn() } as unknown as RowNode<Transaction>;
    const readOnlyNode = { data: readOnlyRow, setDataValue: vi.fn() } as unknown as RowNode<Transaction>;
    const { result } = renderHook(() => useTrackedGridEditing(transactionEditingConfig));

    act(() => result.current.applyChangesToNodes([editableNode, readOnlyNode], { status: 'Failed' }));

    expect(editableNode.setDataValue).toHaveBeenCalledWith('status', 'Failed', 'data');
    expect(readOnlyNode.setDataValue).not.toHaveBeenCalled();
    expect(result.current.state.changesById).toEqual({ 'txn-enabled': { status: 'Failed' } });
  });

  it('does not record a direct cell event for a read-only row', () => {
    const readOnlyRow = transaction('Completed', 'readOnly');
    const node = { data: readOnlyRow } as unknown as RowNode<Transaction>;
    const { result } = renderHook(() => useTrackedGridEditing(transactionEditingConfig));

    act(() => result.current.handleCellValueChanged(cellEvent(readOnlyRow, 'Pending', 'Completed', node)));

    expect(result.current.state.changesById).toEqual({});
    expect(result.current.lastEdit).toBeUndefined();
  });
});
