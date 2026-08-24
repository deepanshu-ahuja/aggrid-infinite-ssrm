import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createEmptyServerSelection,
  getDatasetHeaderState,
  isServerRowSelected,
  selectionHeaderLabel,
  toServerSelectionIntent,
  updateDatasetHeaderSelection,
  updateRowSelection,
  type DatasetSelectionScope,
  type ServerSelection,
  type ServerSelectionIntent,
} from '../serverSelection';
import type { InfiniteSelectionController } from './infiniteSelection.types';

interface UseDatasetSelectionOptions {
  /**
   * Dataset represented when Select All is active.
   *
   * - `filtered`: header Select All represents rows matching the active backend filter.
   * - `all`: header Select All represents every record.
   *
   * IMPORTANT:
   * `scope` is UI/lifecycle configuration for this hook. It is deliberately NOT copied into the
   * emitted logical selection.
   *
   * Manual row selection remains `include` in either scope.
   */
  scope: DatasetSelectionScope;

  /**
   * Total number of rows in this strategy's Select-All dataset.
   *
   * Used to calculate header checked/indeterminate/disabled state without loading every row.
   */
  totalRowCount: number;

  /**
   * Publishes a JSON-safe logical selection snapshot.
   *
   * Emitted shape:
   *
   *     { mode: 'include' | 'exclude', ids: [...] }
   *
   * This callback does not perform a backend bulk action.
   *
   * A future action builder will combine the logical selection with the relevant query context:
   *
   * - include -> exact IDs;
   * - filtered exclude -> current/captured backend filters + excluded IDs;
   * - all exclude -> unfiltered dataset + excluded IDs.
   */
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
}

/**
 * Shared dataset-level selection strategy for AG Grid's Infinite Row Model.
 *
 * CORE MODEL
 * ----------
 * `include + IDs`
 *   Only these exact IDs are selected.
 *
 * `exclude + IDs`
 *   Select All is active; everything in this strategy's dataset is selected except these IDs.
 *
 * UI SCOPE VS LOGICAL SELECTION
 * -----------------------------
 * `filtered | all` controls what the HEADER Select All means and how filter changes affect an active
 * exclude selection.
 *
 * It is not copied into the logical selection snapshot.
 *
 * Therefore manual selection looks identical in either UI mode:
 *
 *     include [A, B]
 *
 * FILTER LIFECYCLE
 * ----------------
 * filtered + include
 *   preserve explicit IDs when filter changes.
 *
 * filtered + exclude
 *   clear because Select All Filtered was defined by the old filter/query.
 *
 * all + include
 *   preserve explicit IDs.
 *
 * all + exclude
 *   preserve because "all records" does not depend on the visible filter.
 *
 * Pagination, sorting, cache eviction, and block reload do not clear logical selection.
 */
export function useDatasetSelection({
  scope,
  totalRowCount,
  onSelectionChange,
}: UseDatasetSelectionOptions): InfiniteSelectionController {
  /** Starts in the neutral state: include + empty IDs = nothing selected. */
  const [selectionState, setSelectionState] = useState<ServerSelection<string>>(() =>
    createEmptyServerSelection(),
  );

  /**
   * Resolves whether one currently loaded AG Grid row should appear selected.
   *
   * This also lets newly loaded/reloaded RowNodes restore their checkbox state from logical
   * application selection.
   */
  const isRowSelected = useCallback(
    (rowId: string) => isServerRowSelected(selectionState, rowId),
    [selectionState],
  );

  /**
   * Applies one user-originated row checkbox change.
   *
   * Include:
   *   checked row   -> add ID
   *   unchecked row -> remove ID
   *
   * Exclude:
   *   unchecked row -> add exclusion
   *   checked row   -> remove exclusion
   */
  const setRowSelected = useCallback((rowId: string, selected: boolean) => {
    setSelectionState((current) => updateRowSelection(current, rowId, selected));
  }, []);

  /**
   * Dataset-level header:
   *
   * checked   -> exclude + [] -> Select All active
   * unchecked -> include + [] -> nothing selected
   */
  const setHeaderSelected = useCallback((checked: boolean) => {
    setSelectionState(updateDatasetHeaderSelection(checked));
  }, []);

  /**
   * Explicitly clears all logical selection.
   *
   * Do not call this blindly from pagination, sorting, filtering, cache eviction, or block reload.
   */
  const clearSelection = useCallback(() => {
    setSelectionState(createEmptyServerSelection());
  }, []);

  /**
   * Header state can be computed from total count + compact selection state without loading the
   * complete server dataset.
   */
  const headerState = useMemo(
    () => getDatasetHeaderState(selectionState, totalRowCount),
    [selectionState, totalRowCount],
  );

  /**
   * Publishes only logical selection (`mode + ids`).
   *
   * Notice that `scope` is NOT a dependency here because changing UI scope does not belong in the
   * serialized logical selection object.
   */
  useEffect(() => {
    onSelectionChange?.(toServerSelectionIntent(selectionState));
  }, [onSelectionChange, selectionState]);

  /**
   * Handles a FILTER change.
   *
   * Only one state must clear:
   *
   *     scope === 'filtered' AND mode === 'exclude'
   *
   * because that state means "Select All rows matching the OLD filter".
   *
   * Manual include selections survive. All-record exclude selection also survives because visible
   * filters do not define the all-record dataset.
   */
  const handleFilterChanged = useCallback(() => {
    if (scope !== 'filtered') return;

    setSelectionState((current) =>
      current.mode === 'exclude' ? createEmptyServerSelection() : current,
    );
  }, [scope]);

  return {
    headerState,
    headerLabel: selectionHeaderLabel(scope),
    isRowSelected,
    setRowSelected,
    setHeaderSelected,
    clearSelection,
    onFilterChanged: scope === 'filtered' ? handleFilterChanged : undefined,
  };
}
