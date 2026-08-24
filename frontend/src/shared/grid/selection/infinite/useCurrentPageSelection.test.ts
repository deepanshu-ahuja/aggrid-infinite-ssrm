import { useCurrentPageSelection } from '@/shared/grid/selection/infinite/useCurrentPageSelection';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * Tests the generic current-page selection strategy used by Infinite Row Model tables.
 *
 * These tests deliberately use neutral row IDs rather than domain-specific IDs because the hook is
 * shared grid infrastructure.
 */
describe('useCurrentPageSelection', () => {
  it('selects the current page and remembers explicit selections from earlier pages', () => {
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useCurrentPageSelection({ onSelectionChange }),
    );

    /**
     * Page 1 header is a shortcut for adding the currently visible IDs to ordinary include
     * selection.
     */
    act(() => result.current.setCurrentPageIds(['row-1', 'row-2']));
    act(() => result.current.selection.setHeaderSelected(true));

    expect(result.current.selection.headerState.checked).toBe(true);
    expect(result.current.selection.isRowSelected('row-1')).toBe(true);

    expect(onSelectionChange).toHaveBeenLastCalledWith({
      mode: 'include',
      ids: ['row-1', 'row-2'],
    });

    /**
     * Moving to Page 2 changes only which IDs the header acts on. Page 1 selections remain in
     * application state.
     */
    act(() => result.current.setCurrentPageIds(['row-3', 'row-4']));

    expect(result.current.selection.headerState.checked).toBe(false);
    expect(result.current.selection.isRowSelected('row-3')).toBe(false);

    /**
     * A manual selection on Page 2 accumulates with Page 1 selections.
     */
    act(() => result.current.selection.setRowSelected('row-3', true));

    expect(onSelectionChange).toHaveBeenLastCalledWith({
      mode: 'include',
      ids: ['row-1', 'row-2', 'row-3'],
    });

    /**
     * Returning to Page 1 restores the page header/row state from retained IDs.
     *
     * Notice that the emitted logical selection never needed `scope: 'page'` or
     * `scope: 'explicit'`.
     */
    act(() => result.current.setCurrentPageIds(['row-1', 'row-2']));

    expect(result.current.selection.headerState.checked).toBe(true);
    expect(result.current.selection.isRowSelected('row-2')).toBe(true);
  });

  it('unchecking a page header removes only IDs from that page', () => {
    const { result } = renderHook(() => useCurrentPageSelection());

    act(() => result.current.setCurrentPageIds(['row-1', 'row-2']));
    act(() => result.current.selection.setHeaderSelected(true));

    act(() => result.current.setCurrentPageIds(['row-3', 'row-4']));
    act(() => result.current.selection.setHeaderSelected(true));

    expect(result.current.selection.isRowSelected('row-1')).toBe(true);
    expect(result.current.selection.isRowSelected('row-3')).toBe(true);

    /**
     * Unchecking Page 2 removes only Page 2 IDs. Pagination does not invalidate Page 1 selections.
     */
    act(() => result.current.selection.setHeaderSelected(false));

    expect(result.current.selection.isRowSelected('row-1')).toBe(true);
    expect(result.current.selection.isRowSelected('row-2')).toBe(true);
    expect(result.current.selection.isRowSelected('row-3')).toBe(false);
    expect(result.current.selection.isRowSelected('row-4')).toBe(false);
  });

  it('tracks individual row selection and clears it only when explicitly requested', () => {
    const { result } = renderHook(() => useCurrentPageSelection());

    act(() => result.current.selection.setRowSelected('row-10', true));
    expect(result.current.selection.isRowSelected('row-10')).toBe(true);

    /**
     * `clearSelection()` is a deliberate reset.
     *
     * Pagination, sorting, filtering, cache eviction, and Infinite block reloads must not invoke it
     * automatically.
     */
    act(() => result.current.selection.clearSelection());

    expect(result.current.selection.isRowSelected('row-10')).toBe(false);
  });
});
