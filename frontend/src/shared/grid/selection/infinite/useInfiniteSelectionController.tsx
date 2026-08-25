import { useCallback, useEffect, useMemo } from 'react';
import type { RefObject } from 'react';
import type {
  GridApi,
  RowSelectedEvent,
  SelectionChangedEvent,
  SelectionColumnDef,
} from 'ag-grid-community';
import { InfiniteCurrentPageSelectionHeader } from './InfiniteCurrentPageSelectionHeader';
import { useDatasetSelection } from './useDatasetSelection';
import { useInfiniteDatasetSelectionSupport } from './useInfiniteDatasetSelectionSupport';
import { SelectionHeaderCheckbox } from '../SelectionHeaderCheckbox';
import type {
  InfiniteSelectionMode,
  ServerSelectionIntent,
} from '../serverSelection';

interface UseInfiniteSelectionControllerOptions<TData> {
  /** Root-owned GridApi; the controller reads it but never owns/replaces it. */
  gridApi: RefObject<GridApi<TData> | null>;

  /** User-visible Infinite selection strategy for this grid instance. */
  scope: InfiniteSelectionMode;

  /** Stable backend row identity used to reconcile logical selection onto loaded RowNodes. */
  getRowId: (row: TData) => string;

  /** Feature-owned way to fetch the full unfiltered row count for All Records selection. */
  loadAllTotal?: (signal: AbortSignal) => Promise<number>;

  /** Publishes the current logical selection to feature consumers. */
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
}

/**
 * Complete Infinite Row Model selection capability.
 *
 * WHY THIS COMPOSITION EXISTS
 * ---------------------------
 * Infinite selection is one lifecycle, not a set of unrelated callbacks. Supporting totals,
 * application-owned filtered/all intent, loaded-node reconciliation, custom header state, page-mode
 * native selection, and filter invalidation all have to agree on the same `scope`. Keeping those
 * mechanics together prevents every Infinite table from reassembling the same fragile combination.
 *
 * WHAT REMAINS NATIVE / ROOT-OWNED
 * --------------------------------
 * The root still owns `GridApi` and `<AgGridReact>`. Page/manual row selection remains AG Grid state.
 * The controller exposes native event handlers/column definition for the root to wire explicitly.
 */
