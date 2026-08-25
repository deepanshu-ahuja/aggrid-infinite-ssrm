import { useCallback, useRef } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type {
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import type { GridRowsLoader } from '@/shared/grid/data/gridData.types';
import { useServerSideRowLoading } from '@/shared/grid/data/server-side/useServerSideRowLoading';
import { useCurrentPageEditActions } from '@/shared/grid/editing/useCurrentPageEditActions';
import { useTrackedGridEditing } from '@/shared/grid/editing/useTrackedGridEditing';
import { GridErrorOverlay } from '@/shared/grid/overlays/GridErrorOverlay';
import { useSsrmSelectionController } from '@/shared/grid/selection/server-side/useSsrmSelectionController';
import { useGridStatePersistence } from '@/shared/grid/state/useGridStatePersistence';
import { listTransactions } from '../api/transactions.api';
import type { Transaction } from '../api/transactions.contracts';
import {
  transactionsGridConfig,
  type TransactionsSsrmGridOptions,
} from '../transactionsGrid.config';
import { TransactionEditingControls } from './TransactionEditingControls';
import { transactionEditingConfig } from './transactionEditing';
import { transactionColumns } from './transactionColumns';
import { mapTransactionGridRequest } from './transactionRequest.mapper';

/** SSRM persists its native Grid State independently from the Infinite instance. */
const SSRM_STATE_KEY = 'transactions:ssrm';

/** One stable feature identity function is shared by AG Grid and reusable capabilities. */
const getTransactionId = (row: Transaction) => row.id;
const getRowId = ({ data }: GetRowIdParams<Transaction>) => getTransactionId(data);

/**
 * AG Grid asks for rows later, whenever SSRM needs another server block/page. The shared loading hook
 * therefore needs a function it can call at that time; we cannot call `listTransactions(...)` during
 * React render because the requested row range does not exist yet.
 *
 * This stable local function performs only the required boundary conversion:
 * AG Grid flat request -> Transactions backend request -> Transactions API.
 */
const loadTransactionRows: GridRowsLoader<Transaction> = (request, context) =>
  listTransactions(
    mapTransactionGridRequest(request),
    context.signal,
  );

export interface TransactionsSsrmGridProps {
  /** Optional native GridOptions override for tests/embedding. */
  gridOptions?: TransactionsSsrmGridOptions;
}

/**
 * Transactions SSRM root. Native AG Grid configuration stays visible here while focused shared hooks
 * own loading, selection, editing and Grid State behavior that genuinely has its own lifecycle.
 */
export function TransactionsSsrmGrid({
  gridOptions: gridOptionsOverride,
}: TransactionsSsrmGridProps) {
  const gridOptions =
    gridOptionsOverride ?? transactionsGridConfig.ssrm.gridOptions;

  /** Keep the one AG Grid API instance here because this root renders and owns this grid. */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  const {
    error: selectionError,
    selectCurrentPage,
    selectAllFiltered,
    clearSelection,
    onModelUpdated: syncSelectionAfterRowsChange,
    onRowSelected,
    onSelectionChanged,
    resetFilterDependentSelection,
  } = useSsrmSelectionController({
    gridApi,
    getRowId: getTransactionId,
  });

  const {
    datasource,
    error: loadError,
    retry: retryLoad,
    clearError: clearLoadError,
  } = useServerSideRowLoading({
    gridApi,
    loadRows: loadTransactionRows,
    defaultBlockSize: gridOptions.cacheBlockSize ?? 100,
  });

  const {
    editedRowCount,
    lastEdit,
    applyChangesToNodes,
    restoreTrackedEdits,
    handleCellValueChanged,
  } = useTrackedGridEditing(transactionEditingConfig);

  const {
    error: editActionError,
    applyLastEdit,
    applyBulkChanges,
  } = useCurrentPageEditActions(
    { lastEdit, applyChangesToNodes },
    gridApi,
  );

  const { initialState, onStateUpdated } =
    useGridStatePersistence<Transaction>({
      key: SSRM_STATE_KEY,
    });

  /** AG Grid gives us its API once the grid has initialised; all later native operations use this ref. */
  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;
    },
    [],
  );

  /**
   * Reconcile application-owned state whenever SSRM replaces/loads rows in its displayed model.
   *
   * Example: the user edits a row on page 1, moves to page 2, then later returns to page 1. SSRM may
   * fetch that row again from the backend, which still contains the old value until the edit is saved.
   * `modelUpdated` runs when that server-side row model changes, so we can put the local unsaved value
   * back onto the newly available RowNode.
   *
   * The same event is also required by custom "Select All Filtered": newly loaded rows must receive the
   * checkbox state represented by the application-owned filtered selection.
   *
   * SSRM intentionally uses `onModelUpdated` here instead of `onViewportChanged`. Viewport changes can
   * happen from normal scrolling when only which DOM rows are visible changes; that is broader than the
   * server-row/model lifecycle we need. `onFirstDataRendered` is also unnecessary for edit restoration:
   * when the first rows render, the user has not yet been able to create an edit in this grid instance.
   *
   * Do not remove this handler without checking BOTH edit restoration and custom filtered-selection
   * reconciliation; they intentionally share the same SSRM model lifecycle event.
   */
  const handleModelUpdated = useCallback(() => {
    syncSelectionAfterRowsChange();

    const api = gridApi.current;
    if (api) {
      restoreTrackedEdits(api);
    }
  }, [restoreTrackedEdits, syncSelectionAfterRowsChange]);

  /**
   * Runs after the user changes a grid filter.
   *
   * AG Grid/SSRM owns applying the filter and requesting the new server data. This handler does NOT
   * perform filtering. It only cleans up application state that belonged to the previous query:
   *
   * - remove a load error from the previous server query;
   * - clear custom "Select All Filtered" because its meaning depended on the old filter.
   *
   * Native All Records and ordinary explicit selected IDs are not cleared because their meaning does
   * not depend on the current visible filter.
   */
  const handleFilterChanged = useCallback(() => {
    clearLoadError();
    resetFilterDependentSelection();
  }, [clearLoadError, resetFilterDependentSelection]);

  return (
    <Stack spacing={2}>
      <TransactionEditingControls
        editedRowCount={editedRowCount}
        lastEdit={lastEdit}
        onApplyLastEdit={applyLastEdit}
        onApplyBulkEdit={applyBulkChanges}
      />

      {editActionError ? (
        <Typography variant="body2" color="warning.main">
          {editActionError}
        </Typography>
      ) : null}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <Button variant="outlined" size="small" onClick={selectCurrentPage}>
          Select current page
        </Button>
        <Button variant="outlined" size="small" onClick={selectAllFiltered}>
          Select all filtered
        </Button>
        <Button variant="outlined" size="small" onClick={clearSelection}>
          Clear selection
        </Button>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        SSRM header checkbox selects all records. Current Page and All Filtered are explicit controls
        because SSRM does not support those native Select-All modes.
      </Typography>

      {selectionError ? (
        <Alert severity="warning">{selectionError}</Alert>
      ) : null}

      <Box sx={{ height: 620, width: '100%' }}>
        {/*
         * Important native SSRM event wiring:
         * - onGridReady stores the one authoritative GridApi.
         * - onModelUpdated restores unsaved edits AND syncs custom Select All Filtered when server rows
         *   are loaded/replaced. SSRM does not use viewportChanged for this purpose.
         * - onFilterChanged does not apply filtering; it only clears application state tied to the old
         *   query/filter.
         * - onRowSelected/onSelectionChanged keep custom filtered selection and native selection from
         *   becoming two competing sources of truth.
         * - onCellValueChanged records edits outside temporary RowNodes.
         * - onStateUpdated persists the chosen native Grid State.
         */}
        <AgGridReact<Transaction>
          {...gridOptions}
          rowModelType="serverSide"
          serverSideDatasource={datasource}
          columnDefs={transactionColumns}
          getRowId={getRowId}
          initialState={initialState}
          rowSelection={{
            mode: 'multiRow',
            headerCheckbox: true,
            selectAll: 'all',
            groupSelects: 'self',
          }}
          activeOverlay={loadError ? GridErrorOverlay : undefined}
          activeOverlayParams={
            loadError
              ? {
                  message: loadError,
                  onRetry: retryLoad,
                }
              : undefined
          }
          onGridReady={handleGridReady}
          onModelUpdated={handleModelUpdated}
          onRowSelected={onRowSelected}
          onSelectionChanged={onSelectionChanged}
          onFilterChanged={handleFilterChanged}
          onCellValueChanged={handleCellValueChanged}
          onStateUpdated={onStateUpdated}
        />
      </Box>
    </Stack>
  );
}
