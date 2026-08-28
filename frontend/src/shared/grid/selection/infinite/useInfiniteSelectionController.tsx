// GRIDCAP-ROWMODEL-INFINITE | GRIDCAP-SEL-MANUAL | GRIDCAP-SEL-PAGE | GRIDCAP-SEL-FILTERED | GRIDCAP-SEL-ALL | GRIDCAP-COUNT-SELECTED | GRIDCAP-ROW-ELIGIBILITY
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import type {
  GridApi,
  RowSelectedEvent,
  SelectionChangedEvent,
  SelectionColumnDef,
} from 'ag-grid-community';
import { InfiniteCurrentPageSelectionHeader } from './InfiniteCurrentPageSelectionHeader';
import { useDatasetSelection } from './useDatasetSelection';
import { SelectionHeaderCheckbox } from '../SelectionHeaderCheckbox';
import { getLogicalSelectedRowCount } from '../selectionCount';
import type { InfiniteSelectionMode, ServerSelectionIntent } from '../serverSelection';

interface UseInfiniteSelectionControllerOptions<TData> {
  /** Root-owned GridApi; this hook consumes native AG Grid state but never replaces the API owner. */
  gridApi: RefObject<GridApi<TData> | null>;

  /** `page`, `filtered`, or `all`: the product selection meaning chosen for this grid instance. */
  scope: InfiniteSelectionMode;

  /** Stable backend identity. Infinite RowNodes may be evicted/recreated, so row index is not enough. */
  getRowId: (row: TData) => string;

  /** Complete unfiltered count from the latest accepted normal API response. */
  totalCount: number;

  /** Current filtered count from the latest accepted normal API response. */
  filteredCount: number;

  /** Optional feature observer for the current compact logical selection. */
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
}

/**
 * Infinite Row Model selection capability.
 *
 * WHY INFINITE NEEDS CUSTOM DATASET SELECTION
 * -------------------------------------------
 * Infinite Row Model only has concrete RowNodes for rows AG Grid has loaded. Therefore it cannot
 * natively keep checkbox state for every unloaded row in a huge filtered/all-record dataset.
 *
 * We split ownership instead of mirroring everything in React:
 * - `page` mode -> AG Grid native explicit selected IDs are authoritative;
 * - `filtered` / `all` -> a compact logical include/exclude state represents unloaded rows, while
 *   loaded RowNodes are synchronised only for visual/native checkbox consistency.
 *
 * Count ownership is intentionally separate from selection-state ownership. The normal backend query
 * already returns `totalCount` and `filteredCount`, so dataset-wide selected totals use those API
 * counts directly. This keeps Infinite and SSRM aligned on count semantics without forcing them to use
 * the same underlying selection implementation.
 *
 * Disabled rows remain outside both worlds. The grid root supplies native `isRowSelectable`; this hook
 * reads AG Grid's resulting `RowNode.selectable` flag and never manufactures disabled IDs into the
 * logical include/exclude state.
 */
