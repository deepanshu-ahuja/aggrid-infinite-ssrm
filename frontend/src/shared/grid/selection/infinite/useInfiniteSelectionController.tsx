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
import type { InfiniteSelectionMode, ServerSelectionIntent } from '../serverSelection';

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
   * Number of rows in the currently accepted filtered result. We keep this only because the custom
   * Infinite "Select All Filtered" header needs a count for its checked/indeterminate state.
   */
  const [filteredTotal, setFilteredTotal] = useState(0);

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

  /** Reconcile application-owned dataset selection onto Infinite rows that currently exist in memory. */
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
   * Runs after AG Grid changes the Infinite rows it currently knows about. This keeps newly loaded
   * rows visually consistent with our custom dataset-wide selection and updates the filtered count
   * once AG Grid knows the final size of the current filtered result.
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
        onChange: (checked: boolean) => {
          const selection: ServerSelectionIntent<string> = checked
            ? { mode: 'exclude', ids: [] }
            : { mode: 'include', ids: [] };

          console.log('HEADER SELECTION:', selection);
          setHeaderSelected(checked);
        },
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
   * Clear only selection/count state whose meaning came from the previous filter.
   *
   * Example: "Select All Filtered" while Status=Completed belongs to the Completed result. When the
   * filter changes, that selection must not silently become "all rows in the new filter". All Records
   * selection and ordinary explicit IDs are independent of the visible filter and are left alone.
   */
  const resetFilterDependentSelection = useCallback(() => {
    if (scope === 'filtered') {
      setFilteredTotal(0);
    }

    if (scope !== 'page') {
      resetDatasetSelectionForFilter?.();
    }
  }, [resetDatasetSelectionForFilter, scope]);

  return {
    selectionColumnDef,
    readSelectionIntent,
    onRowsChanged,
    onRowSelected,
    onSelectionChanged,
    resetFilterDependentSelection,
  };
}
