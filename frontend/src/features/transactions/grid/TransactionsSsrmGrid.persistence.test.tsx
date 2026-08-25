import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CellValueChangedEvent,
  GridApi,
  GridReadyEvent,
} from 'ag-grid-community';
import { queryClient } from '@/shared/query/queryClient';
import type { Transaction } from '../api/transactions.contracts';
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
  onGridReady?: (event: GridReadyEvent<Transaction>) => void;
  onCellValueChanged?: (event: CellValueChangedEvent<Transaction>) => void;
}

function props() {
  return gridCapture.props as CapturedGridProps;
}

function row(id: string): Transaction {
  return {
    id,
    reference: `REF-${id}`,
    account: 'Treasury',
    amount: 100,
    currency: 'USD',
    status: 'Completed',
    transactionDate: '2026-08-24',
  };
}

afterEach(() => {
  vi.clearAllMocks();
  queryClient.clear();
  gridCapture.props = undefined;
});

describe('TransactionsSsrmGrid edit persistence', () => {
  it('refreshes SSRM from the server after a successful row save', async () => {
    const api = {
      refreshServerSide: vi.fn(),
      forEachNode: vi.fn(),
      retryServerSideLoads: vi.fn(),
    } as unknown as GridApi<Transaction>;
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

    fireEvent.click(screen.getByRole('button', { name: 'Save row' }));

    await waitFor(() => {
      expect(transactionApi.updateTransaction).toHaveBeenCalledWith('txn-a', {
        status: 'Completed',
      });
      expect(api.refreshServerSide).toHaveBeenCalledTimes(1);
      expect(screen.getByText('0 rows currently edited')).toBeInTheDocument();
    });
  });
});
