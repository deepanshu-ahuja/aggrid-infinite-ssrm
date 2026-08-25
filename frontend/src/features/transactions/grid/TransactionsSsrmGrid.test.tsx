import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GridApi,
  GridReadyEvent,
  RowNode,
  RowSelectedEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { serverBackedGridDefaults } from '@/shared/grid/config/serverBackedGridDefaults';
import type { Transaction } from '../api/transactions.contracts';
import { TransactionsSsrmGrid } from './TransactionsSsrmGrid';

/**
 * Mock only AG Grid's React rendering boundary. Tests below assert native/custom selection behavior
 * directly instead of using the temporary developer payload preview as a test probe.
 */
const gridCapture = vi.hoisted(() => ({
  props: undefined as unknown,
}));

vi.mock('ag-grid-react', () => ({
  AgGridReact: (props: unknown) => {
    gridCapture.props = props;
    return <div data-testid="mock-ssrm-grid" />;
  },
}));

interface CapturedGridProps {
  rowSelection?: {
    mode?: string;
    headerCheckbox?: boolean;
    selectAll?: string;
    groupSelects?: string;
  };
  onGridReady?: (event: GridReadyEvent<Transaction>) => void;
  onModelUpdated?: () => void;
  onRowSelected?: (event: RowSelectedEvent<Transaction>) => void;
  onSelectionChanged?: (event: SelectionChangedEvent<Transaction>) => void;
  onFilterChanged?: () => void;
}

function getGridProps(): CapturedGridProps {
  return gridCapture.props as CapturedGridProps;
}

function createTransaction(id: string): Transaction {
  return {
    id,
    reference: `REF-${id}`,
    account: 'Account',
    amount: 100,
    currency: 'USD',
    status: 'Completed',
    transactionDate: '2026-08-24',
  };
}

interface TestRowNode {
  node: RowNode<Transaction>;
  setUserSelected: (selected: boolean) => void;
}

function createRowNode(id: string, rowIndex: number): TestRowNode {
  let selected = false;

  const node = {
    data: createTransaction(id),
    rowIndex,
    isSelected: vi.fn(() => selected),
    setSelected: vi.fn((nextSelected: boolean) => {
      selected = nextSelected;
    }),
  } as unknown as RowNode<Transaction>;

  return {
    node,
    setUserSelected(nextSelected) {
      selected = nextSelected;
    },
  };
}

/** AG Grid's method type does not expose Vitest mock helpers, so narrow it only inside tests. */
function clearSetSelectedMock(node: RowNode<Transaction>) {
  vi.mocked(node.setSelected).mockClear();
}

interface NativeSelectionState {
  selectAll: boolean;
  toggledNodes: string[];
}

interface GridApiFixture {
  api: GridApi<Transaction>;
  getNativeSelectionState: () => NativeSelectionState;
  setNativeSelectionState: (state: NativeSelectionState) => void;
  setRows: (rows: Array<RowNode<Transaction> | undefined>) => void;
}

function createGridApiFixture(
  initialRows: Array<RowNode<Transaction> | undefined>,
): GridApiFixture {
  let rows = initialRows;
  let nativeSelectionState: NativeSelectionState = {
    selectAll: false,
    toggledNodes: [],
  };

  const api = {
    getServerSideSelectionState: vi.fn(() => nativeSelectionState),
    setServerSideSelectionState: vi.fn((nextState: NativeSelectionState) => {
      nativeSelectionState = {
        selectAll: nextState.selectAll,
        toggledNodes: [...nextState.toggledNodes],
      };
    }),
    paginationGetPageSize: vi.fn(() => 2),
    paginationGetCurrentPage: vi.fn(() => 0),
    paginationGetRowCount: vi.fn(() => rows.length),
    getDisplayedRowAtIndex: vi.fn((index: number) => rows[index]),
    forEachNode: vi.fn((callback: (node: RowNode<Transaction>) => void) => {
      rows.forEach((node) => {
        if (node) callback(node);
      });
    }),
    setNodesSelected: vi.fn(
      ({
        nodes,
        newValue,
      }: {
        nodes: RowNode<Transaction>[];
        newValue: boolean;
      }) => {
        const selectedIds = new Set(
          nativeSelectionState.selectAll
            ? []
            : nativeSelectionState.toggledNodes,
        );

        nodes.forEach((node) => {
          node.setSelected(newValue, false, 'api');
          if (!node.data) return;
          if (newValue) selectedIds.add(node.data.id);
          else selectedIds.delete(node.data.id);
        });

        nativeSelectionState = {
          selectAll: false,
          toggledNodes: [...selectedIds],
        };
      },
    ),
    retryServerSideLoads: vi.fn(),
  } as unknown as GridApi<Transaction>;

  return {
    api,
    getNativeSelectionState() {
      return {
        selectAll: nativeSelectionState.selectAll,
        toggledNodes: [...nativeSelectionState.toggledNodes],
      };
    },
    setNativeSelectionState(nextState) {
      nativeSelectionState = {
        selectAll: nextState.selectAll,
        toggledNodes: [...nextState.toggledNodes],
      };
    },
    setRows(nextRows) {
      rows = nextRows;
    },
  };
}