export function useInfiniteSelectionController<TData>({
  gridApi,
  scope,
  getRowId,
  totalCount,
  filteredCount,
  onSelectionChange,
}: UseInfiniteSelectionControllerOptions<TData>) {
  /**
   * Renderable count for native explicit/page selection.
   *
   * We deliberately do NOT maintain a second React array of selected IDs. AG Grid already persists
   * explicit Infinite row selection in Grid State, so native state remains authoritative for WHICH
   * IDs are selected. React stores only this derived count because the UI must rerender when selection
   * changes and render code must not read `gridApi.current` directly.
   */
  const [pageSelectedCount, setPageSelectedCount] = useState(0);

  // Dataset-wide header/count math uses the backend-provided universe size. Page mode does not use the
  // custom dataset-selection helper at all, so zero is intentional there.
  const datasetTotal = scope === 'all' ? totalCount : scope === 'filtered' ? filteredCount : 0;

  const {
    intent: datasetIntent,
    isRowSelected,
    setRowSelected,
    headerState,
    headerLabel,
    setHeaderSelected,
    onFilterChanged: resetDatasetSelectionForFilter,
  } = useDatasetSelection({
    // `useDatasetSelection` itself only needs to distinguish "all" from "filtered". Page mode never
    // exposes this custom state because native AG Grid selection stays authoritative there.
    scope: scope === 'all' ? 'all' : 'filtered',
    totalRowCount: datasetTotal,
    onSelectionChange: scope === 'page' ? undefined : onSelectionChange,
  });

  /**
   * Read page/manual selection from AG Grid AT ACTION TIME.
   *
   * Keeping the ID list native avoids duplicate ownership and prevents React state from drifting when
   * AG Grid restores/persists explicit selection through Grid State.
   */
  const readPageSelectionIntent = useCallback((): ServerSelectionIntent<string> => {
    const nativeSelection = gridApi.current?.getState().rowSelection;

    return {
      mode: 'include',
      ids: Array.isArray(nativeSelection) ? nativeSelection : [],
    };
  }, [gridApi]);

  const readSelectionIntent = useCallback(
    // Page/manual -> native Grid State. Filtered/all -> compact logical dataset state.
    () => (scope === 'page' ? readPageSelectionIntent() : datasetIntent),
    [datasetIntent, readPageSelectionIntent, scope],
  );

  // Explicit page/manual selection is already an exact ID list. Dataset-wide selection is compact:
  // include mode counts explicit IDs; exclude mode subtracts user exceptions from the API universe.
  const selectedRowCount =
    scope === 'page'
      ? pageSelectedCount
      : getLogicalSelectedRowCount(datasetIntent, datasetTotal);

  /**
   * Reconcile logical filtered/all selection onto ONLY the Infinite RowNodes currently in memory.
   *
   * This never loads missing rows. An unloaded row is represented by the compact logical selection;
   * when AG Grid later materialises that row, `onRowsChanged` calls this function again.
   */
  const syncLoadedRows = useCallback(() => {
    // Page mode has no application-owned dataset selection to reconcile.
    if (scope === 'page') return;

    gridApi.current?.forEachNode((node) => {
      if (!node.data) {
        // Infinite can expose loading/stub nodes. No data means no stable backend ID yet.
        return;
      }

      if (node.selectable === false) {
        // IMPORTANT: this is AG Grid's evaluated `rowSelection.isRowSelectable` result.
        // Never call `setSelected` for a restricted row and never add it to logical exclusions.
        return;
      }

      const shouldBeSelected = isRowSelected(getRowId(node.data));

      // Avoid unnecessary native writes/events when the RowNode already matches the logical state.
      if (node.isSelected() !== shouldBeSelected) {
        // `source='api'` lets our row-selected event handler recognise this as reconciliation rather
        // than a user checkbox action. Without that distinction we could feed our own sync back into
        // the exception state and create loops/incorrect exclusions.
        node.setSelected(shouldBeSelected, false, 'api');
      }
    });
  }, [getRowId, gridApi, isRowSelected, scope]);

  /**
   * Called after Infinite model/page/loading changes.
   *
   * Count metadata is no longer derived from `isLastRowIndexKnown()` here. The normal API loading
   * lifecycle publishes `totalCount` / `filteredCount` consistently for both server-backed row models.
   * This callback therefore only reapplies logical checkbox state to newly materialised rows.
   */
  const onRowsChanged = useCallback(() => {
    syncLoadedRows();
  }, [syncLoadedRows]);

  useEffect(() => {
    if (scope === 'page') return;

    // A user checkbox/header action changes the compact dataset intent first. Reconcile loaded rows
    // immediately, then ask AG Grid to redraw the custom header checked/indeterminate presentation.
    syncLoadedRows();
    gridApi.current?.refreshHeader();
  }, [datasetIntent, gridApi, scope, syncLoadedRows]);

  // GRIDCAP-SEL-PAGE | GRIDCAP-SEL-FILTERED | GRIDCAP-SEL-ALL
  const selectionColumnDef = useMemo<SelectionColumnDef>(() => {
    const base: SelectionColumnDef = {
      width: 52,
      minWidth: 52,
      maxWidth: 52,
      resizable: false,
      sortable: false,
    };

    if (scope === 'page') {
      // Infinite does not provide the exact "current pagination page" header behavior we need, so the
      // custom header uses native RowNodes + `setNodesSelected` and still leaves selected state in AG Grid.
      return {
        ...base,
        headerComponent: InfiniteCurrentPageSelectionHeader,
      };
    }

    // Filtered/all selection needs a logical header because unloaded rows have no checkbox RowNode.
    return {
      ...base,
      headerComponent: SelectionHeaderCheckbox,
      headerComponentParams: {
        ...headerState,
        label: headerLabel,
        onChange: (checked: boolean) => {
          // This changes only compact logical selection. The effect above then reconciles whatever
          // eligible RowNodes happen to be loaded; it does not enumerate the server dataset.
          setHeaderSelected(checked);
        },
      },
    };
  }, [headerLabel, headerState, scope, setHeaderSelected]);

  const onRowSelected = useCallback(
    (event: RowSelectedEvent<TData>) => {
      if (scope === 'page') {
        // Native Grid State owns page/manual mode; `onSelectionChanged` below publishes it.
        return;
      }

      if (event.source === 'api') {
        // Ignore our own `syncLoadedRows` writes. Only a user/native interaction should change the
        // logical exception set.
        return;
      }

      if (!event.data) return;

      if (event.node.selectable === false) {
        // Defence in depth. A restricted row should not generate a user selection event at all, but if
        // one arrives we still refuse to put its ID into the logical selection state.
        return;
      }

      setRowSelected(getRowId(event.data), event.node.isSelected() === true);
    },
    [getRowId, scope, setRowSelected],
  );

  const onSelectionChanged = useCallback(
    (event: SelectionChangedEvent<TData>) => {
      if (scope !== 'page') return;

      // Explicit page/manual selection is already encoded by AG Grid Grid State as selected IDs.
      // Publish that native snapshot; do not reconstruct it from loaded rows with `getSelectedRows()`.
      const nativeSelection = event.api.getState().rowSelection;
      const intent: ServerSelectionIntent<string> = {
        mode: 'include',
        ids: Array.isArray(nativeSelection) ? nativeSelection : [],
      };

      // Store only the renderable derivative. The ID list itself continues to live natively in AG Grid
      // and is re-read from Grid State at action time, avoiding duplicate selection ownership.
      setPageSelectedCount(intent.ids.length);
      onSelectionChange?.(intent);
    },
    [onSelectionChange, scope],
  );

  /**
   * Clear only state whose meaning depended on the PREVIOUS filter.
   *
   * Example: "Select All Filtered" while Status=Pending means that exact filtered universe. If the
   * filter changes to Failed, keeping the same exclude state would silently redefine the selection.
   * All Records and explicit IDs do not have that problem.
   *
   * The filtered numeric count is reset/published by the loading layer, not here. This hook owns
   * selection meaning; the datasource/loading hook owns API count freshness.
   */
  // GRIDCAP-SEL-FILTERED
  const resetFilterDependentSelection = useCallback(() => {
    // Be explicit at this integration boundary: only Filtered selection is filter-defined. The
    // dataset helper also refuses to expose a reset callback for All Records, but checking the scope
    // here makes the product rule obvious without requiring a reader to inspect that helper too.
    if (scope === 'filtered') {
      resetDatasetSelectionForFilter?.();
    }
  }, [resetDatasetSelectionForFilter, scope]);

  return {
    selectionColumnDef,
    readSelectionIntent,
    selectedRowCount,
    onRowsChanged,
    onRowSelected,
    onSelectionChanged,
    resetFilterDependentSelection,
  };
}
