import { act, render, screen, waitFor } from '@testing-library/react';
import type { CellValueChangedEvent, GridApi, GridReadyEvent, RowNode, SelectionChangedEvent } from 'ag-grid-community';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from '../api/transactions.contracts';
import * as transactionApi from '../api/transactions.api';
import { TransactionsSsrmGrid } from './TransactionsSsrmGrid';
import type { TransactionRowEditActionsContext } from './TransactionRowEditActions';

const gridProps = vi.hoisted(() => ({ current: undefined as Record<string, unknown> | undefined }));

vi.mock('ag-grid-react', () => ({
  AgGridReact: (props: Record<string, unknown>) => {
    gridProps.current = props;
    return <div data-testid="grid" />;
  },
}));

vi.mock('../api/transactions.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/transactions.api')>();
  return {
    ...actual,
    updateTransaction: vi.fn(),
    bulkUpdateTransactions: vi.fn(),
    updateSelectedTransactions: vi.fn(),
  };
});

vi.mock('../export/exportSelectedTransactions', () => ({
  exportSelectedTransactions: vi.fn(),
}));

function props() {
  if (!gridProps.current) throw new Error('Grid props were not captured.');
  return gridProps.current as any;
}

function createTransaction(id = 'txn-a', overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    reference: `TRX-${id}`,
    account: 'Operating',
    amount: 100,
    currency: 'USD',
    status: 'Pending',
    transactionDate: '2026-01-01',
    interactionMode: 'enabled',
    interactionReason: null,
    ...overrides,
  };
}

function createNode(data: Transaction): RowNode<Transaction> {
  return {
    data,
    setDataValue: vi.fn((field: string, value: unknown) => {
      (data as unknown as Record<string, unknown>)[field] = value;
      return true;
    }),
  } as unknown as RowNode<Transaction>;
}

function createApi(nodes: RowNode<Transaction>[] = []) {
  const selectedNodes: RowNode<Transaction>[] = [];
  const api = {
    forEachNode: vi.fn((callback: (node: RowNode<Transaction>) => void) => nodes.forEach(callback)),
    getSelectedNodes: vi.fn(() => selectedNodes),
    deselectAll: vi.fn(() => selectedNodes.splice(0, selectedNodes.length)),
    getFilterModel: vi.fn(() => ({})),
    refreshServerSide: vi.fn(),
    setGridOption: vi.fn(),
    refreshCells: vi.fn(),
    getServerSideSelectionState: vi.fn(() => ({ selectAll: false, toggledNodes: [] })),
    setServerSideSelectionState: vi.fn(),
    getState: vi.fn(() => ({})),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getGridOption: vi.fn(),
  } as unknown as GridApi<Transaction>;
  return Object.assign(api, { selectedNodes });
}

beforeEach(() => {
  gridProps.current = undefined;
  vi.clearAllMocks();
  vi.mocked(transactionApi.updateTransaction).mockResolvedValue({ row: createTransaction() });
  vi.mocked(transactionApi.bulkUpdateTransactions).mockResolvedValue({ rows: [], updatedCount: 0 });
  vi.mocked(transactionApi.updateSelectedTransactions).mockResolvedValue({ updatedCount: 1 });
});

