import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GridApi, RowNode } from 'ag-grid-community';
import { InfiniteCurrentPageSelectionHeader } from './InfiniteCurrentPageSelectionHeader';

interface RowData {
  id: string;
}

function createNode(id: string, selected: boolean, selectable = true): RowNode<RowData> {
  return {
    data: { id },
    selectable,
    isSelected: vi.fn(() => selected),
  } as unknown as RowNode<RowData>;
}

function createApi(rowA: RowNode<RowData>, rowB: RowNode<RowData>) {
  const listeners = new Map<string, () => void>();
  const api = {
    paginationGetPageSize: vi.fn(() => 2),
    paginationGetCurrentPage: vi.fn(() => 0),
    paginationGetRowCount: vi.fn(() => 2),
    getDisplayedRowAtIndex: vi.fn((index: number) => (index === 0 ? rowA : rowB)),
    setNodesSelected: vi.fn(),
    addEventListener: vi.fn((event: string, listener: () => void) => {
      listeners.set(event, listener);
    }),
    removeEventListener: vi.fn(),
  } as unknown as GridApi<RowData>;

  return { api, listeners };
}

/**
 * Proves that the shared Infinite page header is only a native GridApi shortcut. It does not own
 * selected IDs, disabled IDs, or page IDs in React state.
 */
describe('InfiniteCurrentPageSelectionHeader', () => {
  it('derives visual state from selectable current-page RowNodes and selects them with native API', () => {
    const rowA = createNode('a', true);
    const rowB = createNode('b', false);
    const { api, listeners } = createApi(rowA, rowB);

    render(<InfiniteCurrentPageSelectionHeader api={api} />);

    const checkbox = screen.getByRole('checkbox', {
      name: 'Select or clear current page',
    });

    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    expect(api.setNodesSelected).toHaveBeenCalledWith({
      nodes: [rowA, rowB],
      newValue: true,
    });

    /**
     * Simulate AG Grid notifying the header after native selection changes. The component re-reads
     * GridApi rather than updating a separate selected-ID store.
     */
    vi.mocked(rowB.isSelected).mockReturnValue(true);

    act(() => {
      listeners.get('selectionChanged')?.();
    });

    expect(checkbox).toBeChecked();
  });

  it('never passes a disabled row to the programmatic Current Page selection call', () => {
    const selectableRow = createNode('selectable', false, true);
    const disabledRow = createNode('disabled', false, false);
    const { api } = createApi(selectableRow, disabledRow);

    render(<InfiniteCurrentPageSelectionHeader api={api} />);
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Select or clear current page',
      }),
    );

    expect(api.setNodesSelected).toHaveBeenCalledWith({
      nodes: [selectableRow],
      newValue: true,
    });
  });

  it('treats the page as checked when every selectable row is selected', () => {
    const selectableRow = createNode('selectable', true, true);
    const disabledRow = createNode('disabled', false, false);
    const { api } = createApi(selectableRow, disabledRow);

    render(<InfiniteCurrentPageSelectionHeader api={api} />);

    expect(
      screen.getByRole('checkbox', {
        name: 'Select or clear current page',
      }),
    ).toBeChecked();
  });
});
