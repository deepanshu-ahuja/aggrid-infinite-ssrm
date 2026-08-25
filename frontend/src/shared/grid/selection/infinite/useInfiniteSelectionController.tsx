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

  /** Complete unfiltered dataset count returned by the normal page-loading response. */
  totalCount: number;

  /** Publishes the current logical selection to feature consumers. */
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
}

/**
 * Complete Infinite Row Model selection capability.
 *
 * The controller owns selection semantics only. It does NOT fetch supporting metadata. The complete
 * dataset count comes from the normal loading response, while the filtered count is read from AG
 * Grid's accepted Infinite model. This keeps backend I/O in row loading and selection focused on
 * selection behavior.
 */
export function useInfiniteSelectionController<TData>({
  gridApi,
  scope,
  getRowId,
  totalCount,
  onSelectionChange,
}: UseInfiniteSelectionControllerOptions<TData>) {
  /**
   * Filtered count is accepted-model state, not raw request-response state. Reading it after AG Grid
   * updates its model prevents an older overlapping datasource response from overwriting the current
   * query's selection-header count.
   */
  const [filteredTotal, setFilteredTotal] = useState(0);

  const datasetTotal =
    scope === 'all' ? totalCount : scope === 'filtered' ? filteredTotal : 0;

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
    totalRowCount: datasetTotal,
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

  const readSelectionIntent = useCallback(
    () => (scope === 'page' ? readPageSelectionIntent() : datasetIntent),
    [datasetIntent, readPageSelectionIntent, scope],
  );

  /** Reconcile application-owned dataset selection onto materialised Infinite RowNodes. */
  const syncLoadedRows = useCallback(() => {
    if (scope === 'page') return;

    gridApi.current?.forEachNode((node) => {
      if (!node.data) return;

      const shouldBeSelected = isRowSelected(getRowId(node.data));
      if (node.isSelected() !== shouldBeSelected) {
        node.setSelected(shouldBeSelected, false, 'api');
      }
    });
  }, [getRowId, gridApi, isRowSelected, scope]);

  /**
   * AG Grid already received backend `filteredCount` when the datasource succeeded. Once the current
   * model is accepted and its last row is known, its displayed row count is therefore the trusted
   * filtered total for selection-header calculations.
   */
  const onRowsChanged = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    if (scope === 'filtered' && api.isLastRowIndexKnown()) {
      setFilteredTotal(api.getDisplayedRowCount());
    }

    syncLoadedRows();
  }, [gridApi, scope, syncLoadedRows]);

  useEffect(() => {
    if (scope === 'page') return;

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

  const onRowSelected = useCallback(
    (event: RowSelectedEvent<TData>) => {
      if (scope === 'page' || event.source === 'api' || !event.data) return;

      setRowSelected(getRowId(event.data), event.node.isSelected() === true);
    },
    [getRowId, scope, setRowSelected],
  );

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
   * A new filter invalidates the old accepted filtered count immediately. Filtered/exclude selection
   * is also cleared by `useDatasetSelection`; All Records selection remains independent of filters.
   */
  const onFilterChanged = useCallback(() => {
    if (scope === 'filtered') {
      setFilteredTotal(0);
    }

    if (scope !== 'page') {
      onDatasetFilterChanged?.();
    }
  }, [onDatasetFilterChanged, scope]);

  return {
    selectionColumnDef,
    readSelectionIntent,
    onRowsChanged,
    onRowSelected,
    onSelectionChanged,
    onFilterChanged,
  };
}
