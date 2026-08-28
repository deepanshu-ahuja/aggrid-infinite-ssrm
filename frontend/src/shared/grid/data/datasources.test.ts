import type { IGetRowsParams, IServerSideGetRowsParams } from 'ag-grid-community';
import { describe, expect, it, vi } from 'vitest';
import { createInfiniteDatasource } from './infinite/createInfiniteDatasource';
import { createServerSideDatasource } from './server-side/createServerSideDatasource';

interface Row {
  id: string;
}

type ResolveRows = (result: {
  rows: Row[];
  totalCount: number;
  filteredCount: number;
}) => void;

describe('grid datasources', () => {
  it('adapts Infinite Row Model callbacks to the shared row loader', async () => {
    const loadRows = vi.fn().mockResolvedValue({
      rows: [{ id: 'row-1' }],
      /** Complete dataset can be larger than the currently filtered query. */
      totalCount: 500,
      filteredCount: 125,
    });
    const successCallback = vi.fn();
    const datasource = createInfiniteDatasource<Row>({ loadRows });

    datasource.getRows({
      startRow: 0,
      endRow: 50,
      sortModel: [{ colId: 'id', sort: 'asc' }],
      filterModel: {},
      successCallback,
      failCallback: vi.fn(),
    } as unknown as IGetRowsParams);

    /** Infinite pagination must describe the current query, not the unfiltered complete dataset. */
    await vi.waitFor(() => expect(successCallback).toHaveBeenCalledWith([{ id: 'row-1' }], 125));
    expect(loadRows).toHaveBeenCalledWith(
      {
        startRow: 0,
        endRow: 50,
        sortModel: [{ colId: 'id', sort: 'asc' }],
        filterModel: {},
      },
      { signal: expect.any(AbortSignal) },
    );
  });

  it('keeps the flat SSRM trial on the same loader boundary', async () => {
    const loadRows = vi.fn().mockResolvedValue({
      rows: [{ id: 'row-2' }],
      totalCount: 900,
      filteredCount: 300,
    });
    const success = vi.fn();
    const datasource = createServerSideDatasource<Row>({
      loadRows,
      defaultBlockSize: 50,
    });

    datasource.getRows({
      request: {
        startRow: 50,
        endRow: 100,
        sortModel: [],
        filterModel: {},
        rowGroupCols: [],
        valueCols: [],
        pivotCols: [],
        pivotMode: false,
        groupKeys: [],
      },
      success,
      fail: vi.fn(),
    } as unknown as IServerSideGetRowsParams<Row>);

    /** SSRM rowCount follows the filtered/query result for the same reason as Infinite. */
    await vi.waitFor(() =>
      expect(success).toHaveBeenCalledWith({
        rowData: [{ id: 'row-2' }],
        rowCount: 300,
      }),
    );
    expect(loadRows).toHaveBeenCalledWith(
      { startRow: 50, endRow: 100, sortModel: [], filterModel: {} },
      { signal: expect.any(AbortSignal) },
    );
  });

  async function expectInfiniteLatestRequestWins(firstStartRow: number, secondStartRow: number) {
    let resolveFirst: ResolveRows | undefined;
    let resolveSecond: ResolveRows | undefined;

    const loadRows = vi.fn((request) =>
      new Promise<{
        rows: Row[];
        totalCount: number;
        filteredCount: number;
      }>((resolve) => {
        if (request.startRow === firstStartRow) resolveFirst = resolve;
        else resolveSecond = resolve;
      }),
    );
    const onLoadSuccess = vi.fn();
    const datasource = createInfiniteDatasource<Row>({ loadRows, onLoadSuccess });

    const makeParams = (startRow: number) =>
      ({
        startRow,
        endRow: startRow + 50,
        sortModel: [],
        filterModel: { status: { filterType: 'text', type: 'equals', filter: 'Pending' } },
        successCallback: vi.fn(),
        failCallback: vi.fn(),
      }) as unknown as IGetRowsParams;

    // Request B starts after request A, so B owns renderable count metadata regardless of whether B is
    // a numerically higher or lower page/range. Resolving A after B must never make A current again.
    datasource.getRows(makeParams(firstStartRow));
    datasource.getRows(makeParams(secondStartRow));

    resolveSecond?.({ rows: [{ id: 'current' }], totalCount: 750, filteredCount: 120 });
    await vi.waitFor(() =>
      expect(onLoadSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ filteredCount: 120 }),
        expect.objectContaining({ startRow: secondStartRow }),
        { isLatestRequest: true },
      ),
    );

    resolveFirst?.({ rows: [{ id: 'old' }], totalCount: 700, filteredCount: 90 });
    await vi.waitFor(() => expect(onLoadSuccess).toHaveBeenCalledTimes(2));
    expect(onLoadSuccess).toHaveBeenLastCalledWith(
      expect.objectContaining({ filteredCount: 90 }),
      expect.objectContaining({ startRow: firstStartRow }),
      { isLatestRequest: false },
    );
  }

  async function expectSsrmLatestRequestWins(firstStartRow: number, secondStartRow: number) {
    let resolveFirst: ResolveRows | undefined;
    let resolveSecond: ResolveRows | undefined;

    const loadRows = vi.fn((request) =>
      new Promise<{
        rows: Row[];
        totalCount: number;
        filteredCount: number;
      }>((resolve) => {
        if (request.startRow === firstStartRow) resolveFirst = resolve;
        else resolveSecond = resolve;
      }),
    );
    const onLoadSuccess = vi.fn();
    const datasource = createServerSideDatasource<Row>({ loadRows, onLoadSuccess });

    const makeParams = (startRow: number) =>
      ({
        request: {
          startRow,
          endRow: startRow + 50,
          sortModel: [],
          filterModel: { status: { filterType: 'text', type: 'equals', filter: 'Pending' } },
          rowGroupCols: [],
          valueCols: [],
          pivotCols: [],
          pivotMode: false,
          groupKeys: [],
        },
        success: vi.fn(),
        fail: vi.fn(),
      }) as unknown as IServerSideGetRowsParams<Row>;

    datasource.getRows(makeParams(firstStartRow));
    datasource.getRows(makeParams(secondStartRow));

    resolveSecond?.({ rows: [{ id: 'current' }], totalCount: 750, filteredCount: 120 });
    await vi.waitFor(() =>
      expect(onLoadSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ filteredCount: 120 }),
        expect.objectContaining({ startRow: secondStartRow }),
        { isLatestRequest: true },
      ),
    );

    resolveFirst?.({ rows: [{ id: 'old' }], totalCount: 700, filteredCount: 90 });
    await vi.waitFor(() => expect(onLoadSuccess).toHaveBeenCalledTimes(2));
    expect(onLoadSuccess).toHaveBeenLastCalledWith(
      expect.objectContaining({ filteredCount: 90 }),
      expect.objectContaining({ startRow: firstStartRow }),
      { isLatestRequest: false },
    );
  }

  it('Infinite keeps latest count metadata when paging forward', async () => {
    await expectInfiniteLatestRequestWins(0, 100);
  });

  it('Infinite keeps latest count metadata when paging backward', async () => {
    await expectInfiniteLatestRequestWins(100, 0);
  });

  it('SSRM keeps latest count metadata when paging forward', async () => {
    await expectSsrmLatestRequestWins(0, 100);
  });

  it('SSRM keeps latest count metadata when paging backward', async () => {
    await expectSsrmLatestRequestWins(100, 0);
  });

  it('marks a late response from an older SSRM filter as stale for count metadata', async () => {
    let resolveOldFilter: ResolveRows | undefined;
    let resolveNewFilter: ResolveRows | undefined;

    const loadRows = vi.fn((request) =>
      new Promise<{
        rows: Row[];
        totalCount: number;
        filteredCount: number;
      }>((resolve) => {
        const filterModel = request.filterModel as { status?: { filter?: string } };
        if (filterModel.status?.filter === 'Old') resolveOldFilter = resolve;
        else resolveNewFilter = resolve;
      }),
    );
    const onFilterChanged = vi.fn();
    const onLoadSuccess = vi.fn();
    const datasource = createServerSideDatasource<Row>({
      loadRows,
      onFilterChanged,
      onLoadSuccess,
    });

    const makeParams = (filter: string) =>
      ({
        request: {
          startRow: 0,
          endRow: 50,
          sortModel: [],
          filterModel: { status: { filterType: 'text', type: 'equals', filter } },
          rowGroupCols: [],
          valueCols: [],
          pivotCols: [],
          pivotMode: false,
          groupKeys: [],
        },
        success: vi.fn(),
        fail: vi.fn(),
      }) as unknown as IServerSideGetRowsParams<Row>;

    datasource.getRows(makeParams('Old'));
    datasource.getRows(makeParams('New'));

    // Filter A started first and Filter B started later. B is current. Even if A resolves after B, A
    // must be marked stale for UI count metadata rather than replacing B's filteredCount.
    resolveNewFilter?.({ rows: [{ id: 'new' }], totalCount: 900, filteredCount: 25 });
    await vi.waitFor(() =>
      expect(onLoadSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ filteredCount: 25 }),
        expect.any(Object),
        { isLatestRequest: true },
      ),
    );

    resolveOldFilter?.({ rows: [{ id: 'old' }], totalCount: 900, filteredCount: 400 });
    await vi.waitFor(() => expect(onLoadSuccess).toHaveBeenCalledTimes(2));

    expect(onLoadSuccess).toHaveBeenLastCalledWith(
      expect.objectContaining({ filteredCount: 400 }),
      expect.any(Object),
      { isLatestRequest: false },
    );
    expect(onFilterChanged).toHaveBeenCalledTimes(2);
  });
});
