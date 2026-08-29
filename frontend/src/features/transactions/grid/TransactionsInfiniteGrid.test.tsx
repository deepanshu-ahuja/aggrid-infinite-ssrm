import { act, render, screen, waitFor } from '@testing-library/react';
import type {
  CellValueChangedEvent,
  FilterChangedEvent,
  GridApi,
  GridReadyEvent,
  ModelUpdatedEvent,
  PaginationChangedEvent,
  RowNode,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from '../api/transactions.contracts';
import { TransactionsInfiniteGrid } from './TransactionsInfiniteGrid';
import type { TransactionRowEditActionsContext } from './TransactionRowEditActions';
import * as transactionApi from '../api/transactions.api';

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

vi.mock('@/shared/grid/export/exportCurrentPageCsv', () => ({
  exportCurrentPageCsv: vi.fn(() => ({ ok: true })),
}));

vi.mock('../export/exportSelectedTransactions', () => ({
  exportSelectedTransactions: vi.fn(),
}));

function getGridProps() {
  if (!gridProps.current) throw new Error('Grid props were not captured.');
  return gridProps.current as any;
}

function createRow(id: string, overrides: Partial<Transaction> = {}): Transaction {
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
    forEachNodeAfterFilterAndSort: vi.fn((callback: (node: RowNode<Transaction>) => void) =>
      nodes.forEach(callback),
    ),
    getSelectedNodes: vi.fn(() => selectedNodes),
    deselectAll: vi.fn(() => {
      selectedNodes.splice(0, selectedNodes.length);
    }),
    paginationGetCurrentPage: vi.fn(() => 0),
    paginationGetPageSize: vi.fn(() => 100),
    paginationGetRowCount: vi.fn(() => 750),
    getDisplayedRowAtIndex: vi.fn((index: number) => nodes[index]),
    refreshInfiniteCache: vi.fn(),
    getFilterModel: vi.fn(() => ({})),
    getState: vi.fn(() => ({})),
    setGridOption: vi.fn(),
    refreshCells: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getGridOption: vi.fn(),
  } as unknown as GridApi<Transaction>;
  return Object.assign(api, { selectedNodes });
}

beforeEach(() => {
  gridProps.current = undefined;
  vi.clearAllMocks();
  vi.mocked(transactionApi.updateTransaction).mockResolvedValue({ row: createRow('txn-a') });
  vi.mocked(transactionApi.bulkUpdateTransactions).mockResolvedValue({ rows: [], updatedCount: 0 });
  vi.mocked(transactionApi.updateSelectedTransactions).mockResolvedValue({ updatedCount: 1 });
});

