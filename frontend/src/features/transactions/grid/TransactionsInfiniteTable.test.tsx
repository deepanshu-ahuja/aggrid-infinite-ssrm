import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  FilterModel,
  GridApi,
  GridReadyEvent,
  RowNode,
  RowSelectedEvent,
} from 'ag-grid-community';
import type { InfiniteSelectionController } from '@/shared/grid/selection/infinite/infiniteSelection.types';
import { serverBackedGridDefaults } from '@/shared/grid/config/serverBackedGridDefaults';
import type { Transaction } from '../api/transactions.contracts';
import { TransactionsInfiniteTable } from './TransactionsInfiniteTable';

/**
 * Capture the props our component passes directly to AG Grid's React component.
 *
 * We intentionally mock only the React/AG Grid rendering boundary instead of mounting the complete
 * AG Grid runtime. These tests are about OUR lifecycle wiring:
 *
 * - which native AG Grid callbacks we register;
 * - how we react when those callbacks fire;
 * - how loaded RowNodes are synchronised with application selection state.
 *
 * AG Grid itself has its own test suite for the internal implementation of pagination, cache
 * eviction, RowNodes, etc. Re-testing the whole library here would make these tests slow and brittle.
 */
const gridCapture = vi.hoisted(() => ({
  props: undefined as unknown,
}));

vi.mock('ag-grid-react', () => ({
  AgGridReact: (props: unknown) => {
    gridCapture.props = props;
    return <div data-testid="mock-ag-grid" />;
  },
}));

/**
 * Only the AG Grid props/callbacks exercised by these tests are described here.
 *
 * Keeping this small avoids coupling the test to every `AgGridReactProps` option.
 */
interface CapturedGridProps {
  onGridReady?: (event: GridReadyEvent<Transaction>) => void;
  onModelUpdated?: () => void;
  onPaginationChanged?: () => void;
  onRowSelected?: (event: RowSelectedEvent<Transaction>) => void;
  onFilterChanged?: () => void;
  onSortChanged?: unknown;
}

function getGridProps(): CapturedGridProps {
  return gridCapture.props as CapturedGridProps;
}

/**
 * Builds a small selection controller with spies for the callbacks owned by our shared Infinite
 * selection strategy.
 *
 * Individual tests override only the behavior relevant to the scenario being proved.
 */
function createSelectionController(
  overrides: Partial<InfiniteSelectionController> = {},
): InfiniteSelectionController {
  return {
    headerState: {
      checked: false,
      indeterminate: false,
      disabled: false,
    },
    headerLabel: 'Select rows',
    isRowSelected: () => false,
    setRowSelected: vi.fn(),
    setHeaderSelected: vi.fn(),
    clearSelection: vi.fn(),
    ...overrides,
  };
}

/**
 * Minimal Transaction used to construct realistic AG Grid RowNode test doubles.
 */
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

/**
 * Creates the RowNode behavior our component relies on.
 *
 * `selected` deliberately represents AG Grid's current visual checkbox state. `setSelected` is a
 * spy because the important assertion is whether our synchronization asks AG Grid to change that
 * visual state and whether it marks the change as API-driven.
 */
function createRowNode(
  id: string,
  rowIndex: number,
  selected = false,
): RowNode<Transaction> {
  const data = createTransaction(id);

  return {
    data,
    rowIndex,
    isSelected: vi.fn(() => selected),
    setSelected: vi.fn(),
  } as unknown as RowNode<Transaction>;
}

/**
 * Creates the minimal RowSelectedEvent shape needed by our component.
 *
 * AG Grid's real `RowSelectedEvent` contains many runtime fields (`api`, `context`, `rowIndex`,
 * `rowPinned`, etc.) that AG Grid itself supplies. This unit test does not need those fields because
 * `TransactionsInfiniteTable` reads only:
 *
 * - `source`;
 * - `data`;
 * - `node`.
 *
 * We therefore build a deliberately partial event and cast through `unknown` at this single test
 * boundary. Keeping the cast here makes the missing AG Grid runtime fields explicit and prevents
 * individual tests from pretending they constructed a complete production event.
 */
