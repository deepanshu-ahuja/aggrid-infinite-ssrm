import { useCallback, useRef } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type {
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import type { GridRowsLoader } from '@/shared/grid/data/gridData.types';
import { useInfiniteRowLoading } from '@/shared/grid/data/infinite/useInfiniteRowLoading';
import { useCurrentPageEditActions } from '@/shared/grid/editing/useCurrentPageEditActions';
import { useTrackedGridEditing } from '@/shared/grid/editing/useTrackedGridEditing';
import { GridErrorOverlay } from '@/shared/grid/overlays/GridErrorOverlay';
import { useInfiniteSelectionController } from '@/shared/grid/selection/infinite/useInfiniteSelectionController';
import type {
  InfiniteSelectionMode,
  ServerSelectionIntent,
} from '@/shared/grid/selection/serverSelection';
import { useGridStatePersistence } from '@/shared/grid/state/useGridStatePersistence';
import { listTransactions } from '../api/transactions.api';
import type { Transaction } from '../api/transactions.contracts';
import {
  transactionsGridConfig,
  type TransactionsInfiniteGridOptions,
} from '../transactionsGrid.config';
import { TransactionEditingControls } from './TransactionEditingControls';
import { transactionEditingConfig } from './transactionEditing';
import { transactionColumns } from './transactionColumns';
import { mapTransactionGridRequest } from './transactionRequest.mapper';
import { useTransactionEditPersistence } from './useTransactionEditPersistence';

const INFINITE_STATE_KEY = 'transactions:infinite';
const getTransactionId = (row: Transaction) => row.id;
const getRowId = ({ data }: GetRowIdParams<Transaction>) => getTransactionId(data);

/** AG Grid requests row blocks later; this stable feature boundary maps each request to the API contract. */
const loadTransactionRows: GridRowsLoader<Transaction> = (request, context) =>
  listTransactions(mapTransactionGridRequest(request), context.signal);

export interface TransactionsInfiniteGridProps {
  selectionScope?: InfiniteSelectionMode;
  gridOptions?: TransactionsInfiniteGridOptions;
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
}

/** Transactions Infinite root. Native row-model lifecycle stays visible at the concrete grid owner. */
export function TransactionsInfiniteGrid({
  selectionScope: selectionScopeOverride,
  gridOptions: gridOptionsOverride,
  onSelectionChange,
}: TransactionsInfiniteGridProps) {
  const selectionScope =
    selectionScopeOverride ?? transactionsGridConfig.infinite.selectionScope;
  const gridOptions =
    gridOptionsOverride ?? transactionsGridConfig.infinite.gridOptions;
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  const {
    datasource,
    error: loadError,
    totalCount,
    retry: retryLoad,
    clearError: clearLoadError,
  } = useInfiniteRowLoading({ gridApi, loadRows: loadTransactionRows });

  const {
    selectionColumnDef,
    onRowsChanged: syncSelectionAfterRowsChange,
    onRowSelected,
    onSelectionChanged,
    resetFilterDependentSelection,
  } = useInfiniteSelectionController({
    gridApi,
    scope: selectionScope,
    getRowId: getTransactionId,
    totalCount,
    onSelectionChange,
  });

  const {
    payload,
    editedRowCount,
    lastEdit,
    applyChangesToNodes,
    restoreTrackedEdits,
    handleCellValueChanged,
    acknowledgeChanges,
    discardRow,
    discardAll,
  } = useTrackedGridEditing(transactionEditingConfig);

  const {
    error: editActionError,
    applyLastEdit,
    applyBulkChanges,
  } = useCurrentPageEditActions({ lastEdit, applyChangesToNodes }, gridApi);

  /**
   * Infinite owns its post-save cache behavior. Editable values can affect server-side sort/filter,
   * so after the backend accepts a save we reload cached blocks instead of pretending their positions
   * remain correct. AG Grid keeps old rows visible until refreshed block data arrives.
   */
  const handlePersistedRows = useCallback(() => {
    gridApi.current?.refreshInfiniteCache();
  }, []);

  const { saveRow, saveAll, isSaving, saveError } =
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

  const handleDiscardAll = useCallback(() => {
    const api = gridApi.current;
    if (api) discardAll(api);
  }, [discardAll]);

  const { initialState, onStateUpdated } =
    useGridStatePersistence<Transaction>({ key: INFINITE_STATE_KEY });

  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;
      window.setTimeout(syncSelectionAfterRowsChange, 0);
    },
    [syncSelectionAfterRowsChange],
  );

  /**
   * Intentionally wired to BOTH modelUpdated and paginationChanged. Infinite may recreate/reload rows
   * through either lifecycle. Selection and still-unsaved edits are idempotently reconciled afterward.
   */
  const handleRowsChanged = useCallback(() => {
    syncSelectionAfterRowsChange();
    const api = gridApi.current;
    if (api) restoreTrackedEdits(api);
  }, [restoreTrackedEdits, syncSelectionAfterRowsChange]);

  const handleFilterChanged = useCallback(() => {
    clearLoadError();
    resetFilterDependentSelection();
  }, [clearLoadError, resetFilterDependentSelection]);

  return (
    <Stack spacing={2}>
      <TransactionEditingControls
        editedRowCount={editedRowCount}
        lastEdit={lastEdit}
        updates={payload.updates}
        isSaving={isSaving}
        saveError={saveError}
        onApplyLastEdit={applyLastEdit}
        onApplyBulkEdit={applyBulkChanges}
        onSaveRow={saveRow}
        onDiscardRow={handleDiscardRow}
        onSaveAll={saveAll}
        onDiscardAll={handleDiscardAll}
      />

      {editActionError ? (
        <Typography variant="body2" color="warning.main">
          {editActionError}
        </Typography>
      ) : null}

      <Box sx={{ height: 620, width: '100%' }}>
        {/*
         * Important native wiring:
         * - onGridReady stores the one authoritative GridApi.
         * - onModelUpdated + onPaginationChanged restore unsaved drafts after Infinite row recreation.
         * - successful Save uses refreshInfiniteCache() above so server sorting/filtering stays authoritative.
         * - onFilterChanged clears only app state tied to the previous server query.
         * - onCellValueChanged records drafts outside temporary RowNodes.
         */}
        <AgGridReact<Transaction>
          {...gridOptions}
          rowModelType="infinite"
          datasource={datasource}
          columnDefs={transactionColumns}
          getRowId={getRowId}
          initialState={initialState}
          rowSelection={{
            mode: 'multiRow',
            headerCheckbox: false,
            enableClickSelection: false,
          }}
          selectionColumnDef={selectionColumnDef}
          activeOverlay={loadError ? GridErrorOverlay : undefined}
          activeOverlayParams={
            loadError
              ? { message: loadError, onRetry: retryLoad }
              : undefined
          }
          onGridReady={handleGridReady}
          onModelUpdated={handleRowsChanged}
          onPaginationChanged={handleRowsChanged}
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
