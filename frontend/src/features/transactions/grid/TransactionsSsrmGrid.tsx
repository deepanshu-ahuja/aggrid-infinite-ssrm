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
   * Runs when SSRM changes the rows in its current model, for example after another server page/block
   * has loaded. Two pieces of our application state may need to be put back onto those new RowNodes:
   *
   * 1. custom "Select All Filtered" checkbox state;
   * 2. unsaved local cell edits for rows that were previously edited.
   *
   * We use `modelUpdated` for this instead of `viewportChanged`. Viewport changes also happen during
   * ordinary scrolling when only the DOM window changes, which is broader than the data/model change
   * we actually care about. `firstDataRendered` is also unnecessary because it only fires once, before
   * a user can have created any local edits in this grid instance.
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
   * The new filter starts a different server query, so an error from the previous query should no
   * longer be displayed. Also clear "Select All Filtered" if it was active, because that selection
   * belonged to the previous filter. Native All Records and ordinary explicit selections remain valid.
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
