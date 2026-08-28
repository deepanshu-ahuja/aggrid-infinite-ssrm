// GRIDCAP-ROWMODEL-INFINITE | GRIDCAP-ACTION-SELECTED | GRIDCAP-SEL-ALL | GRIDCAP-SEL-PAGE
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import type { GridApi, SelectionChangedEvent } from 'ag-grid-community';
import { useInfiniteSelectionController } from './useInfiniteSelectionController';

interface Row {
  id: string;
}

const getRowId = (row: Row) => row.id;

function renderController(
  scope: 'page' | 'all',
  api: GridApi<Row>,
  onSelectionChange = vi.fn(),
) {
  return renderHook(() => {
    const gridApi = useRef<GridApi<Row> | null>(api);
    return useInfiniteSelectionController({
      gridApi,
      scope,
      getRowId,
      totalCount: 100,
      filteredCount: 25,
      onSelectionChange,
    });
  });
}

describe('useInfiniteSelectionController explicit clear', () => {
  it('clears native page/manual selection through AG Grid', () => {
    const api = {
      getState: vi.fn(() => ({ rowSelection: ['row-a', 'row-b'] })),
      deselectAll: vi.fn(),
    } as unknown as GridApi<Row>;
    const onSelectionChange = vi.fn();
    const { result } = renderController('page', api, onSelectionChange);

    act(() => {
      result.current.onSelectionChanged({ api } as unknown as SelectionChangedEvent<Row>);
    });
    expect(result.current.selectedRowCount).toBe(2);

    act(() => result.current.clearSelection());

    expect(api.deselectAll).toHaveBeenCalledTimes(1);
    expect(result.current.selectedRowCount).toBe(0);
    expect(onSelectionChange).toHaveBeenLastCalledWith({ mode: 'include', ids: [] });
  });

  it('clears application-owned dataset selection without enumerating unloaded rows', () => {
    const api = {
      forEachNode: vi.fn(),
      refreshHeader: vi.fn(),
    } as unknown as GridApi<Row>;
    const { result } = renderController('all', api);

    const headerParams = result.current.selectionColumnDef.headerComponentParams as
      | { onChange?: (checked: boolean) => void }
      | undefined;

    act(() => headerParams?.onChange?.(true));
    expect(result.current.readSelectionIntent()).toEqual({ mode: 'exclude', ids: [] });
    expect(result.current.selectedRowCount).toBe(100);

    act(() => result.current.clearSelection());

    expect(result.current.readSelectionIntent()).toEqual({ mode: 'include', ids: [] });
    expect(result.current.selectedRowCount).toBe(0);
  });
});
