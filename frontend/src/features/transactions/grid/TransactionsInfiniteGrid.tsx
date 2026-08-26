import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type {
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import type { GridRowsLoader } from '@/shared/grid/data/gridData.types';
import { useInfiniteRowLoading } from '@/shared/grid/data/infinite/useInfiniteRowLoading';
import { buildSelectedTrackedGridUpdatePayload } from '@/shared/grid/editing/trackedGridEditing';
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
import type { TransactionRowEditActionsContext } from './TransactionRowEditActions';
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

  /** Native page selection does not itself change React state, so this revision refreshes bulk-action counts. */
  const [selectionRevision, setSelectionRevision] = useState(0);

  const {
    datasource,
    error: loadError,
    totalCount,
    retry: retryLoad,
    clearError: clearLoadError,
  } = useInfiniteRowLoading({ gridApi, loadRows: loadTransactionRows });

  const {
    selectionColumnDef,
    readSelectionIntent,
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

  /**
   * Infinite owns its post-save cache behavior. Editable values can affect server-side sort/filter,
   * so after the backend accepts a save we reload cached blocks instead of pretending their positions
   * remain correct. AG Grid keeps old rows visible until refreshed block data arrives.
   */
  const handlePersistedRows = useCallback(() => {
    gridApi.current?.refreshInfiniteCache();
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

  /**
   * Aggregate persistence is the intersection of dirty drafts and logical checkbox selection.
   * A row can be dirty because it was edited directly or via "Entire current page"; if it is not
   * currently selected, it remains available for row-level Save/Discard but is excluded from bulk.
   */
  const selectedDirtyUpdates = useMemo(
    () =>
      buildSelectedTrackedGridUpdatePayload(
        state,
        readSelectionIntent(),
      ).updates,
    [readSelectionIntent, selectionRevision, state],
  );

  const handleSaveSelected = useCallback(() => {
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

  /**
   * The Actions column reads the SAME draft state that builds aggregate persistence. It does not own a
   * second dirty-row list, so reverting the last changed field removes both row actions and bulk work.
   */
  const rowEditActionsContext = useMemo<TransactionRowEditActionsContext>(
    () => ({
      isRowDirty: (rowId) => Boolean(state.changesById[rowId]),
      isSaving,
      onSaveRow: saveRow,
      onDiscardRow: handleDiscardRow,
    }),
    [handleDiscardRow, isSaving, saveRow, state.changesById],
  );

  /**
   * AG Grid context is consumed by the Actions cell renderer. Publish the latest context through the
   * native API before refreshing that column; otherwise Save/Discard can render from an older dirty-state
   * closure after a row has already been saved, discarded, or reverted to its original value.
   */
  useEffect(() => {
    const api = gridApi.current;
    if (!api) return;

    api.setGridOption('context', rowEditActionsContext);
    api.refreshCells({ columns: ['editActions'], force: true });
  }, [rowEditActionsContext]);

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

      <Box sx={{ height: 620, width: '100%' }}>
        <AgGridReact<Transaction>
          {...gridOptions}
          rowModelType="infinite"
          datasource={datasource}
          columnDefs={transactionColumns}
          context={rowEditActionsContext}
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
          onSelectionChanged={handleSelectionChanged}
          onFilterChanged={handleFilterChanged}
          onCellValueChanged={handleCellValueChanged}
          onStateUpdated={onStateUpdated}
        />
      </Box>
    </Stack>
  );
}
