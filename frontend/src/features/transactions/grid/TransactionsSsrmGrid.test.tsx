import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  FilterModel,
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
 * Mock only AG Grid's React rendering boundary. These tests exercise our SSRM wiring rather than
 * trying to reproduce AG Grid's internal selection engine.
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

interface GridApiFixture {
  api: GridApi<Transaction>;
  setFilterModel: (filterModel: FilterModel) => void;
  setNativeSelectionState: (state: {
    selectAll: boolean;
    toggledNodes: string[];
  }) => void;
  setRows: (rows: Array<RowNode<Transaction> | undefined>) => void;
}

function createGridApiFixture(
  initialRows: Array<RowNode<Transaction> | undefined>,
): GridApiFixture {
  let rows = initialRows;
  let filterModel: FilterModel = {};
  let nativeSelectionState = {
    selectAll: false,
    toggledNodes: [] as string[],
  };

  const api = {
    getFilterModel: vi.fn(() => filterModel),
    getServerSideSelectionState: vi.fn(() => nativeSelectionState),
    setServerSideSelectionState: vi.fn(
      (nextState: { selectAll: boolean; toggledNodes: string[] }) => {
        nativeSelectionState = {
          selectAll: nextState.selectAll,
          toggledNodes: [...nextState.toggledNodes],
        };
      },
    ),
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
    setFilterModel(nextFilterModel) {
      filterModel = nextFilterModel;
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
    getGridProps().onGridReady?.({ api } as unknown as GridReadyEvent<Transaction>);
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

function preview() {
  return JSON.parse(
    screen.getByTestId('ssrm-selection-payload-preview').textContent ?? '{}',
  ) as unknown;
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

    fireEvent.click(screen.getByRole('button', { name: 'Select current page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview selection payload' }));

    expect(preview()).toEqual({
      mode: 'include',
      ids: ['txn-existing', 'txn-a', 'txn-b'],
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

    fireEvent.click(screen.getByRole('button', { name: 'Select current page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview selection payload' }));

    expect(preview()).toEqual({
      mode: 'include',
      ids: ['txn-a', 'txn-b'],
    });
  });

  it('does not silently select only part of a page while SSRM rows are unresolved', () => {
    const rowA = createRowNode('txn-a', 0);
    const fixture = createGridApiFixture([rowA.node, undefined]);

    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);
    ready(fixture.api);

    fireEvent.click(screen.getByRole('button', { name: 'Select current page' }));

    expect(screen.getByText(/current page is still loading/i)).toBeInTheDocument();
    expect(fixture.api.setNodesSelected).not.toHaveBeenCalled();
  });

  it('represents native All Records as exclude plus exceptions', () => {
    const fixture = createGridApiFixture([]);
    fixture.setNativeSelectionState({
      selectAll: true,
      toggledNodes: ['txn-excluded'],
    });

    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);
    ready(fixture.api);

    fireEvent.click(screen.getByRole('button', { name: 'Preview selection payload' }));

    expect(preview()).toEqual({
      mode: 'exclude',
      ids: ['txn-excluded'],
      filters: [],
    });
  });

  it('represents Select All Filtered as captured filters plus exclusions', () => {
    const rowA = createRowNode('txn-a', 0);
    const rowB = createRowNode('txn-b', 1);
    const fixture = createGridApiFixture([rowA.node, rowB.node]);

    fixture.setFilterModel({
      status: {
        filterType: 'text',
        type: 'equals',
        filter: 'Completed',
      },
    });

    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);
    ready(fixture.api);

    fireEvent.click(screen.getByRole('button', { name: 'Select all filtered' }));

    expect(rowA.node.setSelected).toHaveBeenCalledWith(true, false, 'api');
    expect(rowB.node.setSelected).toHaveBeenCalledWith(true, false, 'api');

    rowA.setUserSelected(false);
    act(() => {
      getGridProps().onRowSelected?.(
        rowSelectedEvent(rowA.node, 'checkboxSelected'),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Preview selection payload' }));

    expect(preview()).toEqual({
      mode: 'exclude',
      ids: ['txn-a'],
      filters: [
        {
          field: 'status',
          operator: 'equals',
          value: 'Completed',
        },
      ],
    });
  });

  it('re-running Select All Filtered clears earlier exclusions', () => {
    const rowA = createRowNode('txn-a', 0);
    const rowB = createRowNode('txn-b', 1);
    const fixture = createGridApiFixture([rowA.node, rowB.node]);

    fixture.setFilterModel({
      status: {
        filterType: 'text',
        type: 'equals',
        filter: 'Completed',
      },
    });

    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);
    ready(fixture.api);

    fireEvent.click(screen.getByRole('button', { name: 'Select all filtered' }));

    rowA.setUserSelected(false);
    act(() => {
      getGridProps().onRowSelected?.(
        rowSelectedEvent(rowA.node, 'checkboxSelected'),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Select all filtered' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview selection payload' }));

    expect(preview()).toEqual({
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
  });

  it('restores newly loaded rows while Select All Filtered is active', () => {
    const rowA = createRowNode('txn-a', 0);
    const rowB = createRowNode('txn-b', 1);
    const fixture = createGridApiFixture([rowA.node]);

    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);
    ready(fixture.api);
    fireEvent.click(screen.getByRole('button', { name: 'Select all filtered' }));

    fixture.setRows([rowA.node, rowB.node]);
    act(() => {
      getGridProps().onModelUpdated?.();
    });

    expect(rowB.node.setSelected).toHaveBeenCalledWith(true, false, 'api');
  });

  it('clears filtered Select All on filter change but preserves native All Records', () => {
    const fixture = createGridApiFixture([]);

    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);
    ready(fixture.api);
    fireEvent.click(screen.getByRole('button', { name: 'Select all filtered' }));

    act(() => {
      getGridProps().onFilterChanged?.();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Preview selection payload' }));
    expect(preview()).toEqual({ mode: 'include', ids: [] });

    fixture.setNativeSelectionState({
      selectAll: true,
      toggledNodes: ['txn-a'],
    });

    act(() => {
      getGridProps().onFilterChanged?.();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Preview selection payload' }));
    expect(preview()).toEqual({
      mode: 'exclude',
      ids: ['txn-a'],
      filters: [],
    });
  });

  it('clears both custom and native selection through Clear Selection', () => {
    const rowA = createRowNode('txn-a', 0);
    const fixture = createGridApiFixture([rowA.node]);

    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);
    ready(fixture.api);
    fireEvent.click(screen.getByRole('button', { name: 'Select all filtered' }));

    rowA.setUserSelected(false);
    act(() => {
      getGridProps().onRowSelected?.(
        rowSelectedEvent(rowA.node, 'checkboxSelected'),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview selection payload' }));

    expect(preview()).toEqual({ mode: 'include', ids: [] });
  });

  it('lets the native header switch custom filtered selection to All Records', () => {
    const fixture = createGridApiFixture([]);

    render(<TransactionsSsrmGrid gridOptions={serverBackedGridDefaults} />);
    ready(fixture.api);
    fireEvent.click(screen.getByRole('button', { name: 'Select all filtered' }));

    fixture.setNativeSelectionState({ selectAll: true, toggledNodes: [] });
    act(() => {
      getGridProps().onSelectionChanged?.(
        selectionChangedEvent({ selectAll: true, toggledNodes: [] }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Preview selection payload' }));
    expect(preview()).toEqual({ mode: 'exclude', ids: [], filters: [] });
  });
});
