import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  FilterModel,
  GridApi,
  GridReadyEvent,
  RowNode,
  RowSelectedEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { serverBackedGridDefaults } from '@/shared/grid/config/serverBackedGridDefaults';
import type { InfiniteSelectionController } from '@/shared/grid/selection/infinite/infiniteSelection.types';
import type { Transaction } from '../api/transactions.contracts';
import { TransactionsInfiniteTable } from './TransactionsInfiniteTable';

/**
 * These tests verify OUR native/custom boundary rather than re-testing AG Grid internals.
 *
 * Page mode must read/write native AG Grid selection.
 * Dataset mode may synchronise loaded RowNodes because Infinite cannot represent unloaded Select All.
 */
const gridCapture = vi.hoisted(() => ({ props: undefined as unknown }));

vi.mock('ag-grid-react', () => ({
  AgGridReact: (props: unknown) => {
    gridCapture.props = props;
    return <div data-testid="mock-ag-grid" />;
  },
}));

interface CapturedGridProps {
  onGridReady?: (event: GridReadyEvent<Transaction>) => void;
  onModelUpdated?: () => void;
  onPaginationChanged?: () => void;
  onRowSelected?: (event: RowSelectedEvent<Transaction>) => void;
  onSelectionChanged?: (event: SelectionChangedEvent<Transaction>) => void;
  onFilterChanged?: () => void;
  onSortChanged?: unknown;
}

