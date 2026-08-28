import { describe, expect, it, vi } from 'vitest';
import type { GridApi } from 'ag-grid-community';
import { exportSelectedRowsCsv } from './exportSelectedRowsCsv';

interface Row {
  id: string;
}

function createApi(selectedRows: Row[]): GridApi<Row> {
  return {
    getSelectedRows: vi.fn(() => selectedRows),
    exportDataAsCsv: vi.fn(),
  } as unknown as GridApi<Row>;
}

describe('exportSelectedRowsCsv', () => {
  it('uses native AG Grid selected export across Client-Side pagination pages', () => {
    const api = createApi([{ id: 'row-a' }, { id: 'row-b' }]);

    expect(exportSelectedRowsCsv(api, 'rows-selected.csv')).toEqual({ ok: true });
    expect(api.exportDataAsCsv).toHaveBeenCalledWith({
      fileName: 'rows-selected.csv',
      onlySelected: true,
      onlySelectedAllPages: true,
    });
  });

  it('refuses an empty selected export instead of creating a header-only file', () => {
    const api = createApi([]);

    expect(exportSelectedRowsCsv(api, 'rows-selected.csv')).toEqual({
      ok: false,
      error: 'Select at least one row before exporting selected rows.',
    });
    expect(api.exportDataAsCsv).not.toHaveBeenCalled();
  });
});