describe('TransactionsInfiniteGrid production wiring', () => {
  it('uses backend interaction mode through native AG Grid row selectability', () => {
    render(<TransactionsInfiniteGrid />);
    const rowSelection = getGridProps().rowSelection;
    expect(rowSelection.isRowSelectable({ data: createRow('a', { interactionMode: 'enabled' }) })).toBe(true);
    expect(
      rowSelection.isRowSelectable({ data: createRow('b', { interactionMode: 'selectionDisabled' }) }),
    ).toBe(false);
    expect(rowSelection.isRowSelectable({ data: createRow('c', { interactionMode: 'readOnly' }) })).toBe(false);
  });

  it('publishes native page/manual selection directly from the root GridApi event', () => {
    const onSelectionChange = vi.fn();
    render(<TransactionsInfiniteGrid onSelectionChange={onSelectionChange} />);
    const api = createApi();
    api.selectedNodes.push(createNode(createRow('txn-a')));

    act(() =>
      getGridProps().onSelectionChanged({ api } as unknown as SelectionChangedEvent<Transaction>),
    );

    expect(onSelectionChange).toHaveBeenLastCalledWith({ mode: 'include', ids: ['txn-a'] });
  });

  it('updates explicit selected rows, clears selection after success, and refreshes Infinite data', async () => {
    const row = createRow('txn-a');
    const node = createNode(row);
    const api = createApi([node]);
    api.selectedNodes.push(node);
    render(<TransactionsInfiniteGrid />);

    act(() => getGridProps().onGridReady({ api } as unknown as GridReadyEvent<Transaction>));
    act(() =>
      getGridProps().onSelectionChanged({ api } as unknown as SelectionChangedEvent<Transaction>),
    );

    screen.getByRole('button', { name: 'Mark Completed' }).click();

    await waitFor(() => {
      expect(transactionApi.updateSelectedTransactions).toHaveBeenCalledWith({
        selection: { mode: 'include', ids: ['txn-a'] },
        filters: [],
        changes: { status: 'Completed' },
      });
      expect(api.deselectAll).toHaveBeenCalled();
      expect(api.refreshInfiniteCache).toHaveBeenCalled();
    });
  });

  it('publishes dataset Select All as logical exclude state', () => {
    const onSelectionChange = vi.fn();
    render(<TransactionsInfiniteGrid onSelectionChange={onSelectionChange} />);
    const api = createApi();
    act(() => getGridProps().onGridReady({ api } as unknown as GridReadyEvent<Transaction>));

    const controller = getGridProps().selectionController;
    act(() => controller?.selectAllRecords());
    expect(onSelectionChange).toHaveBeenLastCalledWith({ mode: 'exclude', ids: [] });
  });

  it('tracks a direct cell edit in the row Actions context', async () => {
    const row = createRow('txn-a');
    const node = createNode(row);
    const api = createApi([node]);
    render(<TransactionsInfiniteGrid />);
    act(() => getGridProps().onGridReady({ api } as unknown as GridReadyEvent<Transaction>));

    act(() => {
      getGridProps().onCellValueChanged({
        data: row,
        node,
        colDef: { field: 'account' },
        oldValue: 'Operating',
        newValue: 'Treasury',
      } as unknown as CellValueChangedEvent<Transaction>);
    });

    await waitFor(() => expect(getGridProps().context?.isRowDirty('txn-a')).toBe(true));
  });

  it('restores a tracked edit when an Infinite row is recreated and the model updates', async () => {
    const original = createRow('txn-a');
    const originalNode = createNode(original);
    const api = createApi([originalNode]);
    render(<TransactionsInfiniteGrid />);
    act(() => getGridProps().onGridReady({ api } as unknown as GridReadyEvent<Transaction>));

    act(() => {
      getGridProps().onCellValueChanged({
        data: original,
        node: originalNode,
        colDef: { field: 'account' },
        oldValue: 'Operating',
        newValue: 'Treasury',
      } as unknown as CellValueChangedEvent<Transaction>);
    });

    const recreated = createRow('txn-a');
    const recreatedNode = createNode(recreated);
    vi.mocked(api.forEachNode).mockImplementation((callback) => callback(recreatedNode));

    act(() =>
      getGridProps().onModelUpdated({ api } as unknown as ModelUpdatedEvent<Transaction>),
    );

    await waitFor(() => expect(recreated.account).toBe('Treasury'));
  });

  it('restores a tracked edit when Infinite pagination changes', async () => {
    const original = createRow('txn-a');
    const originalNode = createNode(original);
    const api = createApi([originalNode]);
    render(<TransactionsInfiniteGrid />);
    act(() => getGridProps().onGridReady({ api } as unknown as GridReadyEvent<Transaction>));

    act(() => {
      getGridProps().onCellValueChanged({
        data: original,
        node: originalNode,
        colDef: { field: 'account' },
        oldValue: 'Operating',
        newValue: 'Treasury',
      } as unknown as CellValueChangedEvent<Transaction>);
    });

    const recreated = createRow('txn-a');
    const recreatedNode = createNode(recreated);
    vi.mocked(api.forEachNode).mockImplementation((callback) => callback(recreatedNode));

    act(() =>
      getGridProps().onPaginationChanged({ api } as unknown as PaginationChangedEvent<Transaction>),
    );

    await waitFor(() => expect(recreated.account).toBe('Treasury'));
  });

  it('keeps the row clean when Discard restores a value through AG Grid', async () => {
    const row = createRow('txn-a');
    const node = createNode(row);
    const api = createApi([node]);
    render(<TransactionsInfiniteGrid />);
    act(() => getGridProps().onGridReady({ api } as unknown as GridReadyEvent<Transaction>));

    act(() => {
      getGridProps().onCellValueChanged({
        data: row,
        node,
        colDef: { field: 'status' },
        oldValue: 'Pending',
        newValue: 'Completed',
      } as unknown as CellValueChangedEvent<Transaction>);
    });

    act(() => getGridProps().context?.onDiscardRow('txn-a'));

    await waitFor(() => {
      expect(row.status).toBe('Pending');
      expect(getGridProps().context?.isRowDirty('txn-a')).toBe(false);
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

  it('saves one dirty row through its row action regardless of checkbox selection', async () => {
    const api = createApi();
    transactionApi.updateTransaction.mockResolvedValue({
      row: createRow('txn-a', { status: 'Completed' }),
    });
    const row = createRow('txn-a');
    const node = createNode(row);
    vi.mocked(api.forEachNode).mockImplementation((callback) => callback(node));
    render(<TransactionsInfiniteGrid />);
    act(() => getGridProps().onGridReady({ api } as unknown as GridReadyEvent<Transaction>));

    act(() => {
      getGridProps().onCellValueChanged({
        data: row,
        node,
        colDef: { field: 'status' },
        oldValue: 'Pending',
        newValue: 'Completed',
      } as unknown as CellValueChangedEvent<Transaction>);
    });

    await waitFor(() => expect(getGridProps().context?.isRowDirty('txn-a')).toBe(true));
    act(() => getGridProps().context?.onSaveRow('txn-a'));

    await waitFor(() => {
      expect(transactionApi.updateTransaction).toHaveBeenCalledWith('txn-a', { status: 'Completed' });
      expect(api.refreshInfiniteCache).toHaveBeenCalled();
    });
  });

  it('bulk-saves only rows that are both dirty and selected', async () => {
    const rowA = createRow('txn-a');
    const rowB = createRow('txn-b');
    const nodeA = createNode(rowA);
    const nodeB = createNode(rowB);
    const api = createApi([nodeA, nodeB]);
    api.selectedNodes.push(nodeB);
    render(<TransactionsInfiniteGrid />);
    act(() => getGridProps().onGridReady({ api } as unknown as GridReadyEvent<Transaction>));

    for (const [row, node, status] of [
      [rowA, nodeA, 'Completed'],
      [rowB, nodeB, 'Failed'],
    ] as const) {
      act(() => {
        getGridProps().onCellValueChanged({
          data: row,
          node,
          colDef: { field: 'status' },
          oldValue: 'Pending',
          newValue: status,
        } as unknown as CellValueChangedEvent<Transaction>);
      });
    }

    act(() =>
      getGridProps().onSelectionChanged({ api } as unknown as SelectionChangedEvent<Transaction>),
    );
    screen.getByRole('button', { name: 'Save selected edits (1)' }).click();

    await waitFor(() =>
      expect(transactionApi.bulkUpdateTransactions).toHaveBeenCalledWith({
        updates: [{ id: 'txn-b', changes: { status: 'Failed' } }],
      }),
    );
  });
});