export function useInfiniteSelectionController<TData>({
  gridApi,
  scope,
  getRowId,
  loadAllTotal,
  onSelectionChange,
}: UseInfiniteSelectionControllerOptions<TData>) {
  /** Dataset-wide selection needs query totals that native Infinite selection does not provide. */
  const {
    totalRowCount,
    error: supportError,
    setFilteredTotal,
    resetFilteredTotal,
  } = useInfiniteDatasetSelectionSupport({
    scope,
    loadAllTotal,
  });

  /**
   * Application-owned include/exclude intent is active only for filtered/all scopes. In page mode,
   * native AG Grid row selection remains authoritative and this state is not published externally.
   */
  const {
    intent: datasetIntent,
    isRowSelected,
    setRowSelected,
    headerState,
    headerLabel,
    setHeaderSelected,
    onFilterChanged: onDatasetFilterChanged,
  } = useDatasetSelection({
    scope: scope === 'all' ? 'all' : 'filtered',
    totalRowCount,
    onSelectionChange: scope === 'page' ? undefined : onSelectionChange,
  });

  /** Read page/manual selection directly from native Grid State at action time. */
  const readPageSelectionIntent = useCallback((): ServerSelectionIntent<string> => {
    const nativeSelection = gridApi.current?.getState().rowSelection;

    return {
      mode: 'include',
      ids: Array.isArray(nativeSelection) ? nativeSelection : [],
    };
  }, [gridApi]);

  /**
   * Production-capable logical selection reader for future Delete/Export/Bulk Update actions.
   * It intentionally hides whether the current mode is native page selection or custom dataset state.
   */
  const readSelectionIntent = useCallback(
    () => (scope === 'page' ? readPageSelectionIntent() : datasetIntent),
    [datasetIntent, readPageSelectionIntent, scope],
  );

  /**
   * Logical dataset selection may include unloaded rows; every newly materialised RowNode must reflect
   * the include/exclude intent. Page mode skips reconciliation because native selection owns the rows.
   */
  const syncLoadedRows = useCallback(() => {
    if (scope === 'page') return;

    gridApi.current?.forEachNode((node) => {
      if (!node.data) return;

      const shouldBeSelected = isRowSelected(getRowId(node.data));
      if (node.isSelected() !== shouldBeSelected) {
        /** API source prevents this visual reconciliation from being treated as a user toggle. */
        node.setSelected(shouldBeSelected, false, 'api');
      }
    });
  }, [getRowId, gridApi, isRowSelected, scope]);

  /**
   * Called after AG Grid changes its accepted Infinite model. The filtered total is deliberately read
   * from that accepted model instead of individual datasource responses, avoiding stale-request races.
   */
  const onRowsChanged = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    if (scope === 'filtered' && api.isLastRowIndexKnown()) {
      setFilteredTotal(api.getDisplayedRowCount());
    }

    syncLoadedRows();
  }, [gridApi, scope, setFilteredTotal, syncLoadedRows]);

  useEffect(() => {
    if (scope === 'page') return;

    /** Intent can change without RowNode replacement, so refresh loaded rows and custom header. */
    syncLoadedRows();
    gridApi.current?.refreshHeader();
  }, [datasetIntent, gridApi, scope, syncLoadedRows]);

  /**
   * Native row-selection column remains visible to the feature root, but its row-model-specific header
   * mechanics are kept with the rest of Infinite selection behavior.
   */
  const selectionColumnDef = useMemo<SelectionColumnDef>(() => {
    const base: SelectionColumnDef = {
      width: 52,
      minWidth: 52,
      maxWidth: 52,
      resizable: false,
      sortable: false,
    };

    if (scope === 'page') {
      return {
        ...base,
        headerComponent: InfiniteCurrentPageSelectionHeader,
      };
    }

    return {
      ...base,
      headerComponent: SelectionHeaderCheckbox,
      headerComponentParams: {
        ...headerState,
        label: headerLabel,
        onChange: setHeaderSelected,
      },
    };
  }, [headerLabel, headerState, scope, setHeaderSelected]);

  /** User row toggles update custom logical state only while dataset selection owns the semantics. */
  const onRowSelected = useCallback(
    (event: RowSelectedEvent<TData>) => {
      if (scope === 'page' || event.source === 'api' || !event.data) return;

      setRowSelected(
        getRowId(event.data),
        event.node.isSelected() === true,
      );
    },
    [getRowId, scope, setRowSelected],
  );

  /** Page mode alone publishes native Grid State selection through this AG Grid event. */
  const onSelectionChanged = useCallback(
    (event: SelectionChangedEvent<TData>) => {
      if (scope !== 'page') return;

      const nativeSelection = event.api.getState().rowSelection;
      onSelectionChange?.({
        mode: 'include',
        ids: Array.isArray(nativeSelection) ? nativeSelection : [],
      });
    },
    [onSelectionChange, scope],
  );

  /**
   * Filter changes invalidate query-derived support state and may invalidate filtered/exclude intent.
   * The controller keeps those two reset rules together because both describe the old query universe.
   */
  const onFilterChanged = useCallback(() => {
    if (scope === 'filtered') {
      resetFilteredTotal();
    }

    if (scope !== 'page') {
      onDatasetFilterChanged?.();
    }
  }, [onDatasetFilterChanged, resetFilteredTotal, scope]);

  return {
    supportError,
    selectionColumnDef,
    readSelectionIntent,
    onRowsChanged,
    onRowSelected,
    onSelectionChanged,
    onFilterChanged,
  };
}
