import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDatasetSelection } from './useDatasetSelection';

/**
 * Tests shared dataset-level Infinite selection through user scenarios.
 */
describe('useDatasetSelection', () => {
  describe('manual row selection uses include semantics', () => {
    it('keeps explicit rows when a filtered grid changes its filter', () => {
      const { result } = renderHook(() =>
        useDatasetSelection({
          scope: 'filtered',
          totalRowCount: 100,
        }),
      );

      act(() => {
        result.current.setRowSelected('row-a', true);
        result.current.setRowSelected('row-b', true);
      });

      expect(result.current.isRowSelected('row-a')).toBe(true);
      expect(result.current.isRowSelected('row-b')).toBe(true);

      /**
       * No Select All is active, so these are exact IDs. Changing the visible query must not silently
       * discard them.
       */
      act(() => {
        result.current.onFilterChanged?.();
      });

      expect(result.current.isRowSelected('row-a')).toBe(true);
      expect(result.current.isRowSelected('row-b')).toBe(true);
    });

    it('emits the same include intent regardless of filtered/all UI scope', () => {
      const filteredChange = vi.fn();
      const allChange = vi.fn();

      const filtered = renderHook(() =>
        useDatasetSelection({
          scope: 'filtered',
          totalRowCount: 100,
          onSelectionChange: filteredChange,
        }),
      );

      const all = renderHook(() =>
        useDatasetSelection({
          scope: 'all',
          totalRowCount: 100,
          onSelectionChange: allChange,
        }),
      );

      act(() => {
        filtered.result.current.setRowSelected('row-a', true);
        all.result.current.setRowSelected('row-a', true);
      });

      /**
       * This is the core design rule of this refactor:
       *
       * manual selection is logical include selection; UI scope is not duplicated into the emitted
       * selection object.
       */
      expect(filteredChange).toHaveBeenLastCalledWith({
        mode: 'include',
        ids: ['row-a'],
      });

      expect(allChange).toHaveBeenLastCalledWith({
        mode: 'include',
        ids: ['row-a'],
      });
    });
  });

  describe('Select All Filtered uses exclude semantics', () => {
    it('switches to exclude and treats unchecked rows as exceptions', () => {
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
      });

      expect(result.current.headerState.checked).toBe(true);
      expect(result.current.isRowSelected('row-never-loaded-before')).toBe(true);

      act(() => {
        result.current.setRowSelected('row-a', false);
      });

      expect(result.current.headerState.checked).toBe(false);
      expect(result.current.headerState.indeterminate).toBe(true);
      expect(result.current.isRowSelected('row-a')).toBe(false);
      expect(result.current.isRowSelected('row-b')).toBe(true);

      /**
       * The logical snapshot intentionally does not say "filtered". The filtered strategy already
       * owns that UI/query meaning; a future bulk-action builder will combine it with backend filters.
       */
      expect(onSelectionChange).toHaveBeenLastCalledWith({
        mode: 'exclude',
        ids: ['row-a'],
      });
    });

    it('resets filtered exclude selection to include + [] when the defining filter changes', () => {
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
      });

      act(() => {
        result.current.setRowSelected('row-a', false);
      });

      expect(result.current.isRowSelected('row-a')).toBe(false);
      expect(result.current.isRowSelected('row-b')).toBe(true);

      /**
       * Before the filter changes:
       *
       *     exclude [row-a]
       *
       * means:
       *
       *     all rows matching the OLD filter except row-a.
       */
      expect(onSelectionChange).toHaveBeenLastCalledWith({
        mode: 'exclude',
        ids: ['row-a'],
      });

      /**
       * The exclusions belonged to the old filtered dataset.
       *
       * Changing the filter must reset to:
       *
       *     include + []
       *
       * which means "nothing is selected".
       *
       * It must NOT reset to:
       *
       *     exclude + []
       *
       * because `exclude + []` means Select All is active. Using that state would automatically
       * select the entire NEW filtered dataset even though the user did not click Select All again.
       */
      act(() => {
        result.current.onFilterChanged?.();
      });

      expect(onSelectionChange).toHaveBeenLastCalledWith({
        mode: 'include',
        ids: [],
      });

      expect(result.current.headerState.checked).toBe(false);
      expect(result.current.headerState.indeterminate).toBe(false);
      expect(result.current.isRowSelected('row-a')).toBe(false);
      expect(result.current.isRowSelected('row-b')).toBe(false);
    });
  });

  describe('Select All Records is independent of visible filters', () => {
    it('preserves all-record selection and exclusions when visible filters change', () => {
      const { result } = renderHook(() =>
        useDatasetSelection({
          scope: 'all',
          totalRowCount: 1_000,
        }),
      );

      act(() => {
        result.current.setHeaderSelected(true);
      });

      act(() => {
        result.current.setRowSelected('row-a', false);
      });

      expect(result.current.isRowSelected('row-a')).toBe(false);
      expect(result.current.isRowSelected('row-b')).toBe(true);

      /**
       * `all` deliberately exposes no filter-change reset callback because visible filters do not
       * define the selected dataset.
       */
      expect(result.current.onFilterChanged).toBeUndefined();

      expect(result.current.isRowSelected('row-a')).toBe(false);
      expect(result.current.isRowSelected('row-b')).toBe(true);
    });
  });

  describe('header checkbox state', () => {
    it('is disabled when the represented dataset has no rows', () => {
      const { result } = renderHook(() =>
        useDatasetSelection({
          scope: 'filtered',
          totalRowCount: 0,
        }),
      );

      expect(result.current.headerState).toEqual({
        checked: false,
        indeterminate: false,
        disabled: true,
      });
    });

    it('becomes indeterminate after selecting only some explicit rows', () => {
      const { result } = renderHook(() =>
        useDatasetSelection({
          scope: 'filtered',
          totalRowCount: 100,
        }),
      );

      act(() => {
        result.current.setRowSelected('row-a', true);
      });

      expect(result.current.headerState.checked).toBe(false);
      expect(result.current.headerState.indeterminate).toBe(true);
      expect(result.current.headerState.disabled).toBe(false);
    });
  });

  describe('explicit clear', () => {
    it('clears selection only when deliberately requested', () => {
      const { result } = renderHook(() =>
        useDatasetSelection({
          scope: 'all',
          totalRowCount: 100,
        }),
      );

      act(() => {
        result.current.setRowSelected('row-a', true);
        result.current.setRowSelected('row-b', true);
      });

      expect(result.current.isRowSelected('row-a')).toBe(true);
      expect(result.current.isRowSelected('row-b')).toBe(true);

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.isRowSelected('row-a')).toBe(false);
      expect(result.current.isRowSelected('row-b')).toBe(false);
    });
  });
});