function ready(api: GridApi<Transaction>) {
  act(() => {
    getGridProps().onGridReady?.({
      api,
    } as unknown as GridReadyEvent<Transaction>);
  });
}

function rowSelectedEvent(
  node: RowNode<Transaction>,
  source: RowSelectedEvent<Transaction>['source'],
): RowSelectedEvent<Transaction> {
  return {
    source,
    data: node.data,
    node,
  } as unknown as RowSelectedEvent<Transaction>;
}

function selectionChangedEvent(
  serverSideState: unknown,
): SelectionChangedEvent<Transaction> {
  return { serverSideState } as unknown as SelectionChangedEvent<Transaction>;
}

beforeEach(() => {
  gridCapture.props = undefined;
});

describe('TransactionsSsrmGrid selection', () => {
  it('keeps the native SSRM header explicitly configured as All Records', () => {
    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);

    expect(getGridProps().rowSelection).toMatchObject({
      mode: 'multiRow',
      headerCheckbox: true,
      selectAll: 'all',
      groupSelects: 'self',
    });
  });

  it('adds current-page rows to ordinary native explicit selection', () => {
    const rowA = createRowNode('txn-a', 0);
    const rowB = createRowNode('txn-b', 1);
    const rowC = createRowNode('txn-c', 2);
    const fixture = createGridApiFixture([rowA.node, rowB.node, rowC.node]);

    fixture.setNativeSelectionState({
      selectAll: false,
      toggledNodes: ['txn-existing'],
    });

    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);
    ready(fixture.api);

    fireEvent.click(
      screen.getByRole('button', { name: 'Select current page' }),
    );

    expect(fixture.getNativeSelectionState()).toEqual({
      selectAll: false,
      toggledNodes: ['txn-existing', 'txn-a', 'txn-b'],
    });
  });

  it('switches native All Records to explicit current-page selection', () => {
    const rowA = createRowNode('txn-a', 0);
    const rowB = createRowNode('txn-b', 1);
    const rowC = createRowNode('txn-c', 2);
    const fixture = createGridApiFixture([rowA.node, rowB.node, rowC.node]);

    fixture.setNativeSelectionState({
      selectAll: true,
      toggledNodes: ['txn-excluded-before-switch'],
    });

    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);
    ready(fixture.api);

    fireEvent.click(
      screen.getByRole('button', { name: 'Select current page' }),
    );

    expect(fixture.getNativeSelectionState()).toEqual({
      selectAll: false,
      toggledNodes: ['txn-a', 'txn-b'],
    });
  });

  it('does not silently select only part of a page while SSRM rows are unresolved', () => {
    const rowA = createRowNode('txn-a', 0);
    const fixture = createGridApiFixture([rowA.node, undefined]);

    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);
    ready(fixture.api);

    fireEvent.click(
      screen.getByRole('button', { name: 'Select current page' }),
    );

    expect(
      screen.getByText(/current page is still loading/i),
    ).toBeInTheDocument();
    expect(fixture.api.setNodesSelected).not.toHaveBeenCalled();
  });

  it('selects loaded rows when entering Select All Filtered', () => {
    const rowA = createRowNode('txn-a', 0);
    const rowB = createRowNode('txn-b', 1);
    const fixture = createGridApiFixture([rowA.node, rowB.node]);

    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);
    ready(fixture.api);

    fireEvent.click(
      screen.getByRole('button', { name: 'Select all filtered' }),
    );

    expect(rowA.node.setSelected).toHaveBeenCalledWith(true, false, 'api');
    expect(rowB.node.setSelected).toHaveBeenCalledWith(true, false, 'api');
    expect(fixture.getNativeSelectionState()).toEqual({
      selectAll: false,
      toggledNodes: [],
    });
  });

  it('re-running Select All Filtered clears earlier row exclusions', () => {
    const rowA = createRowNode('txn-a', 0);
    const rowB = createRowNode('txn-b', 1);
    const fixture = createGridApiFixture([rowA.node, rowB.node]);

    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);
    ready(fixture.api);

    fireEvent.click(
      screen.getByRole('button', { name: 'Select all filtered' }),
    );

    rowA.setUserSelected(false);
    act(() => {
      getGridProps().onRowSelected?.(
        rowSelectedEvent(rowA.node, 'checkboxSelected'),
      );
    });

    clearSetSelectedMock(rowA.node);

    fireEvent.click(
      screen.getByRole('button', { name: 'Select all filtered' }),
    );

    expect(rowA.node.setSelected).toHaveBeenCalledWith(true, false, 'api');
  });

  it('restores newly loaded rows while Select All Filtered is active', () => {
    const rowA = createRowNode('txn-a', 0);
    const rowB = createRowNode('txn-b', 1);
    const fixture = createGridApiFixture([rowA.node]);

    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);
    ready(fixture.api);
    fireEvent.click(
      screen.getByRole('button', { name: 'Select all filtered' }),
    );

    clearSetSelectedMock(rowB.node);
    fixture.setRows([rowA.node, rowB.node]);

    act(() => {
      getGridProps().onModelUpdated?.();
    });

    expect(rowB.node.setSelected).toHaveBeenCalledWith(true, false, 'api');
  });

  it('filter change clears custom filtered Select All but preserves native All Records', () => {
    const rowA = createRowNode('txn-a', 0);
    const rowB = createRowNode('txn-b', 1);
    const fixture = createGridApiFixture([rowA.node]);

    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);
    ready(fixture.api);
    fireEvent.click(
      screen.getByRole('button', { name: 'Select all filtered' }),
    );

    act(() => {
      getGridProps().onFilterChanged?.();
    });

    clearSetSelectedMock(rowB.node);
    fixture.setRows([rowA.node, rowB.node]);
    act(() => {
      getGridProps().onModelUpdated?.();
    });
    expect(rowB.node.setSelected).not.toHaveBeenCalled();

    fixture.setNativeSelectionState({
      selectAll: true,
      toggledNodes: ['txn-a'],
    });
    const setNativeState = vi.mocked(
      fixture.api.setServerSideSelectionState,
    );
    setNativeState.mockClear();

    act(() => {
      getGridProps().onFilterChanged?.();
    });

    expect(setNativeState).not.toHaveBeenCalled();
    expect(fixture.getNativeSelectionState()).toEqual({
      selectAll: true,
      toggledNodes: ['txn-a'],
    });
  });

  it('Clear Selection removes native and custom selection semantics', () => {
    const rowA = createRowNode('txn-a', 0);
    const rowB = createRowNode('txn-b', 1);
    const fixture = createGridApiFixture([rowA.node]);

    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);
    ready(fixture.api);
    fireEvent.click(
      screen.getByRole('button', { name: 'Select all filtered' }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Clear selection' }),
    );

    expect(fixture.getNativeSelectionState()).toEqual({
      selectAll: false,
      toggledNodes: [],
    });

    clearSetSelectedMock(rowB.node);
    fixture.setRows([rowA.node, rowB.node]);
    act(() => {
      getGridProps().onModelUpdated?.();
    });
    expect(rowB.node.setSelected).not.toHaveBeenCalled();
  });

  it('lets the native header switch custom filtered selection back to native All Records', () => {
    const rowA = createRowNode('txn-a', 0);
    const rowB = createRowNode('txn-b', 1);
    const fixture = createGridApiFixture([rowA.node]);

    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);
    ready(fixture.api);
    fireEvent.click(
      screen.getByRole('button', { name: 'Select all filtered' }),
    );

    fixture.setNativeSelectionState({
      selectAll: true,
      toggledNodes: [],
    });
    act(() => {
      getGridProps().onSelectionChanged?.(
        selectionChangedEvent({
          selectAll: true,
          toggledNodes: [],
        }),
      );
    });

    clearSetSelectedMock(rowB.node);
    fixture.setRows([rowA.node, rowB.node]);
    act(() => {
      getGridProps().onModelUpdated?.();
    });

    expect(rowB.node.setSelected).not.toHaveBeenCalled();
    expect(fixture.getNativeSelectionState()).toEqual({
      selectAll: true,
      toggledNodes: [],
    });
  });

  it('does not render temporary preview controls in the production-shaped SSRM root', () => {
    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);

    expect(
      screen.queryByRole('button', { name: /preview/i }),
    ).not.toBeInTheDocument();
  });
});
