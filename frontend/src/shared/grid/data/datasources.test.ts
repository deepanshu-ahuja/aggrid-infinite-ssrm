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

  it('Infinite keeps count metadata from the latest request when paging backward', async () => {
    let resolveLaterPage: ResolveRows | undefined;
    let resolveEarlierPage: ResolveRows | undefined;

    const loadRows = vi.fn((request) =>
      new Promise<{
        rows: Row[];
        totalCount: number;
        filteredCount: number;
      }>((resolve) => {
        if (request.startRow === 100) resolveLaterPage = resolve;
        else resolveEarlierPage = resolve;
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

    // User is on a later page, then moves backward. Page number is irrelevant: the second request is
    // the current one and therefore owns renderable total/filtered metadata.
    datasource.getRows(makeParams(100));
    datasource.getRows(makeParams(0));

    resolveEarlierPage?.({ rows: [{ id: 'current' }], totalCount: 750, filteredCount: 120 });
    await vi.waitFor(() =>
      expect(onLoadSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ filteredCount: 120 }),
        expect.objectContaining({ startRow: 0 }),
        { isLatestRequest: true },
      ),
    );

    resolveLaterPage?.({ rows: [{ id: 'old' }], totalCount: 700, filteredCount: 90 });
    await vi.waitFor(() => expect(onLoadSuccess).toHaveBeenCalledTimes(2));
    expect(onLoadSuccess).toHaveBeenLastCalledWith(
      expect.objectContaining({ filteredCount: 90 }),
      expect.objectContaining({ startRow: 100 }),
      { isLatestRequest: false },
    );
  });

  it('SSRM keeps count metadata from the latest request when paging forward', async () => {
    let resolveEarlierPage: ResolveRows | undefined;
    let resolveLaterPage: ResolveRows | undefined;

    const loadRows = vi.fn((request) =>
      new Promise<{
        rows: Row[];
        totalCount: number;
        filteredCount: number;
      }>((resolve) => {
        if (request.startRow === 0) resolveEarlierPage = resolve;
        else resolveLaterPage = resolve;
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

    datasource.getRows(makeParams(0));
    datasource.getRows(makeParams(100));

    resolveLaterPage?.({ rows: [{ id: 'current' }], totalCount: 750, filteredCount: 120 });
    await vi.waitFor(() =>
      expect(onLoadSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ filteredCount: 120 }),
        expect.objectContaining({ startRow: 100 }),
        { isLatestRequest: true },
      ),
    );

    resolveEarlierPage?.({ rows: [{ id: 'old' }], totalCount: 700, filteredCount: 90 });
    await vi.waitFor(() => expect(onLoadSuccess).toHaveBeenCalledTimes(2));
    expect(onLoadSuccess).toHaveBeenLastCalledWith(
      expect.objectContaining({ filteredCount: 90 }),
      expect.objectContaining({ startRow: 0 }),
      { isLatestRequest: false },
    );
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
