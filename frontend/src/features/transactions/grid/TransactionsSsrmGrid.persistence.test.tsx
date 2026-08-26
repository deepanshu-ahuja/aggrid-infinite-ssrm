import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CellValueChangedEvent,
  GridApi,
  GridReadyEvent,
  RowNode,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { queryClient } from '@/shared/query/queryClient';
import type { Transaction } from '../api/transactions.contracts';
import type { TransactionRowEditActionsContext } from './TransactionRowEditActions';
import { TransactionsSsrmGrid } from './TransactionsSsrmGrid';

const gridCapture = vi.hoisted(() => ({ props: undefined as unknown }));
const transactionApi = vi.hoisted(() => ({
  updateTransaction: vi.fn(),
  bulkUpdateTransactions: vi.fn(),
  listTransactions: vi.fn(),
}));

vi.mock('ag-grid-react', () => ({
  AgGridReact: (props: unknown) => {
    gridCapture.props = props;
    return <div data-testid="mock-ssrm-grid" />;
  },
}));

vi.mock('../api/transactions.api', () => transactionApi);

interface CapturedGridProps {
  context?: TransactionRowEditActionsContext;
  onGridReady?: (event: GridReadyEvent<Transaction>) => void;
  onCellValueChanged?: (event: CellValueChangedEvent<Transaction>) => void;
  onSelectionChanged?: (event: SelectionChangedEvent<Transaction>) => void;
}

function props() {
  return gridCapture.props as CapturedGridProps;
}

function row(id: string, status: Transaction['status'] = 'Completed'): Transaction {
  return {
    id,
    reference: `REF-${id}`,
    account: 'Treasury',
    amount: 100,
    currency: 'USD',
    status,
    transactionDate: '2026-08-24',
  };
}

function createRowNode(data: Transaction): RowNode<Transaction> {
  const node = {
    data,
    setDataValue: vi.fn((field: keyof Transaction, value: unknown) => {
      if (node.data) {
        (node.data as unknown as Record<string, unknown>)[field] = value;
      }
      return true;
    }),
  } as unknown as RowNode<Transaction>;
  return node;
}

function createApi(
  selectedIds: string[] = [],
  rows: RowNode<Transaction>[] = [],
): GridApi<Transaction> {
  return {
    getServerSideSelectionState: vi.fn(() => ({
      selectAll: false,
      toggledNodes: selectedIds,
    })),
    setGridOption: vi.fn(),
    refreshServerSide: vi.fn(),
    refreshCells: vi.fn(),
    forEachNode: vi.fn((callback: (node: RowNode<Transaction>) => void) => {
      rows.forEach(callback);
    }),
    retryServerSideLoads: vi.fn(),
  } as unknown as GridApi<Transaction>;
}

afterEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
  gridCapture.props = undefined;
});

describe('TransactionsSsrmGrid edit persistence', () => {
  it('refreshes SSRM from the server after a successful row save', async () => {
    const api = createApi();
    transactionApi.updateTransaction.mockResolvedValue({ row: row('txn-a') });

    render(<TransactionsSsrmGrid />);

    act(() => {
      props().onGridReady?.({ api } as unknown as GridReadyEvent<Transaction>);
      props().onCellValueChanged?.({
        data: row('txn-a'),
        colDef: { field: 'status' },
        oldValue: 'Pending',
        newValue: 'Completed',
      } as unknown as CellValueChangedEvent<Transaction>);
    });

    act(() => props().context?.onSaveRow('txn-a'));

    await waitFor(() => {
      expect(transactionApi.updateTransaction).toHaveBeenCalledWith('txn-a', {
        status: 'Completed',
      });
      expect(api.refreshServerSide).toHaveBeenCalledTimes(1);
      expect(props().context?.isRowDirty('txn-a')).toBe(false);
    });
  });

  it('keeps the row clean when Discard restores a value through AG Grid', async () => {
    const transaction = row('txn-a', 'Completed');
    let node: RowNode<Transaction>;

    node = {
      data: transaction,
      setDataValue: vi.fn((field: keyof Transaction, value: unknown) => {
        const oldValue = transaction[field];
        (transaction as unknown as Record<string, unknown>)[field] = value;

        // AG Grid can emit this event for an application write through setDataValue.
        props().onCellValueChanged?.({
          data: transaction,
          colDef: { field },
          oldValue,
          newValue: value,
        } as unknown as CellValueChangedEvent<Transaction>);
        return true;
      }),
    } as unknown as RowNode<Transaction>;

    const api = createApi([], [node]);
    render(<TransactionsSsrmGrid />);

    act(() => {
      props().onGridReady?.({ api } as unknown as GridReadyEvent<Transaction>);
      props().onCellValueChanged?.({
        data: transaction,
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
        | TransactionRowEditActionsContext
        | undefined;
      expect(latestContext?.isRowDirty('txn-a')).toBe(false);
      expect(api.refreshCells).toHaveBeenLastCalledWith({
        columns: ['editActions'],
        force: true,
      });
    });
  });

  it('bulk-saves only rows that are both dirty and selected', async () => {
    const api = createApi(['txn-b']);
    transactionApi.bulkUpdateTransactions.mockResolvedValue({
      rows: [row('txn-b')],
      updatedCount: 1,
    });

    render(<TransactionsSsrmGrid />);

    act(() => {
      props().onGridReady?.({ api } as unknown as GridReadyEvent<Transaction>);
      props().onCellValueChanged?.({
        data: row('txn-a'),
        colDef: { field: 'status' },
        oldValue: 'Completed',
        newValue: 'Failed',
      } as unknown as CellValueChangedEvent<Transaction>);
      props().onCellValueChanged?.({
        data: row('txn-b'),
        colDef: { field: 'status' },
        oldValue: 'Completed',
        newValue: 'Failed',
      } as unknown as CellValueChangedEvent<Transaction>);
      props().onSelectionChanged?.({
        serverSideState: {
          selectAll: false,
          toggledNodes: ['txn-b'],
        },
      } as unknown as SelectionChangedEvent<Transaction>);
    });

    expect(screen.getByText(/2 rows edited total; 1 selected/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Save selected edits (1)' }),
    );

    await waitFor(() => {
      expect(transactionApi.bulkUpdateTransactions).toHaveBeenCalledWith({
        updates: [{ id: 'txn-b', changes: { status: 'Failed' } }],
      });
      expect(props().context?.isRowDirty('txn-a')).toBe(true);
      expect(props().context?.isRowDirty('txn-b')).toBe(false);
    });
  });
});
