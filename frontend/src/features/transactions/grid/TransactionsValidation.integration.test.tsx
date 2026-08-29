// GRIDCAP-ROWMODEL-CLIENT | GRIDCAP-ROWMODEL-INFINITE | GRIDCAP-ROWMODEL-SSRM | GRIDCAP-EDIT-VALIDATION | GRIDCAP-EDIT-SAVE-ROW
import type { ReactElement } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CellValueChangedEvent } from 'ag-grid-community';
import type { Transaction } from '../api/transactions.contracts';
import type { TransactionRowEditActionsContext } from './TransactionRowEditActions';
import { TransactionsClientGrid } from './TransactionsClientGrid';
import { TransactionsInfiniteGrid } from './TransactionsInfiniteGrid';
import { TransactionsSsrmGrid } from './TransactionsSsrmGrid';

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
  context?: TransactionRowEditActionsContext;
  onCellValueChanged?: (event: CellValueChangedEvent<Transaction>) => void;
}

function getGridProps() {
  return gridCapture.props as CapturedGridProps;
}

function createTransaction(id: string): Transaction {
  return {
    id,
    reference: `REF-${id}`,
    account: 'Operating',
    amount: 100,
    currency: 'USD',
    status: 'Pending',
    transactionDate: '2026-08-29',
    interactionMode: 'enabled',
  };
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

async function assertInvalidDirectEditBlocksRowSave(element: ReactElement, rowId: string) {
  renderGrid(element);

  if (element.type === TransactionsClientGrid) {
    await waitFor(() => expect(transactionApi.listAllTransactions).toHaveBeenCalled());
  }

  const row = createTransaction(rowId);
  row.account = '';

  act(() => {
    getGridProps().onCellValueChanged?.({
      data: row,
      colDef: { field: 'account' },
      oldValue: 'Operating',
      newValue: '',
    } as unknown as CellValueChangedEvent<Transaction>);
  });

  await waitFor(() => {
    expect(getGridProps().context?.isRowDirty(rowId)).toBe(true);
    expect(getGridProps().context?.isRowInvalid(rowId)).toBe(true);
    expect(getGridProps().context?.isCellInvalid(rowId, 'account')).toBe(true);
    expect(getGridProps().context?.getCellValidationMessages(rowId, 'account')).toContain(
      'Account is required.',
    );
  });

  act(() => getGridProps().context?.onSaveRow(rowId));
  expect(transactionApi.updateTransaction).not.toHaveBeenCalled();
}

beforeEach(() => {
  transactionApi.listAllTransactions.mockResolvedValue([createTransaction('txn-loaded')]);
});

afterEach(() => {
  vi.clearAllMocks();
  gridCapture.props = undefined;
  window.localStorage.clear();
});

describe('Transaction validation row-model integration', () => {
  it('keeps invalid LOCAL Client edits dirty and blocks Row Save', async () => {
    await assertInvalidDirectEditBlocksRowSave(<TransactionsClientGrid />, 'txn-client');
  });

  it('keeps invalid LOCAL Infinite edits dirty and blocks Row Save', async () => {
    await assertInvalidDirectEditBlocksRowSave(
      <TransactionsInfiniteGrid selectionScope="page" />,
      'txn-infinite',
    );
  });

  it('keeps invalid LOCAL SSRM edits dirty and blocks Row Save', async () => {
    await assertInvalidDirectEditBlocksRowSave(<TransactionsSsrmGrid />, 'txn-ssrm');
  });
});
