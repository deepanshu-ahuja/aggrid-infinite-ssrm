// GRIDCAP-ROWMODEL-CLIENT | GRIDCAP-SEL-MANUAL | GRIDCAP-SEL-PAGE | GRIDCAP-SEL-FILTERED | GRIDCAP-SEL-ALL | GRIDCAP-COUNT-SELECTED | GRIDCAP-ACTION-SELECTED
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GridApi, IsRowSelectable, SelectionChangedEvent } from 'ag-grid-community';
import { useRef } from 'react';
import {
  useClientSideSelectionController,
  type ClientSideSelectionScope,
} from './useClientSideSelectionController';

interface Row {
  id: string;
  selectable: boolean;
}

const getRowId = (row: Row) => row.id;
const isRowSelectable: IsRowSelectable<Row> = (node) => Boolean(node.data?.selectable);

function createApi(rows: Row[] = []): GridApi<Row> {
  return {
    getSelectedRows: vi.fn(() => rows),
    deselectAll: vi.fn(),
  } as unknown as GridApi<Row>;
}

function renderController(scope: ClientSideSelectionScope, api: GridApi<Row>, onSelectionChange = vi.fn()) {
  return renderHook(() => {
    const gridApi = useRef<GridApi<Row> | null>(api);
    return useClientSideSelectionController({
      gridApi,
      scope,
      getRowId,
      isRowSelectable,
      onSelectionChange,
    });
  });
}

describe('useClientSideSelectionController', () => {
  it.each([
    ['page', 'currentPage'],
    ['filtered', 'filtered'],
    ['all', 'all'],
  ] as const)('maps %s scope to native AG Grid %s header selection', (scope, selectAll) => {
    const { result } = renderController(scope, createApi());

    expect(result.current.rowSelection).toMatchObject({
      mode: 'multiRow',
      headerCheckbox: true,
      enableClickSelection: false,
      selectAll,
    });
  });

  it('publishes exact native selected IDs and a renderable count', () => {
    const selectedRows = [
      { id: 'row-a', selectable: true },
      { id: 'row-b', selectable: true },
    ];
    const api = createApi(selectedRows);
    const onSelectionChange = vi.fn();
    const { result } = renderController('all', api, onSelectionChange);

    act(() => {
      result.current.onSelectionChanged({ api } as unknown as SelectionChangedEvent<Row>);
    });

    expect(result.current.readSelectionIntent()).toEqual({
      mode: 'include',
      ids: ['row-a', 'row-b'],
    });
    expect(result.current.selectedRowCount).toBe(2);
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      mode: 'include',
      ids: ['row-a', 'row-b'],
    });
  });

  it('clears native selection explicitly after a feature action requests it', () => {
    const selectedRows = [{ id: 'row-a', selectable: true }];
    const api = createApi(selectedRows);
    const onSelectionChange = vi.fn();
    const { result } = renderController('all', api, onSelectionChange);

    act(() => {
      result.current.onSelectionChanged({ api } as unknown as SelectionChangedEvent<Row>);
      result.current.clearSelection();
    });

    expect(api.deselectAll).toHaveBeenCalledTimes(1);
    expect(result.current.selectedRowCount).toBe(0);
    expect(onSelectionChange).toHaveBeenLastCalledWith({ mode: 'include', ids: [] });
  });

  it('clears native selection when the defining filtered universe changes', () => {
    const api = createApi([{ id: 'row-a', selectable: true }]);
    const { result } = renderController('filtered', api);

    act(() => {
      result.current.onSelectionChanged({ api } as unknown as SelectionChangedEvent<Row>);
      result.current.onFilterChanged();
    });

    expect(api.deselectAll).toHaveBeenCalledTimes(1);
    expect(result.current.selectedRowCount).toBe(0);
  });

  it.each(['page', 'all'] as const)('does not clear %s selection merely because a filter changes', (scope) => {
    const api = createApi([{ id: 'row-a', selectable: true }]);
    const { result } = renderController(scope, api);

    act(() => result.current.onFilterChanged());

    expect(api.deselectAll).not.toHaveBeenCalled();
  });
});
