// GRIDCAP-ROWMODEL-SSRM | GRIDCAP-DATA-LOAD | GRIDCAP-ROW-ID | GRIDCAP-QUERY-SORT | GRIDCAP-QUERY-FILTER | GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-VALIDATION | GRIDCAP-LIFECYCLE-REFRESH | GRIDCAP-LIFECYCLE-DESTROY | GRIDCAP-ROW-ELIGIBILITY | GRIDCAP-COLUMNS
import { useCallback, useRef } from 'react';
import { Alert, Box, Stack, Typography } from '@mui/material';
import type { GridApi, GridReadyEvent } from 'ag-grid-community';
import { CellSelectionModule, ClipboardModule } from 'ag-grid-enterprise';
import { AgGridReact } from 'ag-grid-react';
import { compileConfigurableSsrmEntity } from '@/shared/grid/configurable/configuration.compiler';
import { useServerSideRowLoading } from '@/shared/grid/data/server-side/useServerSideRowLoading';
import { useGridDraftEditing } from '@/shared/grid/editing/useGridDraftEditing';
import { GridErrorOverlay } from '@/shared/grid/overlays/GridErrorOverlay';
import type { Transaction } from '../api/transactions.contracts';
import {
  requireTransactionConfigurableDataAdapter,
  resolveTransactionConfigurableLabel,
  transactionConfigurableRegistries,
  transactionsConfigurableFeature,
} from '../configurable/transactionsConfigurableFeature';
import {
  isTransactionEditableField,
  type TransactionEditableField,
  type TransactionEditableValue,
} from './transactionEditing';
import {
  isTransactionCellEditable,
  isTransactionRowSelectable,
  transactionRowClassRules,
} from './transactionRowInteraction';

const transactionEntity = transactionsConfigurableFeature.entities.transaction;
if (!transactionEntity) {
  throw new Error('The configurable Transaction entity is not defined.');
}

const loadTransactionRows = requireTransactionConfigurableDataAdapter(
  transactionEntity.dataAdapterKey,
);

/**
 * The compiler resolves only metadata/native configuration. This root deliberately keeps SSRM
 * infrastructure, business eligibility and AG Grid lifecycle visible.
 */
const compiledTransactionGrid = compileConfigurableSsrmEntity<Transaction>({
  entity: transactionEntity,
  registries: transactionConfigurableRegistries,
  resolveLabel: resolveTransactionConfigurableLabel,
  runtimePolicy: {
    isCellEditable: isTransactionCellEditable,
    isRowSelectable: isTransactionRowSelectable,
  },
});

/**
 * First real consumer of the configurable SSRM contract.
 *
 * AG Grid still owns normal editing, Cell Selection, Fill Handle, clipboard and the SSRM store.
 * Shared draft state observes committed cellValueChanged events and retains only BASE + LOCAL fields.
 * Save mapping, actions, access projection and Grid State reconciliation remain later capabilities.
 */
export function TransactionsConfigurableSsrmGrid() {
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  const {
    datasource,
    error: loadError,
    retry: retryLoad,
    clearError: clearLoadError,
  } = useServerSideRowLoading({
    gridApi,
    loadRows: loadTransactionRows,
    defaultBlockSize: compiledTransactionGrid.gridOptions.cacheBlockSize ?? 100,
  });

  const {
    editedRowCount,
    editedCellCount,
    handleCellValueChanged,
    restoreDrafts,
  } = useGridDraftEditing<Transaction, TransactionEditableField, TransactionEditableValue>({
    getRowId: compiledTransactionGrid.getRowIdFromData,
    isEditableField: isTransactionEditableField,
  });

  const handleGridReady = useCallback((event: GridReadyEvent<Transaction>) => {
    gridApi.current = event.api;
  }, []);

  const handleModelUpdated = useCallback(() => {
    const api = gridApi.current;
    if (api) restoreDrafts(api);
  }, [restoreDrafts]);

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Configurable SSRM foundation: native AG Grid options/columns are compiled from validated JSON;
        runtime datasource, business policy and draft state stay frontend-owned.
      </Alert>

      <Typography variant="body2">
        {editedRowCount} {editedRowCount === 1 ? 'row' : 'rows'} edited; {editedCellCount}{' '}
        {editedCellCount === 1 ? 'cell' : 'cells'} changed locally.
      </Typography>

      <Typography variant="caption" color="text.secondary">
        Persistence/actions are intentionally not wired in this foundation batch. Edits prove native
        editing + lightweight BASE/LOCAL composition only.
      </Typography>

      <Box sx={{ height: 620, width: '100%' }}>
        <AgGridReact<Transaction>
          {...compiledTransactionGrid.gridOptions}
          modules={[CellSelectionModule, ClipboardModule]}
          rowModelType="serverSide"
          serverSideDatasource={datasource}
          columnDefs={compiledTransactionGrid.columnDefs}
          components={compiledTransactionGrid.components}
          getRowId={compiledTransactionGrid.getRowId}
          rowClassRules={transactionRowClassRules}
          activeOverlay={loadError ? GridErrorOverlay : undefined}
          activeOverlayParams={loadError ? { message: loadError, onRetry: retryLoad } : undefined}
          onGridReady={handleGridReady}
          onGridPreDestroyed={() => {
            gridApi.current = null;
          }}
          onModelUpdated={handleModelUpdated}
          onFilterChanged={clearLoadError}
          onCellValueChanged={handleCellValueChanged}
        />
      </Box>
    </Stack>
  );
}
