import { useCallback, useRef } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type {
  FirstDataRenderedEvent,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  ViewportChangedEvent,
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

/** Infinite and SSRM persist independent native AG Grid state for the same Transaction feature. */
const INFINITE_STATE_KEY = 'transactions:infinite';

/** One stable feature identity function is shared by AG Grid and reusable selection/edit capabilities. */
const getTransactionId = (row: Transaction) => row.id;
const getRowId = ({ data }: GetRowIdParams<Transaction>) => getTransactionId(data);

/**
 * Concrete feature composition: translate the generic flat-grid request and call the Transactions API.
 *
 * This intentionally stays in the root instead of a dedicated `loadTransactionGridRows.ts` file.
 * The function adds no validation, policy, lifecycle or domain behavior of its own, so extracting it
 * would create a pass-through abstraction merely because Infinite and SSRM repeat a few lines.
 */
const loadTransactionRows: GridRowsLoader<Transaction> = (request, context) =>
  listTransactions(
    mapTransactionGridRequest(request),
    context.signal,
  );

export interface TransactionsInfiniteGridProps {
  /** Optional selection strategy override used by embedding/tests. */
  selectionScope?: InfiniteSelectionMode;
  /** Optional native GridOptions override; no application wrapper option surface is introduced. */
  gridOptions?: TransactionsInfiniteGridOptions;
  /** Publishes the current logical selection without exposing row-model-specific internals. */
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
}

/**
 * Transactions Infinite root: compose reusable capabilities, keep native AG Grid wiring visible.
 *
 * The root owns the authoritative `GridApi`, Transaction columns/configuration and the visible
 * composition of loading, selection, editing and Grid State. Normal row loading now provides both
 * complete and filtered counts, so selection never performs its own backend request.
 */
export function TransactionsInfiniteGrid({
  selectionScope: selectionScopeOverride,
  gridOptions: gridOptionsOverride,
  onSelectionChange,
}: TransactionsInfiniteGridProps) {
  const selectionScope =
    selectionScopeOverride ?? transactionsGridConfig.infinite.selectionScope;
  const gridOptions =
    gridOptionsOverride ?? transactionsGridConfig.infinite.gridOptions;

  /** The concrete root remains the single owner of AG Grid's imperative API. */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  /**
   * Loading owns datasource/error/retry state and exposes the complete dataset count returned by the
   * normal page request. No count-only API request exists anymore.
   */
  const {
    datasource,
    error: loadError,
    totalCount,
    retry: retryLoad,
    clearError: clearLoadError,
  } = useInfiniteRowLoading({
    gridApi,
    loadRows: loadTransactionRows,
  });

  /**
   * Infinite selection consumes the normal loading metadata. Filtered count is read from AG Grid's
   * accepted current model; all-record count comes from `totalCount` above.
   */
  const {
    selectionColumnDef,
    onRowsChanged,
    onRowSelected,
    onSelectionChanged,
    onFilterChanged: onSelectionFilterChanged,
  } = useInfiniteSelectionController({
    gridApi,
    scope: selectionScope,
    getRowId: getTransactionId,
    totalCount,
    onSelectionChange,
  });

  /** Transaction configuration supplies only editable fields/identity; mechanics stay shared. */
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
      key: INFINITE_STATE_KEY,
    });

  /** Capture the authoritative API, then let selection inspect the materialised model asynchronously. */
  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;
      window.setTimeout(onRowsChanged, 0);
    },
    [onRowsChanged],
  );

  /** Restore accumulated edits whenever Infinite creates/recreates RowNodes. */
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

  /** Filter changes cross loading and selection, so the root composes those two capabilities visibly. */
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

      <Box sx={{ height: 620, width: '100%' }}>
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
              ? {
                  message: loadError,
                  onRetry: retryLoad,
                }
              : undefined
          }
          onGridReady={handleGridReady}
          onFirstDataRendered={handleFirstDataRendered}
          onViewportChanged={handleViewportChanged}
          onModelUpdated={onRowsChanged}
          onPaginationChanged={onRowsChanged}
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
