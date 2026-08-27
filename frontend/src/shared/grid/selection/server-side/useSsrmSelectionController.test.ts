import type { RefObject } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GridApi } from 'ag-grid-community';
import { useSsrmSelectionController } from './useSsrmSelectionController';

interface TestRow {
  id: string;
}

interface NativeSelectionState {
  selectAll: boolean;
  toggledNodes: string[];
}

function createApiFixture(initialSelection: NativeSelectionState) {
  let selection = {
    selectAll: initialSelection.selectAll,
    toggledNodes: [...initialSelection.toggledNodes],
  };

  const api = {
    getServerSideSelectionState: vi.fn(() => selection),
    setServerSideSelectionState: vi.fn((nextSelection: NativeSelectionState) => {
      selection = {
        selectAll: nextSelection.selectAll,
        toggledNodes: [...nextSelection.toggledNodes],
      };
    }),
    forEachNode: vi.fn(),
  } as unknown as GridApi<TestRow>;

  return {
    api,
    readNativeSelection: () => ({
      selectAll: selection.selectAll,
      toggledNodes: [...selection.toggledNodes],
    }),
  };
}

function renderSelectionController(initialSelection: NativeSelectionState) {
  const fixture = createApiFixture(initialSelection);
  const gridApi = { current: fixture.api } as RefObject<GridApi<TestRow> | null>;
  const hook = renderHook(() =>
    useSsrmSelectionController({
      gridApi,
      getRowId: (row) => row.id,
    }),
  );

  return { ...fixture, ...hook };
}

describe('useSsrmSelectionController filter persistence', () => {
  it('preserves explicit native IDs when the grid filter changes', () => {
    const { api, result } = renderSelectionController({
      selectAll: false,
      toggledNodes: ['txn-from-first-filter', 'txn-from-another-page'],
    });

    expect(result.current.readSelectionIntent()).toEqual({
      mode: 'include',
      ids: ['txn-from-first-filter', 'txn-from-another-page'],
    });

    act(() => {
      result.current.resetFilterDependentSelection();
    });

    expect(api.setServerSideSelectionState).not.toHaveBeenCalled();
    expect(result.current.readSelectionIntent()).toEqual({
      mode: 'include',
      ids: ['txn-from-first-filter', 'txn-from-another-page'],
    });
  });

  it('clears Select All Filtered when the defining filter changes', () => {
    const { result, readNativeSelection } = renderSelectionController({
      selectAll: false,
      toggledNodes: ['txn-explicit-before-filtered-all'],
    });

    act(() => {
      result.current.selectAllFiltered();
    });

    expect(result.current.readSelectionIntent()).toEqual({
      mode: 'exclude',
      ids: [],
    });

    act(() => {
      result.current.resetFilterDependentSelection();
    });

    expect(result.current.readSelectionIntent()).toEqual({
      mode: 'include',
      ids: [],
    });
    expect(readNativeSelection()).toEqual({
      selectAll: false,
      toggledNodes: [],
    });
  });

  it('preserves native All Records selection and its exclusions across filter changes', () => {
    const { api, result } = renderSelectionController({
      selectAll: true,
      toggledNodes: ['txn-excluded'],
    });

    expect(result.current.readSelectionIntent()).toEqual({
      mode: 'exclude',
      ids: ['txn-excluded'],
    });

    act(() => {
      result.current.resetFilterDependentSelection();
    });

    expect(api.setServerSideSelectionState).not.toHaveBeenCalled();
    expect(result.current.readSelectionIntent()).toEqual({
      mode: 'exclude',
      ids: ['txn-excluded'],
    });
  });
});
