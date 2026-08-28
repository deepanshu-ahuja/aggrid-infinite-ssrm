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

  /** Complete unfiltered count returned by normal row loading; no extra selection metadata request. */
  totalCount: number;

  /** Optional feature observer for the current compact logical selection. */
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
}

/**
 * Infinite Row Model selection capability.
 *
 * WHY INFINITE NEEDS CUSTOM DATASET SELECTION
 * -------------------------------------------
 * Infinite Row Model only has concrete RowNodes for blocks AG Grid has loaded. Therefore it cannot
 * natively keep checkbox state for every unloaded row in a huge filtered/all-record dataset.
 *
 * We split ownership instead of mirroring everything in React:
 * - `page` mode -> AG Grid native explicit selected IDs are authoritative;
 * - `filtered` / `all` -> a compact logical include/exclude state represents unloaded rows, while
 *   loaded RowNodes are synchronised only for visual/native checkbox consistency.
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
  onSelectionChange,
}: UseInfiniteSelectionControllerOptions<TData>) {
  /**
   * Only filtered-wide selection needs the final filtered result size for header checked/indeterminate
   * presentation. This is not a copy of the row data or selected IDs.
   */
  const [filteredTotal, setFilteredTotal] = useState(0);

  // Dataset-wide header/count math uses the appropriate universe size. Page mode does not use this
  // custom dataset-selection helper, so zero is intentional there; explicit include selection count
  // never depends on the supplied universe size.
  const datasetTotal = scope === 'all' ? totalCount : scope === 'filtered' ? filteredTotal : 0;

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
    // exposes its state because native AG Grid selection stays authoritative in that mode.
    scope: scope === 'all' ? 'all' : 'filtered',
    totalRowCount: datasetTotal,
    onSelectionChange: scope === 'page' ? undefined : onSelectionChange,
  });

  /**
   * Read page/manual selection from AG Grid AT ACTION TIME.
   *
   * We deliberately do not maintain a second React array of selected IDs. AG Grid already persists
   * explicit Infinite row selection in Grid State, so that native state is the source of truth.
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

  // Count from the same authoritative representation used by bulk actions. Page/manual mode is exact
  // because its include IDs come from native Grid State. Dataset-wide mode uses the backend/API row
  // universe count minus explicit user exceptions, so unloaded rows are represented without loading them.
  const selectedRowCount = getLogicalSelectedRowCount(readSelectionIntent(), datasetTotal);

  /**
   * Reconcile logical filtered/all selection onto ONLY the Infinite RowNodes currently in memory.
   *
   * This never loads missing blocks. An unloaded row is represented by the compact logical selection;
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
   * Called after Infinite model/page/cache changes.
   *
   * Newly loaded rows start from backend data/native defaults; this hook reapplies only the visual
   * checkbox state implied by the compact filtered/all selection.
   */
  const onRowsChanged = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    if (scope === 'filtered' && api.isLastRowIndexKnown()) {
      // Infinite only knows the final filtered size after the datasource tells AG Grid there is no
      // later row. Until then, `getDisplayedRowCount()` can represent an unfinished result.
      setFilteredTotal(api.getDisplayedRowCount());
    }

    syncLoadedRows();
  }, [gridApi, scope, syncLoadedRows]);

  useEffect(() => {
    if (scope === 'page') return;

    // A user checkbox/header action changes the compact dataset intent first. Reconcile loaded rows
    // immediately, then ask AG Grid to redraw the custom header checked/indeterminate presentation.
    syncLoadedRows();
    gridApi.current?.refreshHeader();
  }, [datasetIntent, gridApi, scope, syncLoadedRows]);

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
      onSelectionChange?.({
        mode: 'include',
        ids: Array.isArray(nativeSelection) ? nativeSelection : [],
      });
    },
    [onSelectionChange, scope],
  );

  /**
   * Clear only state whose meaning depended on the PREVIOUS filter.
   *
   * Example: "Select All Filtered" while Status=Pending means that exact filtered universe. If the
   * filter changes to Failed, keeping the same exclude state would silently redefine the selection.
   * All Records and explicit IDs do not have that problem.
   */
  const resetFilterDependentSelection = useCallback(() => {
    if (scope === 'filtered') {
      // Reset header-count presentation as soon as the defining filter changes; the new result size
      // will be learned from the next completed Infinite model.
      setFilteredTotal(0);
    }

    if (scope !== 'page') {
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
