import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CellValueChangedEvent,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
  SelectionColumnDef,
} from 'ag-grid-community';
import type { Transaction } from '../api/transactions.contracts';
import { TransactionsInfiniteGrid } from './TransactionsInfiniteGrid';

/** Mock only AG Grid's React boundary so these tests exercise our root ownership/wiring. */
const gridCapture = vi.hoisted(() => ({
  props: undefined as unknown,
}));

vi.mock('ag-grid-react', () => ({
  AgGridReact: (props: unknown) => {
    gridCapture.props = props;
    return <div data-testid="mock-ag-grid" />;
  },
}));

interface CapturedGridProps {
  selectionColumnDef?: SelectionColumnDef;
  onGridReady?: (event: GridReadyEvent<Transaction>) => void;
  onSelectionChanged?: (event: SelectionChangedEvent<Transaction>) => void;
  onCellValueChanged?: (event: CellValueChangedEvent<Transaction>) => void;
}

function getGridProps() {
  return gridCapture.props as CapturedGridProps;
}

function createApi(options?: {
  rowSelection?: string[];
}): GridApi<Transaction> {
  return {
    getState: vi.fn(() => ({
      rowSelection: options?.rowSelection ?? [],
    })),
    isLastRowIndexKnown: vi.fn(() => false),
    getDisplayedRowCount: vi.fn(() => 0),
    forEachNode: vi.fn(),
    refreshHeader: vi.fn(),
  } as unknown as GridApi<Transaction>;
}

function gridReady(api: GridApi<Transaction>): GridReadyEvent<Transaction> {
  return { api } as unknown as GridReadyEvent<Transaction>;
}

afterEach(() => {
  vi.useRealTimers();
  gridCapture.props = undefined;
  window.localStorage.clear();
});

describe('TransactionsInfiniteGrid production wiring', () => {
  it('publishes native page/manual selection directly from the root GridApi event', () => {
    vi.useFakeTimers();
    const api = createApi({ rowSelection: ['txn-a', 'txn-b'] });
    const onSelectionChange = vi.fn();

    render(
      <TransactionsInfiniteGrid
        selectionScope="page"
        onSelectionChange={onSelectionChange}
      />,
    );

    act(() => {
      getGridProps().onGridReady?.(gridReady(api));
      getGridProps().onSelectionChanged?.({
        api,
      } as unknown as SelectionChangedEvent<Transaction>);
    });

    expect(onSelectionChange).toHaveBeenLastCalledWith({
      mode: 'include',
      ids: ['txn-a', 'txn-b'],
    });
    expect(api.getState).toHaveBeenCalled();
  });

  it('publishes dataset Select All as logical exclude state without a dev-preview bridge', async () => {
    const onSelectionChange = vi.fn();

    render(
      <TransactionsInfiniteGrid
        selectionScope="filtered"
        onSelectionChange={onSelectionChange}
      />,
    );

    const headerParams = getGridProps().selectionColumnDef
      ?.headerComponentParams as
      | { onChange?: (checked: boolean) => void }
      | undefined;

    act(() => {
      headerParams?.onChange?.(true);
    });

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenLastCalledWith({
        mode: 'exclude',
        ids: [],
      });
    });
  });

  it('tracks a direct cell edit through the shared edit engine without dev payload state', () => {
    render(<TransactionsInfiniteGrid selectionScope="page" />);

    act(() => {
      getGridProps().onCellValueChanged?.({
        data: {
          id: 'txn-b',
          reference: 'REF-txn-b',
          account: 'Account',
          amount: 100,
          currency: 'USD',
          status: 'Completed',
          transactionDate: '2026-08-24',
        },
        colDef: { field: 'status' },
        oldValue: 'Pending',
        newValue: 'Completed',
      } as unknown as CellValueChangedEvent<Transaction>);
    });

    expect(screen.getByText('1 row currently edited')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /preview/i }),
    ).not.toBeInTheDocument();
  });
});
