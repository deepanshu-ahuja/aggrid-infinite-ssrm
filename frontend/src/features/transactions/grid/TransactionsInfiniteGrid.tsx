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

/** Infinite and SSRM persist independent native AG Grid state for the same Transaction feature. */
const INFINITE_STATE_KEY = 'transactions:infinite';

/** One stable feature identity function is shared by AG Grid and reusable selection/edit capabilities. */
const getTransactionId = (row: Transaction) => row.id;
const getRowId = ({ data }: GetRowIdParams<Transaction>) => getTransactionId(data);

/**
 * AG Grid asks for rows later, when Infinite needs another block/page. The shared loading hook needs a
 * callable it can invoke at that time; there is no requested row range available during React render.
 *
 * This stable local function performs only the required boundary conversion:
 * AG Grid flat request -> Transactions backend request -> Transactions API.
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
 * Transactions Infinite root. Native AG Grid configuration stays visible here while focused shared
 * hooks own loading, selection, editing and Grid State behavior that genuinely has its own lifecycle.
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

  /** Keep the one AG Grid API instance here because this root renders and owns this grid. */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

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

  /**
   * AG Grid gives us its API once the grid has initialised. Selection then performs one deferred read
   * because the API can be ready slightly before the initial Infinite rows have been materialised.
   */
  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;
      window.setTimeout(syncSelectionAfterRowsChange, 0);
    },
    [syncSelectionAfterRowsChange],
  );

  /**
   * Runs when AG Grid changes/loads rows for the Infinite model or pagination.
   *
   * If a transaction was edited locally, then its old backend value may appear again after its page or
   * cache block is loaded later. Reapply the unsaved value so navigating away and back does not make
   * the user's edit disappear. The same row change is also where custom dataset selection is synced.
   *
   * We do not use `viewportChanged`: ordinary scrolling can change which DOM rows are visible without
   * representing the server-row lifecycle we care about. `firstDataRendered` is also unnecessary for
   * edit restoration because no user edit can exist before the first data render in this grid instance.
   */
  const handleRowsChanged = useCallback(() => {
    syncSelectionAfterRowsChange();

    const api = gridApi.current;
    if (api) {
      restoreTrackedEdits(api);
    }
  }, [restoreTrackedEdits, syncSelectionAfterRowsChange]);

  /**
   * Runs after the user changes a grid filter.
   *
   * A new filter starts a different server query, so an error from the previous query should disappear.
   * Also clear selection state whose meaning depended on the previous filtered result. All Records and
   * ordinary explicit IDs remain valid because they do not depend on the visible filter.
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
