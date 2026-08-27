import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDatasetSelection } from './useDatasetSelection';

describe('useDatasetSelection filter persistence', () => {
  it('keeps explicit IDs across filter changes and lets the user add more afterwards', () => {
    const onSelectionChange = vi.fn();
    const { result } = renderHook(() =>
      useDatasetSelection({
        scope: 'filtered',
        totalRowCount: 100,
        onSelectionChange,
      }),
    );

    act(() => {
      result.current.setRowSelected('txn-from-first-filter', true);
    });

    act(() => {
      result.current.onFilterChanged?.();
    });

    act(() => {
      result.current.setRowSelected('txn-from-second-filter', true);
    });

    expect(onSelectionChange).toHaveBeenLastCalledWith({
      mode: 'include',
      ids: ['txn-from-first-filter', 'txn-from-second-filter'],
    });
  });

  it('clears filtered-wide Select All when the defining filter changes', () => {
    const onSelectionChange = vi.fn();
    const { result } = renderHook(() =>
      useDatasetSelection({
        scope: 'filtered',
        totalRowCount: 100,
        onSelectionChange,
      }),
    );

    act(() => {
      result.current.setHeaderSelected(true);
      result.current.setRowSelected('txn-excluded', false);
    });

    expect(onSelectionChange).toHaveBeenLastCalledWith({
      mode: 'exclude',
      ids: ['txn-excluded'],
    });

    act(() => {
      result.current.onFilterChanged?.();
    });

    expect(onSelectionChange).toHaveBeenLastCalledWith({
      mode: 'include',
      ids: [],
    });
  });

  it('does not expose a filter reset for All Records selection', () => {
    const { result } = renderHook(() =>
      useDatasetSelection({
        scope: 'all',
        totalRowCount: 100,
      }),
    );

    act(() => {
      result.current.setHeaderSelected(true);
      result.current.setRowSelected('txn-excluded', false);
    });

    expect(result.current.intent).toEqual({
      mode: 'exclude',
      ids: ['txn-excluded'],
    });
    expect(result.current.onFilterChanged).toBeUndefined();
  });
});
