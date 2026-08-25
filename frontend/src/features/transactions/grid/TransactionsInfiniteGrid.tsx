import { useCallback, useRef } from 'react';
import { Alert, Box, Stack, Typography } from '@mui/material';
import type {
  FirstDataRenderedEvent,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  ViewportChangedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
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
import { loadTransactionGridRows } from './loadTransactionGridRows';
import { TransactionEditingControls } from './TransactionEditingControls';
import { transactionEditingConfig } from './transactionEditing';
import { transactionColumns } from './transactionColumns';

/** Infinite and SSRM persist independent native AG Grid state for the same Transaction feature. */
const INFINITE_STATE_KEY = 'transactions:infinite';

/** One stable feature identity function is shared by AG Grid and reusable selection/edit capabilities. */
const getTransactionId = (row: Transaction) => row.id;
const getRowId = ({ data }: GetRowIdParams<Transaction>) => getTransactionId(data);

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
 * The root intentionally owns only cross-capability orchestration and feature composition:
 * - one authoritative `GridApi`;
 * - Transaction columns/config/API-specific count loader;
 * - editing + Infinite selection + Infinite row-loading capabilities;
 * - native AG Grid event/prop wiring.
 *
 * Row-model mechanics themselves live under `shared/grid`; Transactions-specific request/API logic
 * remains under the feature. This keeps the next Infinite table from copying lifecycle machinery while
 * avoiding a broad wrapper around `AgGridReact`.
 */
export function TransactionsInfiniteGrid({
  selectionScope: selectionScopeOverride,
  gridOptions: gridOptionsOverride,
  onSelectionChange,
}: TransactionsInfiniteGridProps) {
  /** Derived configuration has no independent lifecycle and therefore does not need React state. */
  const selectionScope =
    selectionScopeOverride ?? transactionsGridConfig.infinite.selectionScope;
  const gridOptions =
    gridOptionsOverride ?? transactionsGridConfig.infinite.gridOptions;

  /**
   * The root remains the single owner of AG Grid's imperative API. Capability hooks receive the ref
   * so they can perform narrowly-scoped native operations without introducing another API owner.
   */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  /**
   * All-record Infinite selection needs one unfiltered count. The lifecycle is generic, but the API
   * request remains Transaction-specific. Limit 1 avoids transferring a full page for a count only.
   */
  const loadAllTotal = useCallback(async (signal: AbortSignal) => {
    const { totalCount } = await listTransactions(
      { offset: 0, limit: 1, sort: [], filters: [] },
      signal,
    );
    return totalCount;
  }, []);

  /**
   * One cohesive Infinite-selection capability owns totals, logical dataset selection, loaded-row
   * reconciliation, selection-column headers and row-model-specific selection events.
   */
  const infiniteSelection = useInfiniteSelectionController({
    gridApi,
    scope: selectionScope,
    getRowId: getTransactionId,
    loadAllTotal,
    onSelectionChange,
  });

  /**
   * Infinite loading owns datasource identity/error/retry mechanics. The feature loader itself is
   * shared with SSRM because both row-model adapters already emit the same flat block request.
   */
  const infiniteLoading = useInfiniteRowLoading({
    gridApi,
    loadRows: loadTransactionGridRows,
  });

  /** Transaction configuration supplies only editable fields/identity; edit state is row-model-neutral. */
  const editing = useTrackedGridEditing(transactionEditingConfig);

  /** Current-page edit actions are also row-model-neutral and resolve targets from the root GridApi. */
  const editActions = useCurrentPageEditActions(
    {
      lastEdit: editing.lastEdit,
      applyChangesToNodes: editing.applyChangesToNodes,
    },
    gridApi,
  );

  /** Persist native AG Grid preference state without hiding native props behind an application wrapper. */
  const gridState = useGridStatePersistence<Transaction>({
    key: INFINITE_STATE_KEY,
  });

  /**
   * Root lifecycle orchestration stays visible: capture the authoritative API first, then let the
   * Infinite selection capability read model-derived state after AG Grid materialises initial rows.
   */
  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;
      window.setTimeout(infiniteSelection.onRowsChanged, 0);
    },
    [infiniteSelection.onRowsChanged],
  );

  /** Restore accumulated unsaved edits when initial Infinite RowNodes materialise. */
  const handleFirstDataRendered = useCallback(
    (event: FirstDataRenderedEvent<Transaction>) =>
      editing.restoreTrackedEdits(event.api),
    [editing.restoreTrackedEdits],
  );

  /** Restore edits again when pagination/cache churn creates a different set of RowNodes. */
  const handleViewportChanged = useCallback(
    (event: ViewportChangedEvent<Transaction>) =>
      editing.restoreTrackedEdits(event.api),
    [editing.restoreTrackedEdits],
  );

  /**
   * Filter change crosses two capabilities: a fresh query should not show an old loading error, and
   * Infinite selection must invalidate query-derived totals/filtered selection where appropriate.
   */
  const handleFilterChanged = useCallback(() => {
    infiniteLoading.clearError();
    infiniteSelection.onFilterChanged();
  }, [infiniteLoading.clearError, infiniteSelection.onFilterChanged]);

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

      {infiniteSelection.supportError ? (
        <Alert severity="error">{infiniteSelection.supportError}</Alert>
      ) : null}

      <Box sx={{ height: 620, width: '100%' }}>
        <AgGridReact<Transaction>
          {...gridOptions}
          rowModelType="infinite"
          datasource={infiniteLoading.datasource}
          columnDefs={transactionColumns}
          getRowId={getRowId}
          initialState={gridState.initialState}
          rowSelection={{
            mode: 'multiRow',
            headerCheckbox: false,
            enableClickSelection: false,
          }}
          selectionColumnDef={infiniteSelection.selectionColumnDef}
          activeOverlay={
            infiniteLoading.error ? GridErrorOverlay : undefined
          }
          activeOverlayParams={
            infiniteLoading.error
              ? {
                  message: infiniteLoading.error,
                  onRetry: infiniteLoading.retry,
                }
              : undefined
          }
          onGridReady={handleGridReady}
          onFirstDataRendered={handleFirstDataRendered}
          onViewportChanged={handleViewportChanged}
          onModelUpdated={infiniteSelection.onRowsChanged}
          onPaginationChanged={infiniteSelection.onRowsChanged}
          onRowSelected={infiniteSelection.onRowSelected}
          onSelectionChanged={infiniteSelection.onSelectionChanged}
          onFilterChanged={handleFilterChanged}
          onCellValueChanged={editing.handleCellValueChanged}
          onStateUpdated={gridState.onStateUpdated}
        />
      </Box>
    </Stack>
  );
}
