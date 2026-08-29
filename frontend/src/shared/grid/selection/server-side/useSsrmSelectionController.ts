// GRIDCAP-ROWMODEL-SSRM | GRIDCAP-SEL-MANUAL | GRIDCAP-SEL-PAGE | GRIDCAP-SEL-FILTERED | GRIDCAP-SEL-ALL | GRIDCAP-SEL-TARGET | GRIDCAP-ACTION-SELECTED | GRIDCAP-ROW-ELIGIBILITY
import { useCallback, useState } from 'react';
import type { RefObject } from 'react';
import type { GridApi, RowSelectedEvent, SelectionChangedEvent } from 'ag-grid-community';
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
  removeIdsFromExplicitServerSideSelectionState,
  serverSideSelectionToIntent,
} from '../serverSideSelection';

interface UseSsrmSelectionControllerOptions<TData> {
  /**
   * Root-owned SSRM GridApi.
   *
   * The concrete grid owns AG Grid. This hook consumes the native API through a ref because event
   * handlers/actions need the latest grid instance without creating another React-rendered API copy.
   */
  gridApi: RefObject<GridApi<TData> | null>;

  /** Stable backend identity used for loaded-row reconciliation and user exception tracking. */
  getRowId: (row: TData) => string;
}

/**
 * Flat SSRM selection capability.
 *
 * NATIVE VS CUSTOM OWNERSHIP
 * --------------------------
 * SSRM already knows how to represent these across unloaded rows:
 * - ordinary explicit selected IDs;
 * - Select All Records.
 *
 * We therefore read/write AG Grid's native server-side selection state for those cases.
 *
 * The application owns only the missing product semantic "Select All Filtered". That mode needs a
 * compact logical exclude set plus current filters because many matching rows may never be loaded.
 *
 * This split is deliberate. Do NOT move every SSRM selection mode into React just to make it look like
 * Infinite Row Model; the two row models have different native capabilities.
 */
