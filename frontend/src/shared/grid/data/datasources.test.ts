import type { IGetRowsParams, IServerSideGetRowsParams } from 'ag-grid-community';
import { describe, expect, it, vi } from 'vitest';
import { createInfiniteDatasource } from './infinite/createInfiniteDatasource';
import { createServerSideDatasource } from './server-side/createServerSideDatasource';

interface Row {
  id: string;
}

describe('grid datasources', () => {
  it('adapts Infinite Row Model callbacks to the shared row loader', async () => {
    const loadRows = vi.fn().mockResolvedValue({
      rows: [{ id: 'row-1' }],
      totalCount: 125,
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
      totalCount: 300,
    });
    const success = vi.fn();
    const datasource = createServerSideDatasource<Row>({ loadRows, defaultBlockSize: 50 });

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

    await vi.waitFor(() =>
      expect(success).toHaveBeenCalledWith({ rowData: [{ id: 'row-2' }], rowCount: 300 }),
    );
    expect(loadRows).toHaveBeenCalledWith(
      { startRow: 50, endRow: 100, sortModel: [], filterModel: {} },
      { signal: expect.any(AbortSignal) },
    );
  });
});
