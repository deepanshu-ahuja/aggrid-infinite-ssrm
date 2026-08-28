import type { ReactElement } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GridApi,
  GridReadyEvent,
  RowNode,
  SelectionChangedEvent,
} from 'ag-grid-community';
import type { Transaction } from '../api/transactions.contracts';
import { TransactionsClientGrid } from './TransactionsClientGrid';

const gridCapture = vi.hoisted(() => ({ props: undefined as unknown }));
const transactionApi = vi.hoisted(() => ({
  listAllTransactions: vi.fn(),
  listTransactions: vi.fn(),
  updateTransaction: vi.fn(),
  bulkUpdateTransactions: vi.fn(),
  updateTransactionsBySelection: vi.fn(),
  exportTransactionsBySelection: vi.fn(),
}));

vi.mock('ag-grid-react', () => ({
  AgGridReact: (props: unknown) => {
    gridCapture.props = props;
    return <div data-testid="mock-ag-grid" />;
  },
}));

vi.mock('../api/transactions.api', () => transactionApi);

interface CapturedGridProps {
  rowModelType?: string;
  rowData?: Transaction[];
  datasource?: unknown;
  rowSelection?: {
    mode?: string;
    selectAll?: string;
    isRowSelectable?: (node: RowNode<Transaction>) => boolean;
  };
  onGridReady?: (event: GridReadyEvent<Transaction>) => void;
  onSelectionChanged?: (event: SelectionChangedEvent<Transaction>) => void;
}

function createTransaction(
  id: string,
  interactionMode: Transaction['interactionMode'] = 'enabled',
): Transaction {
  return {
    id,
    reference: `REF-${id}`,
    account: 'Operating',
    amount: 100,
    currency: 'USD',
    status: 'Pending',
    transactionDate: '2026-08-28',
    interactionMode,
  };
}

function createApi(selectedRows: Transaction[] = []): GridApi<Transaction> {
  return {
    getSelectedRows: vi.fn(() => selectedRows),
    deselectAll: vi.fn(),
    exportDataAsCsv: vi.fn(),
    setGridOption: vi.fn(),
    refreshCells: vi.fn(),
    forEachNode: vi.fn(),
  } as unknown as GridApi<Transaction>;
}

function renderGrid(element: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
}

function getGridProps() {
  return gridCapture.props as CapturedGridProps;
}

beforeEach(() => {
  transactionApi.listAllTransactions.mockResolvedValue([
    createTransaction('txn-a'),
    createTransaction('txn-b'),
    createTransaction('txn-disabled', 'selectionDisabled'),
  ]);
});

afterEach(() => {
  vi.clearAllMocks();
  gridCapture.props = undefined;
  window.localStorage.clear();
});

describe('TransactionsClientGrid production wiring', () => {
  it('fetches the complete collection once and supplies native Client-Side rowData', async () => {
    const authoritativeRows = [createTransaction('txn-a'), createTransaction('txn-b')];
    transactionApi.listAllTransactions.mockResolvedValue(authoritativeRows);

    renderGrid(<TransactionsClientGrid />);

    await waitFor(() => expect(getGridProps().rowData).toHaveLength(2));

    expect(getGridProps().rowModelType).toBe('clientSide');
    expect(getGridProps().datasource).toBeUndefined();
    expect(transactionApi.listAllTransactions).toHaveBeenCalledTimes(1);
    expect(transactionApi.listTransactions).not.toHaveBeenCalled();

    // AG Grid receives editable copies so cell edits cannot mutate TanStack Query's authoritative cache.
    expect(getGridProps().rowData?.[0]).toEqual(authoritativeRows[0]);
    expect(getGridProps().rowData?.[0]).not.toBe(authoritativeRows[0]);
  });

  it('uses native current-page header selection and backend row eligibility', async () => {
    renderGrid(<TransactionsClientGrid selectionScope="page" />);

    await waitFor(() => expect(getGridProps().rowData).toHaveLength(3));

    expect(getGridProps().rowSelection).toMatchObject({
      mode: 'multiRow',
      selectAll: 'currentPage',
    });

    const isRowSelectable = getGridProps().rowSelection?.isRowSelectable;
    expect(
      isRowSelectable?.({ data: createTransaction('enabled') } as unknown as RowNode<Transaction>),
    ).toBe(true);
    expect(
      isRowSelectable?.({
        data: createTransaction('disabled', 'selectionDisabled'),
      } as unknown as RowNode<Transaction>),
    ).toBe(false);
  });

  it('exports selected Client rows locally across pagination pages', async () => {
    const selectedRows = [createTransaction('txn-a'), createTransaction('txn-b')];
    const api = createApi(selectedRows);

    renderGrid(<TransactionsClientGrid />);
    await waitFor(() => expect(getGridProps().rowData).toHaveLength(3));

    act(() => {
      getGridProps().onGridReady?.({ api } as unknown as GridReadyEvent<Transaction>);
      getGridProps().onSelectionChanged?.({ api } as unknown as SelectionChangedEvent<Transaction>);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Export selected' }));

    expect(api.exportDataAsCsv).toHaveBeenCalledWith({
      fileName: 'transactions-client-selected.csv',
      onlySelected: true,
      onlySelectedAllPages: true,
    });
    expect(transactionApi.exportTransactionsBySelection).not.toHaveBeenCalled();
  });

  it('sends selected Client rows as explicit backend IDs and refetches authoritative rowData', async () => {
    const selectedRows = [createTransaction('txn-a'), createTransaction('txn-b')];
    const api = createApi(selectedRows);
    transactionApi.updateTransactionsBySelection.mockResolvedValue({ updatedCount: 2 });

    renderGrid(<TransactionsClientGrid />);
    await waitFor(() => expect(getGridProps().rowData).toHaveLength(3));

    act(() => {
      getGridProps().onGridReady?.({ api } as unknown as GridReadyEvent<Transaction>);
      getGridProps().onSelectionChanged?.({ api } as unknown as SelectionChangedEvent<Transaction>);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mark Failed' }));

    await waitFor(() => {
      expect(transactionApi.updateTransactionsBySelection).toHaveBeenCalledWith({
        selection: { mode: 'include', ids: ['txn-a', 'txn-b'] },
        filters: [],
        changes: { status: 'Failed' },
      });
    });

    await waitFor(() => expect(transactionApi.listAllTransactions).toHaveBeenCalledTimes(2));
  });
});
