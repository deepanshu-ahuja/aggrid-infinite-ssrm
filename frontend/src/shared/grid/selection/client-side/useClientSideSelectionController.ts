// GRIDCAP-ROWMODEL-CLIENT | GRIDCAP-SEL-MANUAL | GRIDCAP-SEL-PAGE | GRIDCAP-SEL-FILTERED | GRIDCAP-SEL-ALL | GRIDCAP-COUNT-SELECTED | GRIDCAP-ROW-ELIGIBILITY
import { useCallback, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import type { GridApi, IsRowSelectable, SelectionChangedEvent } from 'ag-grid-community';

export type ClientSideSelectionScope = 'page' | 'filtered' | 'all';

/**
 * Client-Side selection can always be expressed as explicit IDs because the complete working set is
 * already in browser memory. Unlike Infinite/SSRM dataset-wide selection, no unloaded-row include /
 * exclude representation is necessary.
 */
export interface ClientSideSelectionIntent {
  mode: 'include';
  ids: string[];
}

interface UseClientSideSelectionControllerOptions<TData> {
  /** Root-owned GridApi; the concrete Client grid remains the AG Grid lifecycle owner. */
  gridApi: RefObject<GridApi<TData> | null>;

  /** Product meaning for the native header checkbox. */
  scope: ClientSideSelectionScope;

  /** Stable backend identity used when turning native selected rows into a business target. */
  getRowId: (row: TData) => string;

  /** Feature adapter for backend-provided row eligibility. */
  isRowSelectable: IsRowSelectable<TData>;

  /** Optional feature observer for the exact explicit selection. */
  onSelectionChange?: (selection: ClientSideSelectionIntent) => void;
}

const selectAllModeByScope: Record<ClientSideSelectionScope, 'currentPage' | 'filtered' | 'all'> = {
  page: 'currentPage',
  filtered: 'filtered',
  all: 'all',
};

/**
 * Native-first Client-Side selection capability.
 *
 * AG Grid already supports the three product scopes directly for Client-Side Row Model through
 * `rowSelection.selectAll`, including `isRowSelectable` handling. This controller therefore does not
 * recreate checkbox state in React. React owns only the derived selected-row count needed for normal
 * rendering, while business actions read the exact native selected rows at action time.
 *
 * One application semantic is layered on top: when `filtered` scope is active and the defining filter
 * changes, the previous filtered-wide selection is cleared. Keeping it would silently redefine the
 * user's old filtered selection against a different filter universe.
 */
export function useClientSideSelectionController<TData>({
  gridApi,
  scope,
  getRowId,
  isRowSelectable,
  onSelectionChange,
}: UseClientSideSelectionControllerOptions<TData>) {
  /** Renderable derivative only; AG Grid remains authoritative for the selected row objects/IDs. */
  const [selectedRowCount, setSelectedRowCount] = useState(0);

  const readSelectionIntent = useCallback((): ClientSideSelectionIntent => {
    const rows = gridApi.current?.getSelectedRows() ?? [];
    return {
      mode: 'include',
      ids: rows.map(getRowId),
    };
  }, [getRowId, gridApi]);

  const onSelectionChanged = useCallback(
    (event: SelectionChangedEvent<TData>) => {
      const intent: ClientSideSelectionIntent = {
        mode: 'include',
        ids: event.api.getSelectedRows().map(getRowId),
      };

      setSelectedRowCount(intent.ids.length);
      onSelectionChange?.(intent);
    },
    [getRowId, onSelectionChange],
  );

  // GRIDCAP-ACTION-SELECTED
  const clearSelection = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    // Client selection is fully native, so clear it through AG Grid instead of maintaining a second
    // selected-ID store. Update the renderable derivative/observer immediately as well; AG Grid's
    // selectionChanged event may publish the same empty intent again and that duplicate is harmless.
    api.deselectAll();
    setSelectedRowCount(0);
    onSelectionChange?.({ mode: 'include', ids: [] });
  }, [gridApi, onSelectionChange]);

  // GRIDCAP-SEL-FILTERED
  const onFilterChanged = useCallback(() => {
    if (scope !== 'filtered') return;

    const api = gridApi.current;
    if (!api) return;

    // `deselectAll()` intentionally clears the complete previous selection, not merely currently
    // visible rows. In filtered scope every selected row belongs to the old filter-defined semantic;
    // carrying any of those IDs forward would silently change what "Select All Filtered" means.
    api.deselectAll();
    setSelectedRowCount(0);
  }, [gridApi, scope]);

  // GRIDCAP-SEL-PAGE | GRIDCAP-SEL-FILTERED | GRIDCAP-SEL-ALL | GRIDCAP-ROW-ELIGIBILITY
  const rowSelection = useMemo(
    () => ({
      mode: 'multiRow' as const,
      headerCheckbox: true,
      enableClickSelection: false,
      selectAll: selectAllModeByScope[scope],
      isRowSelectable,
    }),
    [isRowSelectable, scope],
  );

  return {
    rowSelection,
    selectedRowCount,
    readSelectionIntent,
    clearSelection,
    onSelectionChanged,
    onFilterChanged,
  };
}