function createRowSelectedEvent(
  node: RowNode<Transaction>,
  source: RowSelectedEvent<Transaction>['source'],
): RowSelectedEvent<Transaction> {
  return {
    source,
    data: node.data,
    node,
  } as unknown as RowSelectedEvent<Transaction>;
}

interface GridApiFixture {
  api: GridApi<Transaction>;
  setNodes: (nodes: RowNode<Transaction>[]) => void;
  setPage: (page: number) => void;
  setLastRowKnown: (known: boolean) => void;
  setDisplayedRowCount: (count: number) => void;
  setFilterModel: (filterModel: FilterModel) => void;
}

/**
 * Creates the small `GridApi` surface consumed by `TransactionsInfiniteTable`.
 *
 * Mutable setters let a test simulate AG Grid moving to another page or accepting a newly loaded
 * Infinite block without remounting the React component.
 */

/**
 * Creates the minimal GridReadyEvent shape consumed by this component.
 *
 * `onGridReady` reads only `event.api`; AG Grid supplies the rest of the full event at runtime.
 * As with `createRowSelectedEvent`, keep the partial-event cast isolated inside the test helper.
 */
function createGridReadyEvent(
  api: GridApi<Transaction>,
): GridReadyEvent<Transaction> {
  return {
    api,
  } as unknown as GridReadyEvent<Transaction>;
}

