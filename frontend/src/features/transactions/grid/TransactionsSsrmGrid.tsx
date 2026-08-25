import { useCallback, useRef } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type {
  FirstDataRenderedEvent,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  ViewportChangedEvent,
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
 * Concrete feature composition: translate the generic flat-grid request and call the Transactions API.
 *
 * This intentionally remains local to the root. Repeating these few lines in Infinite and SSRM is
 * clearer than introducing a feature loader module that adds no validation, policy or lifecycle.
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
 * Transactions SSRM root: compose reusable capabilities while keeping native AG Grid wiring explicit.
 * The root owns the authoritative API and cross-capability composition; SSRM loading/selection and
 * row-model-neutral editing mechanics stay in focused shared capabilities.
 */
export function TransactionsSsrmGrid({
  gridOptions: gridOptionsOverride,
}: TransactionsSsrmGridProps) {
  const gridOptions =
    gridOptionsOverride ?? transactionsGridConfig.ssrm.gridOptions;

  /** The concrete grid remains the single owner of AG Grid's imperative API. */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  const {
    error: selectionError,
    selectCurrentPage,
    selectAllFiltered,
    clearSelection,
    onModelUpdated,
    onRowSelected,
    onSelectionChanged,
    onFilterChanged: onSelectionFilterChanged,
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

  /** Grid readiness establishes the one authoritative native API for every capability. */
  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;
    },
    [],
  );

  /** Restore accumulated edits whenever SSRM materialises/recreates RowNodes. */
  const handleFirstDataRendered = useCallback(
    (event: FirstDataRenderedEvent<Transaction>) =>
      restoreTrackedEdits(event.api),
    [restoreTrackedEdits],
  );

  const handleViewportChanged = useCallback(
    (event: ViewportChangedEvent<Transaction>) =>
      restoreTrackedEdits(event.api),
    [restoreTrackedEdits],
  );

  /** Filter changes cross loading and SSRM selection, so the root composes both effects explicitly. */
  const handleFilterChanged = useCallback(() => {
    clearLoadError();
    onSelectionFilterChanged();
  }, [clearLoadError, onSelectionFilterChanged]);

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
          onFirstDataRendered={handleFirstDataRendered}
          onViewportChanged={handleViewportChanged}
          onModelUpdated={onModelUpdated}
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
