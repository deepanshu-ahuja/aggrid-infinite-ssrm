import { useCallback, useState } from 'react';
import type { RefObject } from 'react';
import type {
  GridApi,
  RowSelectedEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { getCurrentPageNodes } from '@/shared/grid/pagination/getCurrentPageNodes';
import {
  isServerRowSelected,
  toServerSelectionIntent,
  updateRowSelection,
  type ServerSelection,
  type ServerSelectionIntent,
} from '../serverSelection';
import {
  createEmptyServerSideSelectionState,
  readFlatServerSideSelectionState,
  serverSideSelectionToIntent,
} from '../serverSideSelection';

interface UseSsrmSelectionControllerOptions<TData> {
  /** Root-owned SSRM GridApi; the controller consumes but never replaces it. */
  gridApi: RefObject<GridApi<TData> | null>;

  /** Stable backend identity used for loaded-row reconciliation and exception tracking. */
  getRowId: (row: TData) => string;
}

/**
 * Complete flat-SSRM selection capability for the currently supported semantics.
 *
 * NATIVE VS CUSTOM OWNERSHIP
 * --------------------------
 * SSRM already supports ordinary explicit selection and All Records natively, so AG Grid remains the
 * source of truth for those modes. Application state exists only for Select All Filtered, which SSRM
 * cannot represent natively across unloaded rows.
 *
 * Keeping current-page switching, filtered-mode reconciliation, exception tracking, filter reset and
 * native-header handoff together prevents every SSRM table from reimplementing the same state bridge.
 */
export function useSsrmSelectionController<TData>({
  gridApi,
  getRowId,
}: UseSsrmSelectionControllerOptions<TData>) {
  /** User-facing failures for custom selection operations; datasource errors remain separate. */
  const [error, setError] = useState<string>();

  /**
   * Defined only while custom Select All Filtered owns the semantics. `undefined` means native SSRM
   * selection is authoritative again. `exclude + []` means all rows in the current filtered dataset.
   */
  const [filteredSelection, setFilteredSelection] =
    useState<ServerSelection<string>>();

  const createFilteredSelectAllState = useCallback(
    (): ServerSelection<string> => ({
      mode: 'exclude',
      ids: new Set<string>(),
    }),
    [],
  );

  /**
   * Production-capable selection reader for a future real bulk action. It returns the logical mode +
   * IDs only; a feature action can separately combine filtered mode with the current filter model.
   */
  const readSelectionIntent = useCallback((): ServerSelectionIntent<string> => {
    if (filteredSelection) {
      return toServerSelectionIntent(filteredSelection);
    }

    const nativeState = readFlatServerSideSelectionState(
      gridApi.current?.getServerSideSelectionState(),
    );
    return serverSideSelectionToIntent(nativeState);
  }, [filteredSelection, gridApi]);

  /**
   * Custom filtered selection can describe unloaded rows. Whenever rows materialise, reconcile their
   * visible checkboxes from the logical include/exclude state. API source prevents feedback loops.
   */
  const syncLoadedFilteredSelection = useCallback(
    (selection: ServerSelection<string>, api = gridApi.current) => {
      if (!api) return;

      api.forEachNode((node) => {
        if (!node.data) return;

        const shouldBeSelected = isServerRowSelected(
          selection,
          getRowId(node.data),
        );

        if (node.isSelected() !== shouldBeSelected) {
          node.setSelected(shouldBeSelected, false, 'api');
        }
      });
    },
    [getRowId, gridApi],
  );

  /**
   * Runs after SSRM changes the displayed row model. If Select All Filtered is active, newly loaded
   * rows must immediately receive the checkbox state represented by that logical selection.
   */
  const onModelUpdated = useCallback(() => {
    if (filteredSelection) {
      syncLoadedFilteredSelection(filteredSelection);
    }
  }, [filteredSelection, syncLoadedFilteredSelection]);

  /** User row toggles mutate the filtered selection exception set only while custom mode is active. */
  const onRowSelected = useCallback(
    (event: RowSelectedEvent<TData>) => {
      if (event.source === 'api' || !event.data) return;

      setFilteredSelection((current) => {
        if (!current) return current;

        return updateRowSelection(
          current,
          getRowId(event.data as TData),
          event.node.isSelected() === true,
        );
      });
    },
    [getRowId],
  );

  /**
   * Native All Records selected from AG Grid's header supersedes custom filtered mode. Native state
   * wins and the custom state is discarded so there is only one active dataset-selection semantic.
   */
  const onSelectionChanged = useCallback(
    (event: SelectionChangedEvent<TData>) => {
      if (!filteredSelection) return;

      try {
        const nativeState = readFlatServerSideSelectionState(
          event.serverSideState ??
            gridApi.current?.getServerSideSelectionState(),
        );

        if (nativeState.selectAll) {
          setFilteredSelection(undefined);
          setError(undefined);
        }
      } catch {
        /** Current controller assumes flat SSRM selection with `groupSelects: 'self'`. */
      }
    },
    [filteredSelection, gridApi],
  );

  /**
   * SSRM has no native current-page Select All mode. Resolve the visible page, leave any dataset-wide
   * native/custom mode, then add exactly those concrete RowNodes using native node selection.
   */
  const selectCurrentPage = useCallback(() => {
    const api = gridApi.current;
    if (!api) return false;

    try {
      const nativeState = readFlatServerSideSelectionState(
        api.getServerSideSelectionState(),
      );
      const pageNodes = getCurrentPageNodes(api);

      if (!pageNodes) {
        setError(
          'The current page is still loading. Select it again after the rows are visible.',
        );
        return false;
      }

      const wasFilteredSelectAll = Boolean(filteredSelection);
      setFilteredSelection(undefined);

      if (nativeState.selectAll || wasFilteredSelectAll) {
        api.setServerSideSelectionState(
          createEmptyServerSideSelectionState(),
        );
      }

      if (pageNodes.length > 0) {
        api.setNodesSelected({
          nodes: pageNodes,
          newValue: true,
        });
      }

      setError(undefined);
      return true;
    } catch (selectionError) {
      setError(
        selectionError instanceof Error
          ? selectionError.message
          : 'Current-page selection could not be applied.',
      );
      return false;
    }
  }, [filteredSelection, gridApi]);

  /** Enter custom Select All Filtered after clearing native SSRM dataset selection. */
  const selectAllFiltered = useCallback(() => {
    const api = gridApi.current;
    if (!api) return false;

    const nextSelection = createFilteredSelectAllState();

    setFilteredSelection(undefined);
    api.setServerSideSelectionState(
      createEmptyServerSideSelectionState(),
    );
    setFilteredSelection(nextSelection);
    syncLoadedFilteredSelection(nextSelection, api);
    setError(undefined);
    return true;
  }, [createFilteredSelectAllState, gridApi, syncLoadedFilteredSelection]);

  /**
   * Clear only selection whose meaning depended on the previous filter.
   *
   * Example: "Select All Filtered" while Status=Completed means all Completed rows. If the user then
   * changes the filter to Status=Failed, keeping that state would silently change its meaning to all
   * Failed rows. Native All Records and ordinary explicit selections do not depend on the filter, so
   * they are left alone.
   */
  const resetFilterDependentSelection = useCallback(() => {
    if (!filteredSelection) return;

    setFilteredSelection(undefined);
    gridApi.current?.setServerSideSelectionState(
      createEmptyServerSideSelectionState(),
    );
    setError(undefined);
  }, [filteredSelection, gridApi]);

  /** Explicit user action clears both custom filtered state and native SSRM selection. */
  const clearSelection = useCallback(() => {
    setFilteredSelection(undefined);
    gridApi.current?.setServerSideSelectionState(
      createEmptyServerSideSelectionState(),
    );
    setError(undefined);
  }, [gridApi]);

  return {
    error,
    isFilteredSelectAllActive: Boolean(filteredSelection),
    readSelectionIntent,
    onModelUpdated,
    onRowSelected,
    onSelectionChanged,
    resetFilterDependentSelection,
    selectCurrentPage,
    selectAllFiltered,
    clearSelection,
  };
}