function createGridApiFixture(
  initialNodes: RowNode<Transaction>[],
): GridApiFixture {
  let nodes = initialNodes;
  let page = 0;
  let lastRowKnown = false;
  let displayedRowCount = 0;
  let filterModel: FilterModel = {};

  const api = {
    paginationGetPageSize: vi.fn(() => 2),
    paginationGetCurrentPage: vi.fn(() => page),
    forEachNode: vi.fn((callback: (node: RowNode<Transaction>) => void) => {
      nodes.forEach(callback);
    }),
    refreshHeader: vi.fn(),
    refreshInfiniteCache: vi.fn(),
    isLastRowIndexKnown: vi.fn(() => lastRowKnown),
    getDisplayedRowCount: vi.fn(() => displayedRowCount),
    getFilterModel: vi.fn(() => filterModel),
  } as unknown as GridApi<Transaction>;

  return {
    api,
    setNodes(nextNodes) {
      nodes = nextNodes;
    },
    setPage(nextPage) {
      page = nextPage;
    },
    setLastRowKnown(known) {
      lastRowKnown = known;
    },
    setDisplayedRowCount(count) {
      displayedRowCount = count;
    },
    setFilterModel(nextFilterModel) {
      filterModel = nextFilterModel;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  gridCapture.props = undefined;
  vi.restoreAllMocks();
});

describe('TransactionsInfiniteTable selection lifecycle wiring', () => {
  it('publishes current-page IDs and restores checkbox state after AG Grid loads rows', () => {
    vi.useFakeTimers();

    const rowA = createRowNode('row-a', 0);
    const rowB = createRowNode('row-b', 1);
    const rowOutsidePage = createRowNode('row-c', 2);

    const fixture = createGridApiFixture([rowA, rowB, rowOutsidePage]);
    const onCurrentPageIdsChange = vi.fn();

    const selection = createSelectionController({
      /**
       * Pretend the logical selection already contains row-b.
       *
       * AG Grid's new RowNode currently reports itself as unchecked, so the table must restore the
       * visual checkbox from application selection state.
       */
      isRowSelected: (rowId) => rowId === 'row-b',
    });

    render(
      <TransactionsInfiniteTable
        gridOptions={serverBackedGridDefaults}
        selection={selection}
        onCurrentPageIdsChange={onCurrentPageIdsChange}
      />,
    );

    act(() => {
      getGridProps().onGridReady?.(
        createGridReadyEvent(fixture.api),
      );

      /**
       * `onModelUpdated` represents AG Grid having accepted/created the rows for the current model.
       * This is the point where our component synchronizes page IDs and loaded checkboxes.
       */
      getGridProps().onModelUpdated?.();
    });

    expect(onCurrentPageIdsChange).toHaveBeenLastCalledWith([
      'row-a',
      'row-b',
    ]);

    expect(rowA.setSelected).not.toHaveBeenCalled();

    expect(rowB.setSelected).toHaveBeenCalledWith(
      true,
      false,
      'api',
    );

    /**
     * row-c is loaded in the cache but does not belong to the visible page. It can still be
     * checkbox-synchronised if needed, but it must not be reported as a current-page ID.
     */
    expect(onCurrentPageIdsChange).not.toHaveBeenCalledWith(
      expect.arrayContaining(['row-c']),
    );

    vi.clearAllTimers();
  });

  it('restores selection when a new Infinite block introduces a row that was already logically selected', () => {
    vi.useFakeTimers();

    const rowA = createRowNode('row-a', 0);
    const rowB = createRowNode('row-b', 1);

    const fixture = createGridApiFixture([rowA]);

    const selection = createSelectionController({
      /**
       * This models a dataset-level Select All or an explicit selection remembered while row-b was
       * not present in AG Grid's browser cache.
       */
      isRowSelected: (rowId) => rowId === 'row-b',
    });

    render(
      <TransactionsInfiniteTable
        gridOptions={serverBackedGridDefaults}
        selection={selection}
      />,
    );

    act(() => {
      getGridProps().onGridReady?.(
        createGridReadyEvent(fixture.api),
      );
      getGridProps().onModelUpdated?.();
    });

    expect(rowB.setSelected).not.toHaveBeenCalled();

    /**
     * Simulate AG Grid loading another block later. `row-b` now has a RowNode for the first time.
     */
    fixture.setNodes([rowA, rowB]);

    act(() => {
      getGridProps().onModelUpdated?.();
    });

    expect(rowB.setSelected).toHaveBeenCalledWith(
      true,
      false,
      'api',
    );

    vi.clearAllTimers();
  });

  it('does not feed API-driven checkbox synchronization back into application selection', () => {
    const rowA = createRowNode('row-a', 0, true);
    const setRowSelected = vi.fn();

    const selection = createSelectionController({
      setRowSelected,
    });

    render(
      <TransactionsInfiniteTable
        gridOptions={serverBackedGridDefaults}
        selection={selection}
      />,
    );

    /**
     * This represents the `rowSelected` event AG Grid emits after OUR code programmatically calls
     * `node.setSelected(..., 'api')`.
     *
     * It must be ignored; otherwise:
     *
     * application state -> AG Grid checkbox -> rowSelected -> application state
     *
     * becomes a feedback loop.
     */
    act(() => {
      getGridProps().onRowSelected?.(
        createRowSelectedEvent(rowA, 'api'),
      );
    });

    expect(setRowSelected).not.toHaveBeenCalled();

    /**
     * A real user checkbox interaction must still flow into the shared selection strategy.
     */
    act(() => {
      getGridProps().onRowSelected?.(
        createRowSelectedEvent(rowA, 'checkboxSelected'),
      );
    });

    expect(setRowSelected).toHaveBeenCalledTimes(1);
    expect(setRowSelected).toHaveBeenCalledWith('row-a', true);
  });

  it('updates current-page IDs when AG Grid pagination changes without clearing selection', () => {
    vi.useFakeTimers();

    const rowA = createRowNode('row-a', 0);
    const rowB = createRowNode('row-b', 1);
    const rowC = createRowNode('row-c', 2);
    const rowD = createRowNode('row-d', 3);

    const fixture = createGridApiFixture([rowA, rowB, rowC, rowD]);
    const onCurrentPageIdsChange = vi.fn();
    const clearSelection = vi.fn();

    const selection = createSelectionController({
      clearSelection,
    });

    render(
      <TransactionsInfiniteTable
        gridOptions={serverBackedGridDefaults}
        selection={selection}
        onCurrentPageIdsChange={onCurrentPageIdsChange}
      />,
    );

    act(() => {
      getGridProps().onGridReady?.(
        createGridReadyEvent(fixture.api),
      );
      getGridProps().onModelUpdated?.();
    });

    expect(onCurrentPageIdsChange).toHaveBeenLastCalledWith([
      'row-a',
      'row-b',
    ]);

    fixture.setPage(1);

    act(() => {
      getGridProps().onPaginationChanged?.();
    });

    expect(onCurrentPageIdsChange).toHaveBeenLastCalledWith([
      'row-c',
      'row-d',
    ]);

    /**
     * Pagination changes visibility only. The table must never interpret page navigation as an
     * instruction to clear the user's logical selection.
     */
    expect(clearSelection).not.toHaveBeenCalled();

    vi.clearAllTimers();
  });

  it('does not register a sort-change selection reset handler', () => {
    const selection = createSelectionController();

    render(
      <TransactionsInfiniteTable
        gridOptions={serverBackedGridDefaults}
        selection={selection}
      />,
    );

    /**
     * Sorting changes row order, not row identity. The absence of `onSortChanged` is intentional:
     * there is no table-level callback that can accidentally clear selection on a sort.
     */
    expect(getGridProps().onSortChanged).toBeUndefined();
  });

  it('delegates filter-change semantics to the active selection strategy', () => {
    const onFilterChanged = vi.fn();

    const selection = createSelectionController({
      onFilterChanged,
    });

    render(
      <TransactionsInfiniteTable
        gridOptions={serverBackedGridDefaults}
        selection={selection}
      />,
    );

    act(() => {
      getGridProps().onFilterChanged?.();
    });

    /**
     * The table does not decide whether selection should clear.
     *
     * `useDatasetSelection` decides based on `filtered/all` + `include/exclude`, while page/explicit
     * selection has no filter-change callback.
     */
    expect(onFilterChanged).toHaveBeenCalledTimes(1);
  });

  it('publishes AG Grid applied filter model on grid ready and after filter changes', () => {
    vi.useFakeTimers();

    const fixture = createGridApiFixture([]);
    const onFilterModelChange = vi.fn();
    const selectionFilterChanged = vi.fn();

    render(
      <TransactionsInfiniteTable
        gridOptions={serverBackedGridDefaults}
        selection={createSelectionController({
          onFilterChanged: selectionFilterChanged,
        })}
        onFilterModelChange={onFilterModelChange}
      />,
    );

    act(() => {
      getGridProps().onGridReady?.(
        createGridReadyEvent(fixture.api),
      );
    });

    /**
     * Initial applied filter state is exposed as soon as GridApi exists. This also supports future
     * persisted/initial AG Grid filter state instead of assuming the grid always starts empty.
     */
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

    /**
     * The feature receives AG Grid's CURRENT APPLIED model. It does not construct a second filter
     * representation inside the table.
     */
    expect(onFilterModelChange).toHaveBeenLastCalledWith({
      status: {
        filterType: 'text',
        type: 'equals',
        filter: 'Completed',
      },
    });

    /**
     * Publishing filter context does not replace selection lifecycle handling. The active selection
     * strategy still receives the same filter-change notification.
     */
    expect(selectionFilterChanged).toHaveBeenCalledTimes(1);

    vi.clearAllTimers();
  });

  it('publishes filtered total only after AG Grid knows the current Infinite last row', () => {
    vi.useFakeTimers();

    const fixture = createGridApiFixture([
      createRowNode('row-a', 0),
      createRowNode('row-b', 1),
    ]);
    const onFilteredTotalChange = vi.fn();

    render(
      <TransactionsInfiniteTable
        gridOptions={serverBackedGridDefaults}
        selection={createSelectionController()}
        onFilteredTotalChange={onFilteredTotalChange}
      />,
    );

    act(() => {
      getGridProps().onGridReady?.(
        createGridReadyEvent(fixture.api),
      );
      getGridProps().onModelUpdated?.();
    });

    /**
     * Before the datasource has supplied a final row count, Infinite Row Model can have an
     * estimated/temporary size. Do not publish that as the authoritative filtered total.
     */
    expect(onFilteredTotalChange).not.toHaveBeenCalled();

    fixture.setLastRowKnown(true);
    fixture.setDisplayedRowCount(125);

    act(() => {
      getGridProps().onModelUpdated?.();
    });

    expect(onFilteredTotalChange).toHaveBeenLastCalledWith(125);

    vi.clearAllTimers();
  });
});
