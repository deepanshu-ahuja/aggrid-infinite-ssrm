import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CellValueChangedEvent,
  GridApi,
  GridReadyEvent,
  SelectionColumnDef,
} from 'ag-grid-community';
import type { Transaction } from '../api/transactions.contracts';
import { TransactionsInfiniteGrid } from './TransactionsInfiniteGrid';

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
  onCellValueChanged?: (event: CellValueChangedEvent<Transaction>) => void;
}

function getGridProps() {
  return gridCapture.props as CapturedGridProps;
}

function createApi(options?: {
  rowSelection?: string[];
  filterModel?: Record<string, unknown>;
}): GridApi<Transaction> {
  return {
    getState: vi.fn(() => ({
      rowSelection: options?.rowSelection ?? [],
    })),
    getFilterModel: vi.fn(() => options?.filterModel ?? {}),
    isLastRowIndexKnown: vi.fn(() => false),
    getDisplayedRowCount: vi.fn(() => 0),
    forEachNode: vi.fn(),
    refreshHeader: vi.fn(),
  } as unknown as GridApi<Transaction>;
}

function gridReady(api: GridApi<Transaction>): GridReadyEvent<Transaction> {
  return { api } as unknown as GridReadyEvent<Transaction>;
}

function readPreview(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent ?? '{}') as unknown;
}

afterEach(() => {
  vi.useRealTimers();
  gridCapture.props = undefined;
  window.localStorage.clear();
});

describe('TransactionsInfiniteGrid root GridApi ownership', () => {
  it('reads native page/manual selection directly from the root GridApi at action time', () => {
    vi.useFakeTimers();
    const api = createApi({ rowSelection: ['txn-a', 'txn-b'] });

    render(<TransactionsInfiniteGrid selectionScope="page" />);

    act(() => {
      getGridProps().onGridReady?.(gridReady(api));
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview selection payload' }),
    );

    expect(readPreview('selection-payload-preview')).toEqual({
      mode: 'include',
      ids: ['txn-a', 'txn-b'],
    });
    expect(api.getState).toHaveBeenCalled();
  });

  it('reads the applied filter directly from GridApi when filtered Select All payload is built', () => {
    vi.useFakeTimers();
    const api = createApi({
      filterModel: {
        status: {
          filterType: 'text',
          type: 'equals',
          filter: 'Completed',
        },
      },
    });

    render(<TransactionsInfiniteGrid selectionScope="filtered" />);

    act(() => {
      getGridProps().onGridReady?.(gridReady(api));
      const headerParams = getGridProps().selectionColumnDef
        ?.headerComponentParams as { onChange?: (checked: boolean) => void } | undefined;
      headerParams?.onChange?.(true);
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview selection payload' }),
    );

    expect(readPreview('selection-payload-preview')).toEqual({
      mode: 'exclude',
      ids: [],
      filters: [
        {
          field: 'status',
          operator: 'equals',
          value: 'Completed',
        },
      ],
    });
    expect(api.getFilterModel).toHaveBeenCalled();
  });

  it('builds selected-edit preview from accumulated edits and native GridApi selection', () => {
    vi.useFakeTimers();
    const api = createApi({ rowSelection: ['txn-b'] });

    render(<TransactionsInfiniteGrid selectionScope="page" />);

    act(() => {
      getGridProps().onGridReady?.(gridReady(api));
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

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview selected edit payload' }),
    );

    expect(readPreview('selected-edit-payload-preview')).toEqual({
      updates: [
        {
          id: 'txn-b',
          changes: { status: 'Completed' },
        },
      ],
    });
  });
});
