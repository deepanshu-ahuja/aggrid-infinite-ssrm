import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type {
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import type { GridRowsLoader } from '@/shared/grid/data/gridData.types';
import { useServerSideRowLoading } from '@/shared/grid/data/server-side/useServerSideRowLoading';
import { buildSelectedTrackedGridUpdatePayload } from '@/shared/grid/editing/trackedGridEditing';
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
import type { TransactionRowEditActionsContext } from './TransactionRowEditActions';
import { transactionEditingConfig } from './transactionEditing';
import { transactionColumns } from './transactionColumns';
import { mapTransactionGridRequest } from './transactionRequest.mapper';
import { useTransactionEditPersistence } from './useTransactionEditPersistence';

const SSRM_STATE_KEY = 'transactions:ssrm';
const getTransactionId = (row: Transaction) => row.id;
const getRowId = ({ data }: GetRowIdParams<Transaction>) => getTransactionId(data);

/** AG Grid asks the server for row blocks. This function converts that request to our Transactions API shape. */
const loadTransactionRows: GridRowsLoader<Transaction> = (request, context) =>
  listTransactions(mapTransactionGridRequest(request), context.signal);

export interface TransactionsSsrmGridProps {
  gridOptions?: TransactionsSsrmGridOptions;
}

/** Transactions grid using AG Grid's Server-Side Row Model (SSRM). */
export function TransactionsSsrmGrid({
  gridOptions: gridOptionsOverride,
}: TransactionsSsrmGridProps) {
  const gridOptions =
    gridOptionsOverride ?? transactionsGridConfig.ssrm.gridOptions;
  const gridApi = useRef<GridApi<Transaction> | null>(null);
  const [isGridReady, setIsGridReady] = useState(false);

  /** Checkbox changes live inside AG Grid, so this state is only used to make React recalculate external controls. */
  const [, setSelectionRevision] = useState(0);

  const {
    error: selectionError,
    readSelectionIntent,
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
    state,
    payload,
    editedRowCount,
    lastEdit,
    applyChangesToNodes,
    restoreTrackedEdits,
    handleCellValueChanged,
    acknowledgeChanges,
    discardRow,
    discardRows,
  } = useTrackedGridEditing(transactionEditingConfig);

  const {
    error: editActionError,
    applyLastEdit,
    applyBulkChanges,
  } = useCurrentPageEditActions({ lastEdit, applyChangesToNodes }, gridApi);

  /** After Save, ask SSRM to reload its rows from the backend. */
  const handlePersistedRows = useCallback(() => {
    gridApi.current?.refreshServerSide();
  }, []);

  const { saveRow, saveBulk, isSaving, saveError } =
    useTransactionEditPersistence({
      updates: payload.updates,
      acknowledgeChanges,
      onPersistedRows: handlePersistedRows,
    });

  const handleDiscardRow = useCallback(
    (rowId: string) => {
      const api = gridApi.current;
      if (api) discardRow(api, rowId);
    },
    [discardRow],
  );

  /** Bulk Save/Discard acts only on rows that are both dirty and currently selected. */
  const selectedDirtyUpdates = isGridReady
    ? buildSelectedTrackedGridUpdatePayload(state, readSelectionIntent()).updates
    : [];

  const handleSaveSelected = useCallback(() => {
    if (!gridApi.current) return;

    const updates = buildSelectedTrackedGridUpdatePayload(
      state,
      readSelectionIntent(),
    ).updates;
    saveBulk(updates);
  }, [readSelectionIntent, saveBulk, state]);

  const handleDiscardSelected = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    const updates = buildSelectedTrackedGridUpdatePayload(
      state,
      readSelectionIntent(),
    ).updates;
    discardRows(
      api,
      updates.map((update) => update.id),
    );
  }, [discardRows, readSelectionIntent, state]);

  /** The Actions cell checks this same draft state, so a clean row should not show Save/Discard. */
  const rowEditActionsContext = useMemo<TransactionRowEditActionsContext>(
    () => ({
      isRowDirty: (rowId) => Boolean(state.changesById[rowId]),
      isSaving,
      onSaveRow: saveRow,
      onDiscardRow: handleDiscardRow,
    }),
    [handleDiscardRow, isSaving, saveRow, state.changesById],
  );

  /** Push the latest dirty-state functions into AG Grid, then redraw only the Actions column. */
  useEffect(() => {
    const api = gridApi.current;
    if (!api) return;

    api.setGridOption?.('context', rowEditActionsContext);
    api.refreshCells?.({ columns: ['editActions'], force: true });
  }, [rowEditActionsContext]);

  const { initialState, onStateUpdated } =
    useGridStatePersistence<Transaction>({ key: SSRM_STATE_KEY });

  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;
      setIsGridReady(true);
    },
    [],
  );

  /** When SSRM loads/replaces rows, restore checkbox state and any still-unsaved cell values. */
  const handleModelUpdated = useCallback(() => {
    syncSelectionAfterRowsChange();
    const api = gridApi.current;
    if (api) restoreTrackedEdits(api);
  }, [restoreTrackedEdits, syncSelectionAfterRowsChange]);

  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<Transaction>) => {
      onSelectionChanged(event);
      setSelectionRevision((revision) => revision + 1);
    },
    [onSelectionChanged],
  );

  const handleFilterChanged = useCallback(() => {
    clearLoadError();
    resetFilterDependentSelection();
  }, [clearLoadError, resetFilterDependentSelection]);

  return (
    <Stack spacing={2}>
      <TransactionEditingControls
        editedRowCount={editedRowCount}
        selectedEditedRowCount={selectedDirtyUpdates.length}
        lastEdit={lastEdit}
        isSaving={isSaving}
        saveError={saveError}
        onApplyLastEdit={applyLastEdit}
        onApplyBulkEdit={applyBulkChanges}
        onSaveSelected={handleSaveSelected}
        onDiscardSelected={handleDiscardSelected}
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

      {selectionError ? <Alert severity="warning">{selectionError}</Alert> : null}

      <Box sx={{ height: 620, width: '100%' }}>
        <AgGridReact<Transaction>
          {...gridOptions}
          rowModelType="serverSide"
          serverSideDatasource={datasource}
          columnDefs={transactionColumns}
          context={rowEditActionsContext}
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
            loadError ? { message: loadError, onRetry: retryLoad } : undefined
          }
          onGridReady={handleGridReady}
          onModelUpdated={handleModelUpdated}
          onRowSelected={onRowSelected}
          onSelectionChanged={handleSelectionChanged}
          onFilterChanged={handleFilterChanged}
          onCellValueChanged={handleCellValueChanged}
          onStateUpdated={onStateUpdated}
        />
      </Box>
    </Stack>
  );
}