export function useSsrmSelectionController<TData>({
  gridApi,
  getRowId,
}: UseSsrmSelectionControllerOptions<TData>) {
  /** Selection-operation error only; row-loading errors belong to the datasource capability. */
  const [error, setError] = useState<string>();

  /**
   * Defined ONLY while custom Select All Filtered owns the semantic.
   *
   * `undefined` -> native SSRM selection is authoritative.
   * `exclude + empty Set` -> every eligible row in the current filtered universe is logically selected.
   */
  const [filteredSelection, setFilteredSelection] = useState<ServerSelection<string>>();

  const createFilteredSelectAllState = useCallback(
    (): ServerSelection<string> => ({
      // Exclude mode is compact: an empty exception set means "all in this filtered universe" without
      // asking the browser to load/enumerate every matching row ID.
      mode: 'exclude',
      ids: new Set<string>(),
    }),
    [],
  );

  /**
   * Read the current logical selection at action time.
   *
   * Feature code receives only `{ mode, ids }`. If filtered mode is active, the feature separately
   * translates AG Grid's current filter model into its backend filter contract.
   */
  const readSelectionIntent = useCallback((): ServerSelectionIntent<string> => {
    if (filteredSelection) {
      return toServerSelectionIntent(filteredSelection);
    }

    // No custom filtered state means AG Grid is authoritative. Read its SSRM selection model instead
    // of calling `getSelectedRows()`, which only knows loaded row objects and cannot represent native
    // Select All Records across unloaded rows.
    const nativeState = readFlatServerSideSelectionState(
      gridApi.current?.getServerSideSelectionState(),
    );

    return serverSideSelectionToIntent(nativeState);
  }, [filteredSelection, gridApi]);

  /**
   * Reconcile custom Select All Filtered onto SSRM RowNodes that are CURRENTLY loaded.
   *
   * Logical selection can describe unloaded rows; this method exists only to make loaded checkboxes
   * visually/native-state consistent. It never asks SSRM to fetch missing rows.
   */
  const syncLoadedFilteredSelection = useCallback(
    (selection: ServerSelection<string>, api = gridApi.current) => {
      if (!api) return;

      api.forEachNode((node) => {
        if (!node.data) {
          // SSRM may expose loading/stub RowNodes. No data means no stable backend ID to reconcile.
          return;
        }

        if (!node.selectable) {
          // A row can become restricted after an authoritative refresh while its SSRM RowNode/native
          // selected bit survives. In custom filtered mode the native state is only our loaded-row
          // projection, so remove that stale visual/native selection without adding a logical user
          // exception to `filteredSelection`.
          if (node.isSelected() === true) {
            node.setSelected(false, false, 'api');
          }
          return;
        }

        const shouldBeSelected = isServerRowSelected(selection, getRowId(node.data));

        if (node.isSelected() !== shouldBeSelected) {
          // Source `api` is important: `onRowSelected` below ignores our own reconciliation writes so
          // they do not get mistaken for user checkbox changes and alter the exception set again.
          node.setSelected(shouldBeSelected, false, 'api');
        }
      });
    },
    [getRowId, gridApi],
  );

  /**
   * Native flat SSRM explicit selection stores selected IDs in `toggledNodes`.
   *
   * AG Grid correctly re-evaluates `isRowSelectable` when refreshed data arrives, but a previously
   * selected SSRM ID can remain in native selection rules after that row becomes non-selectable. That
   * produces an impossible UI state: disabled checkbox still checked and selected count still nonzero.
   * Remove only those loaded ineligible IDs from EXPLICIT native selection. Native All Records is not
   * rewritten here because its `toggledNodes` mean user deselection exceptions, not selected IDs.
   */
  const pruneLoadedIneligibleNativeExplicitSelection = useCallback(
    (api = gridApi.current) => {
      if (!api) return;

      const nativeState = readFlatServerSideSelectionState(api.getServerSideSelectionState());
      if (nativeState.selectAll || nativeState.toggledNodes.length === 0) return;

      const loadedIneligibleIds: string[] = [];
      api.forEachNode((node) => {
        if (node.data && !node.selectable) {
          loadedIneligibleIds.push(getRowId(node.data));
        }
      });

      const nextState = removeIdsFromExplicitServerSideSelectionState(
        nativeState,
        loadedIneligibleIds,
      );

      if (nextState !== nativeState) {
        api.setServerSideSelectionState(nextState);
      }
    },
    [getRowId, gridApi],
  );

  /**
   * SSRM calls the grid's model-updated handler when server rows are loaded/replaced/refreshed.
   * Newly materialised eligible rows must inherit custom filtered selection, while native explicit
   * selection must drop loaded IDs whose latest authoritative policy made them non-selectable.
   */
  const onModelUpdated = useCallback(() => {
    if (filteredSelection) {
      syncLoadedFilteredSelection(filteredSelection);
      return;
    }

    pruneLoadedIneligibleNativeExplicitSelection();
  }, [
    filteredSelection,
    pruneLoadedIneligibleNativeExplicitSelection,
    syncLoadedFilteredSelection,
  ]);

  const onRowSelected = useCallback(
    (event: RowSelectedEvent<TData>) => {
      if (event.source === 'api') {
        // Our sync function already knows the intended logical state. Feeding its native RowNode write
        // back into the exception reducer would create a loop / incorrect exception IDs.
        return;
      }

      if (!event.data) return;

      if (!event.node.selectable) {
        // Defence in depth. Native AG Grid selectability should prevent user selection, but even a
        // surprising event must never place a disabled row in include/exclude bookkeeping.
        return;
      }

      setFilteredSelection((current) => {
        if (!current) {
          // Native SSRM mode is active, so AG Grid already owns this user selection event.
          return current;
        }

        // In filtered-wide mode, checking/unchecking a loaded eligible row modifies only the compact
        // user exception set. Unloaded rows remain represented logically.
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
   * Hand ownership back to native SSRM when the user chooses native All Records from the header.
   */
  const onSelectionChanged = useCallback(
    (event: SelectionChangedEvent<TData>) => {
      if (!filteredSelection) return;

      try {
        // AG Grid includes server-side selection state on this event when available. Fall back to the
        // API read because event payload availability can vary with lifecycle/event source.
        const nativeState = readFlatServerSideSelectionState(
          event.serverSideState ?? gridApi.current?.getServerSideSelectionState(),
        );

        if (nativeState.selectAll) {
          // There must never be two simultaneous dataset-wide meanings. Native All Records supersedes
          // our custom All Filtered state completely.
          setFilteredSelection(undefined);
          setError(undefined);
        }
      } catch {
        // This controller intentionally supports FLAT SSRM with `groupSelects: 'self'`. A grouped/tree
        // server-side selection state has a different shape and must not be silently interpreted here.
      }
    },
    [filteredSelection, gridApi],
  );

  /**
   * Select the concrete rows on the CURRENT pagination page.
   *
   * SSRM has native All Records but no native "current pagination page" mode, so this is one of the
   * small missing mechanics we implement ourselves using native RowNodes.
   */
  // GRIDCAP-SEL-PAGE | GRIDCAP-PAGINATION | GRIDCAP-ROW-ELIGIBILITY
  const selectCurrentPage = useCallback(() => {
    const api = gridApi.current;
    if (!api) return false;

    try {
      const nativeState = readFlatServerSideSelectionState(api.getServerSideSelectionState());
      const pageNodes = getCurrentPageNodes(api);

      if (!pageNodes) {
        // Never select a partially loaded page. Let the user retry after all visible rows materialise.
        setError('The current page is still loading. Select it again after the rows are visible.');
        return false;
      }

      const wasFilteredSelectAll = Boolean(filteredSelection);

      // Current Page is a different selection meaning, so leave custom filtered-wide ownership first.
      setFilteredSelection(undefined);

      if (nativeState.selectAll || wasFilteredSelectAll) {
        // If a dataset-wide mode was active, clear it before adding page RowNodes. Otherwise Current
        // Page would accidentally remain "all records/filtered" plus some page selections.
        api.setServerSideSelectionState(createEmptyServerSideSelectionState());
      }

      // IMPORTANT: only pass native-selectable RowNodes into the AG Grid API. Do not include disabled
      // rows and then repair them, and do not manufacture their IDs into exclusions.
      const selectablePageNodes = pageNodes.filter((node) => node.selectable);

      if (selectablePageNodes.length > 0) {
        api.setNodesSelected({
          nodes: selectablePageNodes,
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

  /**
   * Enter custom Select All Filtered.
   */
  // GRIDCAP-SEL-FILTERED
  const selectAllFiltered = useCallback(() => {
    const api = gridApi.current;
    if (!api) return false;

    const nextSelection = createFilteredSelectAllState();

    // First clear any previous custom state and native SSRM state. There must be one authoritative
    // selection semantic before we install the new filtered-wide logical state.
    setFilteredSelection(undefined);
    api.setServerSideSelectionState(createEmptyServerSideSelectionState());

    setFilteredSelection(nextSelection);

    // Only reconcile rows already loaded. Backend filters + eligibility will handle the full dataset
    // when a business action is executed.
    syncLoadedFilteredSelection(nextSelection, api);

    setError(undefined);
    return true;
  }, [createFilteredSelectAllState, gridApi, syncLoadedFilteredSelection]);

  /**
   * Clear only selection whose meaning came from the PREVIOUS filter.
   *
   * Example: Select All Filtered while Status=Pending means all eligible Pending rows. If the filter
   * changes to Failed, retaining that same logical state would silently redefine the user's selection.
   * Native All Records and ordinary explicit IDs do not depend on the visible filter and remain valid.
   */
  // GRIDCAP-SEL-FILTERED
  const resetFilterDependentSelection = useCallback(() => {
    if (!filteredSelection) return;

    setFilteredSelection(undefined);
    gridApi.current?.setServerSideSelectionState(createEmptyServerSideSelectionState());
    setError(undefined);
  }, [filteredSelection, gridApi]);

  /** Explicit Clear means clear both possible ownership models. */
  // GRIDCAP-ACTION-SELECTED
  const clearSelection = useCallback(() => {
    setFilteredSelection(undefined);
    gridApi.current?.setServerSideSelectionState(createEmptyServerSideSelectionState());
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
