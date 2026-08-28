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

/** Infinite Row Model selection capability. */
export function useInfiniteSelectionController<TData>({
  gridApi,
  scope,
  getRowId,
  totalCount,
  onSelectionChange,
}: UseInfiniteSelectionControllerOptions<TData>) {
  /** Final accepted filtered result size used by filtered-wide header/count presentation. */
  const [filteredTotal, setFilteredTotal] = useState(0);

  /**
   * Renderable count for native explicit/page selection.
   *
   * AG Grid remains authoritative for WHICH IDs are selected. We store only the derived count because
   * React must render it reactively and must not read `gridApi.current` during render. SelectionChanged
   * publishes a new count whenever AG Grid's native explicit selection changes.
   */
  const [pageSelectedCount, setPageSelectedCount] = useState(0);

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

  /** Read native explicit selection only at action/event time, never as render state. */
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

  // Dataset-wide count is pure React state + logical selection. Page mode uses the event-maintained
  // derived count above so rendering never reaches through the GridApi ref.
  const selectedRowCount =
    scope === 'page'
      ? pageSelectedCount
      : getLogicalSelectedRowCount(datasetIntent, datasetTotal);

  const syncLoadedRows = useCallback(() => {
    if (scope === 'page') return;

    gridApi.current?.forEachNode((node) => {
      if (!node.data || node.selectable === false) return;

      const shouldBeSelected = isRowSelected(getRowId(node.data));
      if (node.isSelected() !== shouldBeSelected) {
        // `api` identifies reconciliation writes so onRowSelected does not feed them back into the
        // logical exception reducer as if a user toggled the checkbox.
        node.setSelected(shouldBeSelected, false, 'api');
      }
    });
  }, [getRowId, gridApi, isRowSelected, scope]);

  const onRowsChanged = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    if (scope === 'filtered' && api.isLastRowIndexKnown()) {
      // Infinite only knows the final filtered size once the datasource has closed the row range.
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
        onChange: (checked: boolean) => setHeaderSelected(checked),
      },
    };
  }, [headerLabel, headerState, scope, setHeaderSelected]);

  const onRowSelected = useCallback(
    (event: RowSelectedEvent<TData>) => {
      if (scope === 'page' || event.source === 'api' || !event.data || event.node.selectable === false) {
        return;
      }

      setRowSelected(getRowId(event.data), event.node.isSelected() === true);
    },
    [getRowId, scope, setRowSelected],
  );

  const onSelectionChanged = useCallback(
    (event: SelectionChangedEvent<TData>) => {
      if (scope !== 'page') return;

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

  const resetFilterDependentSelection = useCallback(() => {
    if (scope === 'filtered') setFilteredTotal(0);
    if (scope !== 'page') resetDatasetSelectionForFilter?.();
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