describe('TransactionsSsrmGrid edit persistence', () => {
  it('refreshes SSRM from the server after a successful row save', async () => {
    const transaction = createTransaction();
    const node = createNode(transaction);
    const api = createApi([node]);
    vi.mocked(transactionApi.updateTransaction).mockResolvedValue({
      row: createTransaction('txn-a', { status: 'Completed' }),
    });

    render(<TransactionsSsrmGrid />);
    act(() => props().onGridReady({ api } as unknown as GridReadyEvent<Transaction>));

    act(() => {
      props().onCellValueChanged({
        data: transaction,
        node,
        colDef: { field: 'status' },
        oldValue: 'Pending',
        newValue: 'Completed',
      } as unknown as CellValueChangedEvent<Transaction>);
    });

    await waitFor(() => expect(props().context?.isRowDirty('txn-a')).toBe(true));
    act(() => props().context?.onSaveRow('txn-a'));

    await waitFor(() => {
      expect(transactionApi.updateTransaction).toHaveBeenCalledWith('txn-a', { status: 'Completed' });
      expect(api.refreshServerSide).toHaveBeenCalled();
    });
  });

  it('updates native explicit selection through the action bar, clears it after success, and refreshes SSRM', async () => {
    const transaction = createTransaction();
    const node = createNode(transaction);
    const api = createApi([node]);
    api.selectedNodes.push(node);
    vi.mocked(api.getServerSideSelectionState).mockReturnValue({
      selectAll: false,
      toggledNodes: ['txn-a'],
    } as never);

    render(<TransactionsSsrmGrid />);
    act(() => props().onGridReady({ api } as unknown as GridReadyEvent<Transaction>));
    act(() => props().onSelectionChanged({ api } as unknown as SelectionChangedEvent<Transaction>));

    screen.getByRole('button', { name: 'Mark Completed' }).click();

    await waitFor(() => {
      expect(transactionApi.updateSelectedTransactions).toHaveBeenCalledWith({
        selection: { mode: 'include', ids: ['txn-a'] },
        filters: [],
        changes: { status: 'Completed' },
      });
      expect(api.setServerSideSelectionState).toHaveBeenCalledWith({
        selectAll: false,
        toggledNodes: [],
      });
      expect(api.refreshServerSide).toHaveBeenCalled();
    });
  });

  it('keeps the row clean when Discard restores a value through AG Grid', async () => {
    const transaction = createTransaction();
    const node = createNode(transaction);
    const api = createApi([node]);

    render(<TransactionsSsrmGrid />);
    act(() => props().onGridReady({ api } as unknown as GridReadyEvent<Transaction>));

    act(() => {
      props().onCellValueChanged({
        data: transaction,
        node,
        colDef: { field: 'status' },
        oldValue: 'Pending',
        newValue: 'Completed',
      } as unknown as CellValueChangedEvent<Transaction>);
    });

    act(() => props().context?.onDiscardRow('txn-a'));

    await waitFor(() => {
      expect(transaction.status).toBe('Pending');
      expect(props().context?.isRowDirty('txn-a')).toBe(false);

      const latestContext = vi.mocked(api.setGridOption).mock.calls.at(-1)?.[1] as
        TransactionRowEditActionsContext | undefined;
      expect(latestContext?.isRowDirty('txn-a')).toBe(false);
      // Editing context drives editable/conflict/validation presentation as well as the row Actions renderer.
      // Refresh every editable field so Discard cannot leave stale state in any cell.
      expect(api.refreshCells).toHaveBeenLastCalledWith({
        columns: ['account', 'amount', 'currency', 'status', 'transactionDate', 'editActions'],
        force: true,
      });
    });
  });

  it('bulk-saves only rows that are both dirty and selected', async () => {
    const transactionA = createTransaction('txn-a');
    const transactionB = createTransaction('txn-b');
    const nodeA = createNode(transactionA);
    const nodeB = createNode(transactionB);
    const api = createApi([nodeA, nodeB]);
    api.selectedNodes.push(nodeB);
    vi.mocked(api.getServerSideSelectionState).mockReturnValue({
      selectAll: false,
      toggledNodes: ['txn-b'],
    } as never);

    render(<TransactionsSsrmGrid />);
    act(() => props().onGridReady({ api } as unknown as GridReadyEvent<Transaction>));

    for (const [transaction, node, status] of [
      [transactionA, nodeA, 'Completed'],
      [transactionB, nodeB, 'Failed'],
    ] as const) {
      act(() => {
        props().onCellValueChanged({
          data: transaction,
          node,
          colDef: { field: 'status' },
          oldValue: 'Pending',
          newValue: status,
        } as unknown as CellValueChangedEvent<Transaction>);
      });
    }

    act(() => props().onSelectionChanged({ api } as unknown as SelectionChangedEvent<Transaction>));
    screen.getByRole('button', { name: 'Save selected edits (1)' }).click();

    await waitFor(() =>
      expect(transactionApi.bulkUpdateTransactions).toHaveBeenCalledWith({
        updates: [{ id: 'txn-b', changes: { status: 'Failed' } }],
      }),
    );
  });
});
