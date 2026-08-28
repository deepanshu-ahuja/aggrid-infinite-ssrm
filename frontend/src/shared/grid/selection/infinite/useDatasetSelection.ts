// GRIDCAP-ROWMODEL-INFINITE | GRIDCAP-SEL-FILTERED | GRIDCAP-SEL-ALL | GRIDCAP-SEL-TARGET
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
  /** Dataset represented when the custom Infinite Select-All header is active. */
  scope: DatasetSelectionScope;

  /** Total number of rows represented by that dataset scope. */
  totalRowCount: number;

  /** Optional outward notification; the hook itself remains the source of custom logical state. */
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
}

/**
 * Shared dataset-level selection strategy for AG Grid Infinite Row Model.
 *
 * This hook exists only because Infinite cannot represent Select All across unloaded server rows.
 * It must not be used for ordinary/manual/current-page selection, which AG Grid owns natively.
 *
 * `include + ids` means exact selected IDs.
 * `exclude + ids` means Select All is active and IDs are exceptions.
 */
export function useDatasetSelection({
  scope,
  totalRowCount,
  onSelectionChange,
}: UseDatasetSelectionOptions): InfiniteSelectionController {
  const [selectionState, setSelectionState] = useState<ServerSelection<string>>(() =>
    createEmptyServerSelection(),
  );

  const intent = useMemo(() => toServerSelectionIntent(selectionState), [selectionState]);

  const isRowSelected = useCallback(
    (rowId: string) => isServerRowSelected(selectionState, rowId),
    [selectionState],
  );

  const setRowSelected = useCallback((rowId: string, selected: boolean) => {
    setSelectionState((current) => updateRowSelection(current, rowId, selected));
  }, []);

  const setHeaderSelected = useCallback((checked: boolean) => {
    setSelectionState(updateDatasetHeaderSelection(checked));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionState(createEmptyServerSelection());
  }, []);

  const headerState = useMemo(
    () => getDatasetHeaderState(selectionState, totalRowCount),
    [selectionState, totalRowCount],
  );

  useEffect(() => {
    onSelectionChange?.(intent);
  }, [intent, onSelectionChange]);

  // GRIDCAP-SEL-FILTERED
  const handleFilterChanged = useCallback(() => {
    if (scope !== 'filtered') return;

    setSelectionState((current) =>
      current.mode === 'exclude' ? createEmptyServerSelection() : current,
    );
  }, [scope]);

  return {
    intent,
    headerState,
    headerLabel: selectionHeaderLabel(scope),
    isRowSelected,
    setRowSelected,
    setHeaderSelected,
    clearSelection,
    // All Records deliberately exposes no filter-reset callback: its selection meaning is independent
    // of the visible filter. This boundary makes GRIDCAP-SEL-FILTERED discoverable without changing
    // the compact include/exclude representation used by both dataset-wide scopes.
    onFilterChanged: scope === 'filtered' ? handleFilterChanged : undefined,
  };
}
