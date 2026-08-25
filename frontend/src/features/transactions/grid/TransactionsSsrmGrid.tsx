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
import { useServerSideRowLoading } from '@/shared/grid/data/server-side/useServerSideRowLoading';
import { useCurrentPageEditActions } from '@/shared/grid/editing/useCurrentPageEditActions';
import { useTrackedGridEditing } from '@/shared/grid/editing/useTrackedGridEditing';
import { GridErrorOverlay } from '@/shared/grid/overlays/GridErrorOverlay';
import { useSsrmSelectionController } from '@/shared/grid/selection/server-side/useSsrmSelectionController';
import { useGridStatePersistence } from '@/shared/grid/state/useGridStatePersistence';
import type { Transaction } from '../api/transactions.contracts';
import {
  transactionsGridConfig,
  type TransactionsSsrmGridOptions,
} from '../transactionsGrid.config';
import { loadTransactionGridRows } from './loadTransactionGridRows';
import { TransactionEditingControls } from './TransactionEditingControls';
import { transactionEditingConfig } from './transactionEditing';
import { transactionColumns } from './transactionColumns';

/** SSRM persists its native Grid State independently from the Infinite instance. */
const SSRM_STATE_KEY = 'transactions:ssrm';

/** One stable feature identity function is shared by AG Grid and reusable capabilities. */
const getTransactionId = (row: Transaction) => row.id;
const getRowId = ({ data }: GetRowIdParams<Transaction>) => getTransactionId(data);

export interface TransactionsSsrmGridProps {
  /** Optional native GridOptions override for tests/embedding. */
  gridOptions?: TransactionsSsrmGridOptions;
}

/**
 * Transactions SSRM root: compose reusable capabilities while keeping native AG Grid wiring explicit.
 *
 * The root owns the one authoritative `GridApi`, Transaction columns/configuration and the visible
 * composition of loading, selection, editing and Grid State capabilities. SSRM-specific selection
 * mechanics live together in `useSsrmSelectionController` rather than being copied by every feature.
 */
export function TransactionsSsrmGrid({
  gridOptions: gridOptionsOverride,
}: TransactionsSsrmGridProps) {
  /** Derived configuration; no independent React state lifecycle is required. */
  const gridOptions =
    gridOptionsOverride ?? transactionsGridConfig.ssrm.gridOptions;

  /**
   * The concrete grid remains the single owner of AG Grid's imperative API. Shared capabilities
   * receive the ref only for their narrowly-scoped native operations.
   */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  /**
   * SSRM selection keeps native explicit/All Records behavior in AG Grid and owns application state
   * only for the missing Select All Filtered semantics.
   */
  const ssrmSelection = useSsrmSelectionController({
    gridApi,
    getRowId: getTransactionId,
  });

  /**
   * SSRM loading owns datasource identity/error/retry mechanics. The same Transaction flat-row loader
   * is shared with Infinite; only the row-model datasource adapter differs.
   */
  const ssrmLoading = useServerSideRowLoading({
    gridApi,
    loadRows: loadTransactionGridRows,
    defaultBlockSize: gridOptions.cacheBlockSize ?? 100,
  });

  /** Editing mechanics are row-model-neutral; Transactions supplies only editable-field semantics. */
  const editing = useTrackedGridEditing(transactionEditingConfig);

  /** Current-page editing resolves targets from the same root GridApi for both Infinite and SSRM. */
  const editActions = useCurrentPageEditActions(
    {
      lastEdit: editing.lastEdit,
      applyChangesToNodes: editing.applyChangesToNodes,
    },
    gridApi,
  );

  /** Persist native AG Grid preferences without introducing an application grid wrapper. */
  const gridState = useGridStatePersistence<Transaction>({
    key: SSRM_STATE_KEY,
  });

  /** Root lifecycle composition stays visible: grid readiness establishes the authoritative API. */
  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;
    },
    [],
  );

  /** Restore accumulated local edits when SSRM first materialises RowNodes. */
  const handleFirstDataRendered = useCallback(
    (event: FirstDataRenderedEvent<Transaction>) =>
      editing.restoreTrackedEdits(event.api),
    [editing.restoreTrackedEdits],
  );

  /** Restore local edits again when SSRM cache/viewport changes materialise different RowNodes. */
  const handleViewportChanged = useCallback(
    (event: ViewportChangedEvent<Transaction>) =>
      editing.restoreTrackedEdits(event.api),
    [editing.restoreTrackedEdits],
  );

  /**
   * A filter change crosses loading and selection capabilities: remove a stale visible load error and
   * invalidate only custom filtered-selection semantics. Native All Records remains meaningful.
   */
  const handleFilterChanged = useCallback(() => {
    ssrmLoading.clearError();
    ssrmSelection.onFilterChanged();
  }, [ssrmLoading.clearError, ssrmSelection.onFilterChanged]);

  return (
    <Stack spacing={2}>
      <TransactionEditingControls
        editedRowCount={editing.editedRowCount}
        lastEdit={editing.lastEdit}
        onApplyLastEdit={editActions.applyLastEdit}
        onApplyBulkEdit={editActions.applyBulkChanges}
      />

      {editActions.error ? (
        <Typography variant="body2" color="warning.main">
          {editActions.error}
        </Typography>
      ) : null}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <Button
          variant="outlined"
          size="small"
          onClick={ssrmSelection.selectCurrentPage}
        >
          Select current page
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={ssrmSelection.selectAllFiltered}
        >
          Select all filtered
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={ssrmSelection.clearSelection}
        >
          Clear selection
        </Button>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        SSRM header checkbox selects all records. Current Page and All Filtered are explicit controls
        because SSRM does not support those native Select-All modes.
      </Typography>

      {ssrmSelection.error ? (
        <Alert severity="warning">{ssrmSelection.error}</Alert>
      ) : null}

      <Box sx={{ height: 620, width: '100%' }}>
        <AgGridReact<Transaction>
          {...gridOptions}
          rowModelType="serverSide"
          serverSideDatasource={ssrmLoading.datasource}
          columnDefs={transactionColumns}
          getRowId={getRowId}
          initialState={gridState.initialState}
          rowSelection={{
            mode: 'multiRow',
            headerCheckbox: true,
            selectAll: 'all',
            groupSelects: 'self',
          }}
          activeOverlay={ssrmLoading.error ? GridErrorOverlay : undefined}
          activeOverlayParams={
            ssrmLoading.error
              ? {
                  message: ssrmLoading.error,
                  onRetry: ssrmLoading.retry,
                }
              : undefined
          }
          onGridReady={handleGridReady}
          onFirstDataRendered={handleFirstDataRendered}
          onViewportChanged={handleViewportChanged}
          onModelUpdated={ssrmSelection.onModelUpdated}
          onRowSelected={ssrmSelection.onRowSelected}
          onSelectionChanged={ssrmSelection.onSelectionChanged}
          onFilterChanged={handleFilterChanged}
          onCellValueChanged={editing.handleCellValueChanged}
          onStateUpdated={gridState.onStateUpdated}
        />
      </Box>
    </Stack>
  );
}