function getGridProps() {
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

function createRowNode(id: string, selected = false): RowNode<Transaction> {
  return {
    data: createTransaction(id),
    isSelected: vi.fn(() => selected),
    setSelected: vi.fn(),
  } as unknown as RowNode<Transaction>;
}

function createSelectionController(
  overrides: Partial<InfiniteSelectionController> = {},
): InfiniteSelectionController {
  return {
    headerState: {
      checked: false,
      indeterminate: false,
      disabled: false,
    },
    headerLabel: 'Select dataset',
    isRowSelected: () => false,
    setRowSelected: vi.fn(),
    setHeaderSelected: vi.fn(),
    clearSelection: vi.fn(),
    ...overrides,
  };
}

interface ApiFixture {
  api: GridApi<Transaction>;
  setNodes: (nodes: RowNode<Transaction>[]) => void;
  setFilterModel: (model: FilterModel) => void;
  setRowSelectionState: (ids: string[]) => void;
  setLastRowKnown: (known: boolean) => void;
  setDisplayedRowCount: (count: number) => void;
}

function createApiFixture(initialNodes: RowNode<Transaction>[] = []): ApiFixture {
  let nodes = initialNodes;
  let filterModel: FilterModel = {};
  let rowSelection: string[] = [];
  let lastRowKnown = false;
  let displayedRowCount = 0;

  const api = {
    forEachNode: vi.fn((callback: (node: RowNode<Transaction>) => void) => {
      nodes.forEach(callback);
    }),
    getFilterModel: vi.fn(() => filterModel),
    getState: vi.fn(() => ({ rowSelection })),
    isLastRowIndexKnown: vi.fn(() => lastRowKnown),
    getDisplayedRowCount: vi.fn(() => displayedRowCount),
    refreshHeader: vi.fn(),
    refreshInfiniteCache: vi.fn(),
  } as unknown as GridApi<Transaction>;

  return {
    api,
    setNodes(nextNodes) {
      nodes = nextNodes;
    },
    setFilterModel(nextModel) {
      filterModel = nextModel;
    },
    setRowSelectionState(ids) {
      rowSelection = ids;
    },
    setLastRowKnown(known) {
      lastRowKnown = known;
    },
    setDisplayedRowCount(count) {
      displayedRowCount = count;
    },
  };
}

function gridReady(api: GridApi<Transaction>): GridReadyEvent<Transaction> {
  return { api } as unknown as GridReadyEvent<Transaction>;
}

function rowSelected(
  node: RowNode<Transaction>,
  source: RowSelectedEvent<Transaction>['source'],
): RowSelectedEvent<Transaction> {
  return {
    source,
    data: node.data,
    node,
  } as unknown as RowSelectedEvent<Transaction>;
}

function selectionChanged(
  api: GridApi<Transaction>,
): SelectionChangedEvent<Transaction> {
  return { api } as unknown as SelectionChangedEvent<Transaction>;
}

afterEach(() => {
  vi.useRealTimers();
  gridCapture.props = undefined;
  vi.restoreAllMocks();
});

describe('TransactionsInfiniteTable native-first selection boundary', () => {
  it('publishes page/manual selection from native Grid State instead of React selected IDs', () => {
    const fixture = createApiFixture();
    const onSelectionChange = vi.fn();

    fixture.setRowSelectionState(['row-a', 'row-on-old-page']);

    render(
      <TransactionsInfiniteTable
        gridOptions={serverBackedGridDefaults}
        selectionMode="page"
        onNativeSelectionChange={onSelectionChange}
      />,
    );

    act(() => {
      getGridProps().onSelectionChanged?.(selectionChanged(fixture.api));
    });

    expect(onSelectionChange).toHaveBeenCalledWith({
      mode: 'include',
      ids: ['row-a', 'row-on-old-page'],
    });
  });

  it('does not maintain application row selection for page mode', () => {
    const row = createRowNode('row-a', true);

    render(
      <TransactionsInfiniteTable
        gridOptions={serverBackedGridDefaults}
        selectionMode="page"
      />,
    );

    /** Page/manual checkbox events are intentionally left to AG Grid. */
    expect(() => {
      act(() => {
        getGridProps().onRowSelected?.(rowSelected(row, 'checkboxSelected'));
      });
    }).not.toThrow();
  });

  it('synchronises loaded RowNodes only for unsupported dataset-wide selection', () => {
    vi.useFakeTimers();

    const rowA = createRowNode('row-a');
    const rowB = createRowNode('row-b');
    const fixture = createApiFixture([rowA, rowB]);
    const selection = createSelectionController({
      isRowSelected: (id) => id === 'row-b',
    });

    render(
      <TransactionsInfiniteTable
        gridOptions={serverBackedGridDefaults}
        selectionMode="dataset"
        selection={selection}
      />,
    );

    act(() => {
      getGridProps().onGridReady?.(gridReady(fixture.api));
      getGridProps().onModelUpdated?.();
    });

    expect(rowA.setSelected).not.toHaveBeenCalled();
    expect(rowB.setSelected).toHaveBeenCalledWith(true, false, 'api');
  });

  it('updates custom dataset exceptions only from user-originated row checkbox events', () => {
    const row = createRowNode('row-a', true);
    const setRowSelected = vi.fn();
    const selection = createSelectionController({ setRowSelected });

    render(
      <TransactionsInfiniteTable
        gridOptions={serverBackedGridDefaults}
        selectionMode="dataset"
        selection={selection}
      />,
    );

    act(() => {
      getGridProps().onRowSelected?.(rowSelected(row, 'api'));
    });
    expect(setRowSelected).not.toHaveBeenCalled();

    act(() => {
      getGridProps().onRowSelected?.(rowSelected(row, 'checkboxSelected'));
    });
    expect(setRowSelected).toHaveBeenCalledWith('row-a', true);
  });

  it('reads AG Grid applied filter state rather than owning a parallel filter model', () => {
    vi.useFakeTimers();

    const fixture = createApiFixture();
    const onFilterModelChange = vi.fn();

    render(
      <TransactionsInfiniteTable
        gridOptions={serverBackedGridDefaults}
        selectionMode="page"
        onFilterModelChange={onFilterModelChange}
      />,
    );

    act(() => {
      getGridProps().onGridReady?.(gridReady(fixture.api));
    });
    expect(onFilterModelChange).toHaveBeenLastCalledWith({});

    fixture.setFilterModel({
      status: {
        filterType: 'text',
        type: 'equals',
        filter: 'Completed',
      },
    });

    act(() => {
      getGridProps().onFilterChanged?.();
    });

    expect(onFilterModelChange).toHaveBeenLastCalledWith({
      status: {
        filterType: 'text',
        type: 'equals',
        filter: 'Completed',
      },
    });
  });

  it('publishes filtered total only after the Infinite model knows the last row', () => {
    vi.useFakeTimers();

    const fixture = createApiFixture();
    const onFilteredTotalChange = vi.fn();

    render(
      <TransactionsInfiniteTable
        gridOptions={serverBackedGridDefaults}
        selectionMode="dataset"
        selection={createSelectionController()}
        onFilteredTotalChange={onFilteredTotalChange}
      />,
    );

    act(() => {
      getGridProps().onGridReady?.(gridReady(fixture.api));
      getGridProps().onModelUpdated?.();
    });
    expect(onFilteredTotalChange).not.toHaveBeenCalled();

    fixture.setLastRowKnown(true);
    fixture.setDisplayedRowCount(87);

    act(() => {
      getGridProps().onModelUpdated?.();
    });
    expect(onFilteredTotalChange).toHaveBeenLastCalledWith(87);
  });

  it('does not add a custom sort-selection reset', () => {
    render(
      <TransactionsInfiniteTable
        gridOptions={serverBackedGridDefaults}
        selectionMode="page"
      />,
    );

    expect(getGridProps().onSortChanged).toBeUndefined();
  });
});
