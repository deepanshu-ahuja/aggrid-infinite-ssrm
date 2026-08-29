// GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-DISCARD | GRIDCAP-EDIT-CONFLICT | GRIDCAP-EDIT-VALIDATION
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CellValueChangedEvent, GridApi, RowNode } from 'ag-grid-community';
import type { GridRowInteractionMode } from '@/shared/grid/rows/gridRowInteraction';
import type { Transaction } from '@/features/transactions/api/transactions.contracts';
import {
  transactionEditingConfig,
  type TransactionEditableField,
  type TransactionEditableValue,
} from '@/features/transactions/grid/transactionEditing';
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
  field: TransactionEditableField,
  oldValue: TransactionEditableValue,
  newValue: TransactionEditableValue,
  node: RowNode<Transaction>,
) {
  return {
    data: row,
    node,
    colDef: { field },
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
      result.current.handleCellValueChanged(
        cellEvent(row, 'status', 'Pending', 'Completed', initialNode),
      );
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
    expect(result.current.validationState).toEqual({});

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

  it('keeps an invalid direct LOCAL edit visible, dirty and field-invalid until corrected', () => {
    const row = transaction('Pending');
    const node = { data: row } as unknown as RowNode<Transaction>;
    const { result } = renderHook(() => useTrackedGridEditing(transactionEditingConfig));

    act(() => {
      row.account = '';
      result.current.handleCellValueChanged(cellEvent(row, 'account', 'Account', '', node));
    });

    expect(result.current.state.changesById['txn-a']).toEqual({ account: '' });
    expect(result.current.validationState['txn-a']?.account?.[0]?.message).toBe(
      'Account is required.',
    );
    expect(result.current.validationErrorCount).toBe(1);

    act(() => {
      row.account = 'Corrected';
      result.current.handleCellValueChanged(cellEvent(row, 'account', '', 'Corrected', node));
    });

    expect(result.current.state.changesById['txn-a']).toEqual({ account: 'Corrected' });
    expect(result.current.validationState).toEqual({});
  });

  it('applies the same validation lifecycle to programmatic current-page edits and Discard', () => {
    const row = transaction('Pending');
    const node = {
      data: row,
      setDataValue: vi.fn((field: keyof Transaction, value: unknown) => {
        (row as unknown as Record<string, unknown>)[field] = value;
        return true;
      }),
    } as unknown as RowNode<Transaction>;
    const api = {
      forEachNode: vi.fn((callback: (rowNode: RowNode<Transaction>) => void) => callback(node)),
    } as unknown as GridApi<Transaction>;
    const { result } = renderHook(() => useTrackedGridEditing(transactionEditingConfig));

    act(() => result.current.applyChangesToNodes([node], { currency: 'USDX' }));

    expect(row.currency).toBe('USDX');
    expect(result.current.state.changesById['txn-a']).toEqual({ currency: 'USDX' });
    expect(result.current.validationState['txn-a']?.currency?.[0]?.message).toContain('3 characters');

    act(() => result.current.discardRow(api, 'txn-a'));

    expect(row.currency).toBe('USD');
    expect(result.current.state.changesById).toEqual({});
    expect(result.current.validationState).toEqual({});
  });

  it('replaces backend field errors when the user edits that LOCAL field again', () => {
    const row = transaction('Pending');
    const node = { data: row } as unknown as RowNode<Transaction>;
    const { result } = renderHook(() => useTrackedGridEditing(transactionEditingConfig));

    act(() => {
      row.account = 'Server-rejected';
      result.current.handleCellValueChanged(
        cellEvent(row, 'account', 'Account', 'Server-rejected', node),
      );
      result.current.setServerValidationErrors('txn-a', {
        account: ['Backend account rule rejected this value.'],
      });
    });

    expect(result.current.validationState['txn-a']?.account?.[0]).toEqual({
      source: 'server',
      message: 'Backend account rule rejected this value.',
    });

    act(() => {
      row.account = 'Corrected';
      result.current.handleCellValueChanged(
        cellEvent(row, 'account', 'Server-rejected', 'Corrected', node),
      );
    });

    expect(result.current.validationState).toEqual({});
    expect(result.current.state.changesById['txn-a']).toEqual({ account: 'Corrected' });
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

    act(() =>
      result.current.handleCellValueChanged(cellEvent(row, 'status', 'Pending', 'Failed', node)),
    );
    act(() => result.current.restoreTrackedEdits(api));

    expect(result.current.state.changesById['txn-a']).toEqual({ status: 'Failed' });
    expect(result.current.state.conflictsById).toEqual({});
  });

  it('detects a conflict when a refreshed RowNode carries a different server value', () => {
    const editedRow = transaction('Failed');
    const editedNode = { data: editedRow } as unknown as RowNode<Transaction>;
    const { result } = renderHook(() => useTrackedGridEditing(transactionEditingConfig));

    act(() =>
      result.current.handleCellValueChanged(
        cellEvent(editedRow, 'status', 'Pending', 'Failed', editedNode),
      ),
    );

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

  it('Use server clears validation for the LOCAL field it removes', () => {
    const editedRow = transaction('Pending');
    const editedNode = { data: editedRow } as unknown as RowNode<Transaction>;
    const { result } = renderHook(() => useTrackedGridEditing(transactionEditingConfig));

    act(() => {
      editedRow.account = '';
      result.current.handleCellValueChanged(cellEvent(editedRow, 'account', 'Account', '', editedNode));
    });

    const refreshedRow = { ...transaction('Pending'), account: 'Remote' };
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
    expect(result.current.state.conflictsById['txn-a']?.account?.remoteValue).toBe('Remote');

    act(() => result.current.resolveConflictWithRemote(api, 'txn-a', 'account'));

    expect(result.current.state.changesById).toEqual({});
    expect(result.current.validationState).toEqual({});
    expect(refreshedRow.account).toBe('Remote');
  });

  it('still clears a draft when the user manually edits a non-conflicted field back to BASE', () => {
    const row = transaction('Completed');
    const node = { data: row } as unknown as RowNode<Transaction>;
    const { result } = renderHook(() => useTrackedGridEditing(transactionEditingConfig));

    act(() =>
      result.current.handleCellValueChanged(cellEvent(row, 'status', 'Pending', 'Completed', node)),
    );
    act(() => {
      row.status = 'Pending';
      result.current.handleCellValueChanged(cellEvent(row, 'status', 'Completed', 'Pending', node));
    });

    expect(result.current.state.changesById).toEqual({});
    expect(result.current.state.originalsById).toEqual({});
    expect(result.current.validationState).toEqual({});
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

    act(() =>
      result.current.handleCellValueChanged(
        cellEvent(readOnlyRow, 'status', 'Pending', 'Completed', node),
      ),
    );

    expect(result.current.state.changesById).toEqual({});
    expect(result.current.validationState).toEqual({});
    expect(result.current.lastEdit).toBeUndefined();
  });
});
