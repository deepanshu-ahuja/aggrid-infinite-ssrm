import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Stack } from '@mui/material';
import type {
  FilterModel,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  RowSelectedEvent,
  SelectionColumnDef,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { createInfiniteDatasource } from '@/shared/grid/data/infinite/createInfiniteDatasource';
import { GridErrorOverlay } from '@/shared/grid/overlays/GridErrorOverlay';
import { InfiniteCurrentPageSelectionHeader } from '@/shared/grid/selection/infinite/InfiniteCurrentPageSelectionHeader';
import type { InfiniteSelectionController } from '@/shared/grid/selection/infinite/infiniteSelection.types';
import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';
import { SelectionHeaderCheckbox } from '@/shared/grid/selection/SelectionHeaderCheckbox';
import { listTransactions } from '../api/transactions.api';
import type { Transaction } from '../api/transactions.contracts';
import type { TransactionsInfiniteGridOptions } from '../transactionsGrid.config';
import { mapTransactionGridRequest } from './transactionRequest.mapper';
import { transactionColumns } from './transactionColumns';

/**
 * Supplies AG Grid with a stable identity for every Transaction row.
 *
 * Infinite Row Model only keeps part of the server dataset in browser memory. When blocks are
 * reloaded because of pagination, sorting, filtering, or cache eviction, AG Grid needs a stable ID
 * to recognise the same logical row again. Stable IDs also allow AG Grid to preserve native row
 * selection while blocks are re-created.
 */
const getRowId = ({ data }: GetRowIdParams<Transaction>) => data.id;

interface TransactionsInfiniteTableProps {
  /** Native AG Grid options selected by the Transactions feature configuration. */
  gridOptions: TransactionsInfiniteGridOptions;

  /**
   * `page` uses AG Grid native row selection plus our shared current-page header shortcut.
   * `dataset` enables the custom Infinite dataset Select-All strategy because Infinite cannot
   * represent unloaded all/filtered rows natively.
   */
  selectionMode: 'page' | 'dataset';

  /**
   * Present only for dataset-wide Infinite Select All semantics. Ordinary page/manual selection does
   * not need an application selection controller because AG Grid already owns those selected IDs.
   */
  selection?: InfiniteSelectionController;

  /**
   * Publishes native Infinite selection in backend-friendly include form for `page` mode.
   * The IDs are read from `api.getState().rowSelection`; they are not maintained in React state.
   */
  onNativeSelectionChange?: (selection: ServerSelectionIntent<string>) => void;

  /**
   * Error produced by selection-specific supporting data rather than by the grid datasource.
   * Example: all-record selection may need a separate unfiltered total-count request.
   */
  selectionError?: string;

  /**
   * Receives the backend total for the current accepted grid query. Dataset-level filtered Select
   * All needs this count to render its header without loading every row.
   */
  onFilteredTotalChange?: (total: number) => void;

  /**
   * Publishes AG Grid's CURRENT APPLIED column-filter model for later action-time payload building.
   * AG Grid remains the source of truth; the consumer should not mirror this into render state.
   */
  onFilterModelChange?: (filterModel: FilterModel) => void;
}

/**
 * Renders the Transactions implementation backed by AG Grid's Infinite Row Model.
 *
 * NATIVE-FIRST SELECTION BOUNDARY
 * -------------------------------
 * `page` mode:
 * - AG Grid owns manual row selection and selected IDs;
 * - the custom page header calls native `setNodesSelected()` only;
 * - selection payloads are read from native Grid State.
 *
 * `dataset` mode:
 * - Infinite still owns rendered RowNodes/checkboxes;
 * - application state exists only because Infinite cannot represent Select All across unloaded rows;
 * - loaded checkboxes are synchronised from that compact include/exclude controller when needed.
 *
 * This component deliberately does not create a second selected-ID store for page/manual selection.
 */
export function TransactionsInfiniteTable({
  gridOptions,
  selectionMode,
  selection,
  onNativeSelectionChange,
  selectionError,
  onFilteredTotalChange,
  onFilterModelChange,
}: TransactionsInfiniteTableProps) {
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  /** UI state for datasource failure only; AG Grid does not own our application error message. */
  const [loadError, setLoadError] = useState<string>();

  /**
   * Feature/domain loader passed to the shared Infinite datasource adapter. The adapter owns AG Grid
   * callback plumbing; this function owns Transactions request mapping and API access.
   */
  const loadRows = useCallback(
    async (
      request: Parameters<typeof mapTransactionGridRequest>[0],
      context: { signal: AbortSignal },
    ) => {
      const result = await listTransactions(
        mapTransactionGridRequest(request),
        context.signal,
      );

      setLoadError(undefined);
      return result;
    },
    [],
  );

  /** Keep one datasource identity so ordinary React renders do not reset Infinite cache state. */
  const datasource = useMemo(
    () =>
      createInfiniteDatasource<Transaction>({
        loadRows,
        onError: () => {
          setLoadError('Rows could not be loaded. Please retry.');
        },
      }),
    [loadRows],
  );

  /**
   * Required only while a dataset-level application selection controller is active. Dataset Select
   * All can describe unloaded rows, so newly loaded RowNodes must visually reconcile with that
   * compact logical state. Page/manual mode intentionally skips this because AG Grid owns it.
   */
  const syncLoadedDatasetCheckboxes = useCallback(() => {
    if (!selection) return;

    gridApi.current?.forEachNode((node) => {
      if (!node.data) return;

      const shouldBeChecked = selection.isRowSelected(node.data.id);

      if (node.isSelected() !== shouldBeChecked) {
        node.setSelected(shouldBeChecked, false, 'api');
      }
    });
  }, [selection]);

  /**
   * Runs after AG Grid's accepted model changes. The filtered count is read from AG Grid's current
   * model rather than directly from whichever asynchronous block request happened to finish last.
   */
  const updateAfterRowsChange = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    if (onFilteredTotalChange && api.isLastRowIndexKnown()) {
      onFilteredTotalChange(api.getDisplayedRowCount());
    }

    syncLoadedDatasetCheckboxes();
  }, [onFilteredTotalChange, syncLoadedDatasetCheckboxes]);

  /**
   * The dedicated selection column keeps AG Grid's ordinary row checkboxes in both modes. Only its
   * HEADER differs because Infinite has no native server-wide Select All.
   */
  const selectionColumnDef = useMemo<SelectionColumnDef>(() => {
    const base: SelectionColumnDef = {
      width: 52,
      minWidth: 52,
      maxWidth: 52,
      resizable: false,
      sortable: false,
    };

    if (selectionMode === 'page') {
      return {
        ...base,
        /**
         * Shared row-model-specific component. It derives current-page state from native GridApi and
         * uses native `setNodesSelected()`; no selected IDs are passed through React props/state.
         */
        headerComponent: InfiniteCurrentPageSelectionHeader,
      };
    }

    if (!selection) return base;

    return {
      ...base,
      headerComponent: SelectionHeaderCheckbox,
      headerComponentParams: {
        ...selection.headerState,
        label: selection.headerLabel,
        onChange: selection.setHeaderSelected,
      },
    };
  }, [selection, selectionMode]);

  useEffect(() => {
    if (selectionMode !== 'dataset' || !selection) return;

    /** Dataset logical state can change independently of currently materialised Infinite RowNodes. */
    syncLoadedDatasetCheckboxes();
    gridApi.current?.refreshHeader();
  }, [selection, selectionMode, syncLoadedDatasetCheckboxes]);

  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;
      onFilterModelChange?.(event.api.getFilterModel());
      window.setTimeout(updateAfterRowsChange, 0);
    },
    [onFilterModelChange, updateAfterRowsChange],
  );

  /**
   * Dataset mode needs row events only to update custom include/exclude state. Page mode deliberately
   * leaves ordinary checkbox changes entirely native.
   */
  const handleRowSelected = useCallback(
    (event: RowSelectedEvent<Transaction>) => {
      if (selectionMode !== 'dataset' || !selection) return;
      if (event.source === 'api' || !event.data) return;

      selection.setRowSelected(
        event.data.id,
        event.node.isSelected() === true,
      );
    },
    [selection, selectionMode],
  );

  /**
   * Page/manual selection is published from AG Grid's own Grid State. For Infinite/non-SSRM models,
   * `rowSelection` is the selected row-ID array. Stable `getRowId` lets AG Grid retain those IDs even
   * when their RowNodes leave the current cache.
   */
  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<Transaction>) => {
      if (selectionMode !== 'page' || !onNativeSelectionChange) return;

      const nativeSelection = event.api.getState().rowSelection;
      const ids = Array.isArray(nativeSelection) ? nativeSelection : [];

      onNativeSelectionChange({
        mode: 'include',
        ids,
      });
    },
    [onNativeSelectionChange, selectionMode],
  );

  const handleFilterChanged = useCallback(() => {
    onFilteredTotalChange?.(0);
    setLoadError(undefined);

    /** Read only after AG Grid has applied the filter; do not maintain a parallel filter state here. */
    onFilterModelChange?.(gridApi.current?.getFilterModel() ?? {});

    /** Dataset strategy decides whether its unsupported Select-All intent is invalidated. */
    selection?.onFilterChanged?.();
  }, [onFilterModelChange, onFilteredTotalChange, selection]);

  /**
   * Infinite Row Model has no SSRM `retryServerSideLoads()`. Its native recovery path is an Infinite
   * cache refresh, which keeps successful rows visible until replacement blocks arrive.
   */
  const handleRetryLoad = useCallback(() => {
    setLoadError(undefined);
    gridApi.current?.refreshInfiniteCache();
  }, []);

  return (
    <Stack spacing={1.5}>
      {selectionError ? <Alert severity="error">{selectionError}</Alert> : null}

      <Box sx={{ height: 620, width: '100%' }}>
        <AgGridReact<Transaction>
          rowModelType="infinite"
          datasource={datasource}
          columnDefs={transactionColumns}
          {...gridOptions}
          getRowId={getRowId}
          rowSelection={{
            mode: 'multiRow',
            /** Infinite has no usable native server-wide header Select All. */
            headerCheckbox: false,
            enableClickSelection: false,
          }}
          selectionColumnDef={selectionColumnDef}
          activeOverlay={loadError ? GridErrorOverlay : undefined}
          activeOverlayParams={
            loadError
              ? {
                  message: loadError,
                  onRetry: handleRetryLoad,
                }
              : undefined
          }
          onGridReady={handleGridReady}
          onModelUpdated={updateAfterRowsChange}
          onPaginationChanged={updateAfterRowsChange}
          onRowSelected={handleRowSelected}
          onSelectionChanged={handleSelectionChanged}
          onFilterChanged={handleFilterChanged}
        />
      </Box>
    </Stack>
  );
}
