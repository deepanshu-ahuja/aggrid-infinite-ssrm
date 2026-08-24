import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  toServerSelectionIntent,
  type ServerSelectionIntent,
} from '../serverSelection';
import type { InfiniteSelectionController } from './infiniteSelection.types';

interface UseCurrentPageSelectionOptions {
  /**
   * Optional callback for publishing a JSON-safe logical selection snapshot.
   *
   * The hook stores IDs in a Set for efficient membership checks, while consumers receive a normal
   * array.
   *
   * IMPORTANT:
   * The emitted object contains only `mode + ids`. The UI mode (`page`) is not part of the logical
   * selection.
   */
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
}

/**
 * Compares two page-ID lists without allocating/sorting new arrays.
 *
 * AG Grid can notify us repeatedly while the visible page is stabilising. Avoiding an unnecessary
 * React state update prevents redundant header/selection recalculation when the IDs are unchanged.
 */
function haveSameIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

/**
 * Shared current-page selection strategy for AG Grid's Infinite Row Model.
 *
 * WHAT `page` MEANS
 * -----------------
 * `page` describes only the HEADER checkbox:
 *
 *     check header   -> add IDs from the current visible page
 *     uncheck header -> remove IDs from the current visible page
 *
 * It does NOT restrict the overall selection to one page.
 *
 * Example:
 *
 *     Page 1 header selects A, B.
 *     User moves to Page 2 and selects C.
 *
 * Logical selection becomes:
 *
 *     include [A, B, C]
 *
 * No page/scope field is needed in that logical selection. The IDs themselves are the complete
 * meaning.
 *
 * LIFECYCLE RULES
 * ---------------
 * Pagination:
 *   preserve selected IDs; only current-page IDs change.
 *
 * Sorting:
 *   preserve selected IDs because stable row IDs represent identity, not position.
 *
 * Filtering:
 *   preserve selected IDs because this strategy is always explicit/include selection.
 *
 * Cache eviction / block reload:
 *   preserve selected IDs in React state; the table restores AG Grid checkboxes when RowNodes load.
 *
 * Explicit clear:
 *   clear all selected IDs only when `clearSelection()` is deliberately called.
 */
export function useCurrentPageSelection({
  onSelectionChange,
}: UseCurrentPageSelectionOptions = {}) {
  /**
   * Exact IDs selected by the user.
   *
   * This Set can contain IDs from pages that are no longer visible.
   */
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());

  /**
   * Stable IDs currently displayed by AG Grid on the active pagination page.
   *
   * The consuming Infinite table refreshes this after model/pagination changes.
   */
  const [currentPageIds, setCurrentPageIdsState] = useState<string[]>([]);

  /**
   * Receives AG Grid's currently visible page IDs.
   *
   * Repeated lifecycle events can report the same page several times, so avoid a React update when
   * the ordered IDs did not change.
   */
  const setCurrentPageIds = useCallback((ids: readonly string[]) => {
    setCurrentPageIdsState((current) => (haveSameIds(current, ids) ? current : [...ids]));
  }, []);

  /** Returns whether a currently loaded row should render selected. */
  const isRowSelected = useCallback((rowId: string) => selectedIds.has(rowId), [selectedIds]);

  /** Applies one user-originated row checkbox change using explicit/include semantics. */
  const setRowSelected = useCallback((rowId: string, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (selected) next.add(rowId);
      else next.delete(rowId);

      return next;
    });
  }, []);

  /**
   * Handles the current-page header checkbox.
   *
   * Only current-page IDs are changed. IDs selected on other pages remain untouched.
   */
  const setHeaderSelected = useCallback(
    (checked: boolean) => {
      setSelectedIds((current) => {
        const next = new Set(current);

        currentPageIds.forEach((rowId) => {
          if (checked) next.add(rowId);
          else next.delete(rowId);
        });

        return next;
      });
    },
    [currentPageIds],
  );

  /**
   * Deliberately clears every selected ID and forgets the current page snapshot.
   *
   * Pagination, sorting, filtering, cache eviction, and block reload must not call this
   * automatically.
   */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setCurrentPageIdsState([]);
  }, []);

  /**
   * Calculates the custom header state using only rows on the current page.
   *
   * Selections from other pages do not make this page's header checked or indeterminate.
   */
  const headerState = useMemo(() => {
    const selectedOnPage = currentPageIds.filter((rowId) => selectedIds.has(rowId)).length;

    return {
      checked: currentPageIds.length > 0 && selectedOnPage === currentPageIds.length,
      indeterminate: selectedOnPage > 0 && selectedOnPage < currentPageIds.length,
      disabled: currentPageIds.length === 0,
    };
  }, [currentPageIds, selectedIds]);

  /**
   * Publishes the logical selection in transport-friendly form.
   *
   * `page` is intentionally absent:
   *
   *     { mode: 'include', ids: ['A', 'B', 'C'] }
   *
   * is sufficient to express exact manual/current-page selection.
   */
  useEffect(() => {
    onSelectionChange?.(
      toServerSelectionIntent({
        mode: 'include',
        ids: selectedIds,
      }),
    );
  }, [onSelectionChange, selectedIds]);

  const selection: InfiniteSelectionController = {
    headerState,
    headerLabel: 'Select or clear current page',
    isRowSelected,
    setRowSelected,
    setHeaderSelected,
    clearSelection,
  };

  return { selection, setCurrentPageIds };
}
