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
import type { Transaction, TransactionStatus } from '../api/transactions.contracts';
import {
  transactionsGridConfig,
  type TransactionsInfiniteGridOptions,
} from '../transactionsGrid.config';
import { TransactionEditingControls } from './TransactionEditingControls';
import type { TransactionRowEditActionsContext } from './TransactionRowEditActions';
import { TransactionSelectionActions } from './TransactionSelectionActions';
import { transactionEditingConfig } from './transactionEditing';
import { transactionColumns } from './transactionColumns';
import { mapTransactionGridRequest } from './transactionRequest.mapper';
import {
  getTransactionRowClass,
  isTransactionRowSelectable,
} from './transactionRowInteraction';
import {
  buildTransactionSelectionActionRequest,
  hasTransactionSelection,
} from './transactionSelectionAction';
import { useTransactionEditPersistence } from './useTransactionEditPersistence';
import { useTransactionSelectionAction } from './useTransactionSelectionAction';

const INFINITE_STATE_KEY = 'transactions:infinite';
const getTransactionId = (row: Transaction) => row.id;
const getRowId = ({ data }: GetRowIdParams<Transaction>) => getTransactionId(data);

/**
 * AG Grid's Infinite datasource asks for row ranges later through `getRows`. The feature translates
 * those native requests into the Transactions backend contract; the shared Infinite loader owns
 * cancellation/error/cache-lifecycle mechanics.
 */
const loadTransactionRows: GridRowsLoader<Transaction> = (request, context) =>
  listTransactions(mapTransactionGridRequest(request), context.signal);

export interface TransactionsInfiniteGridProps {
  selectionScope?: InfiniteSelectionMode;
  gridOptions?: TransactionsInfiniteGridOptions;
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
}

/**
 * Concrete Transactions Infinite Row Model root.
 *
 * Important AG Grid lifecycle wiring remains visible here on purpose. We share cohesive mechanics in
 * hooks/helpers, but we do not hide the real `AgGridReact`, GridApi, datasource, events or row-model
 * choices behind a generic wrapper.
 */
export function TransactionsInfiniteGrid({
  selectionScope: selectionScopeOverride,
  gridOptions: gridOptionsOverride,
  onSelectionChange,
}: TransactionsInfiniteGridProps) {
  const selectionScope = selectionScopeOverride ?? transactionsGridConfig.infinite.selectionScope;
  const gridOptions = gridOptionsOverride ?? transactionsGridConfig.infinite.gridOptions;

  // One authoritative AG Grid API ref belongs to the grid root. Hooks/actions all consume this same
  // native API instead of creating wrapper APIs or mirrored React state for grid operations.
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  /**
   * Checkbox state stays in AG Grid / compact selection state. This revision counter exists only to
   * make external MUI controls recompute derived values when a native selection event occurs.
   */
  const [, setSelectionRevision] = useState(0);

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
   * Backend writes are authoritative, so ask Infinite Row Model to refresh the cache blocks AG Grid
   * CURRENTLY keeps in memory.
   *
   * `refreshInfiniteCache()` does NOT enumerate/fetch the whole backend dataset. Evicted or never-loaded
   * blocks remain unloaded and are fetched fresh only if the user later navigates to them. Therefore a
   * dataset-wide action can update thousands of backend rows without forcing the browser to load them.
   *
   * If several blocks are resident, one mutation can legitimately be followed by several row-query
   * requests at different offsets. Those are cache refreshes, not repeated mutation calls.
   */
  const handlePersistedRows = useCallback(() => {
    gridApi.current?.refreshInfiniteCache();
  }, []);

  const { saveRow, saveBulk, isSaving, saveError } = useTransactionEditPersistence({
    updates: payload.updates,
    acknowledgeChanges,
    onPersistedRows: handlePersistedRows,
  });

  const {
    applySelectionAction,
    isApplyingSelectionAction,
    selectionActionError,
  } = useTransactionSelectionAction({ onApplied: handlePersistedRows });

  const handleDiscardRow = useCallback(
    (rowId: string) => {
      const api = gridApi.current;
      if (api) discardRow(api, rowId);
    },
    [discardRow],
  );

  /** Bulk Save/Discard acts only on rows that are both dirty and currently selected. */
  const selectionIntent = readSelectionIntent();
  const selectedDirtyUpdates = buildSelectedTrackedGridUpdatePayload(state, selectionIntent).updates;

  const handleSaveSelected = useCallback(() => {
    const updates = buildSelectedTrackedGridUpdatePayload(state, readSelectionIntent()).updates;
    saveBulk(updates);
  }, [readSelectionIntent, saveBulk, state]);

  const handleDiscardSelected = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    const updates = buildSelectedTrackedGridUpdatePayload(state, readSelectionIntent()).updates;
    discardRows(
      api,
      updates.map((update) => update.id),
    );
  }, [discardRows, readSelectionIntent, state]);

  const handleSetSelectedStatus = useCallback(
    (status: TransactionStatus) => {
      const api = gridApi.current;
      if (!api) return;

      // Read the logical selection when the user clicks the action. Dataset-wide Infinite selection can
      // describe rows that have no RowNode, so loaded `getSelectedRows()` is not the business boundary.
      const currentSelection = readSelectionIntent();
      if (!hasTransactionSelection(currentSelection)) return;

      applySelectionAction(
        buildTransactionSelectionActionRequest(
          currentSelection,
          // Only Select All Filtered attaches the current translated filter universe. Page/manual and
          // All Records do not let the visible filter redefine their membership.
          selectionScope === 'filtered' ? 'filtered' : 'all',
          api.getFilterModel(),
          { status },
        ),
      );
    },
    [applySelectionAction, readSelectionIntent, selectionScope],
  );

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

  /**
   * Cell renderers consume AG Grid `context`, which sits outside normal React props. Update the native
   * context with current callbacks/state and refresh only the Actions column rather than redrawing the
   * whole grid.
   */
  useEffect(() => {
    const api = gridApi.current;
    if (!api) return;

    api.setGridOption('context', rowEditActionsContext);
    api.refreshCells({ columns: ['editActions'], force: true });
  }, [rowEditActionsContext]);

  const { initialState, onStateUpdated } = useGridStatePersistence<Transaction>({
    key: INFINITE_STATE_KEY,
  });

  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      // Capture exactly the GridApi AG Grid created. This root remains the API owner.
      gridApi.current = event.api;

      // GridReady can happen before Infinite RowNodes finish materialising. Defer one turn so custom
      // dataset selection can reconcile against whatever AG Grid has loaded immediately afterward.
      window.setTimeout(syncSelectionAfterRowsChange, 0);
    },
    [syncSelectionAfterRowsChange],
  );

  /**
   * Infinite can recreate RowNodes after model updates, pagination and cache refreshes. Reconcile
   * checkbox presentation and restore still-unsaved drafts each time those loaded nodes change.
   */
  const handleRowsChanged = useCallback(() => {
    syncSelectionAfterRowsChange();
    const api = gridApi.current;
    if (api) restoreTrackedEdits(api);
  }, [restoreTrackedEdits, syncSelectionAfterRowsChange]);

  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<Transaction>) => {
      onSelectionChanged(event);

      // Only force external controls to recalculate. Native selection remains in AG Grid / logical
      // selection controller rather than being copied into React component state.
      setSelectionRevision((revision) => revision + 1);
    },
    [onSelectionChanged],
  );

  const handleFilterChanged = useCallback(() => {
    clearLoadError();

    // Only filter-dependent dataset selection is reset. Explicit IDs and All Records keep their
    // original meaning when the visible filter changes.
    resetFilterDependentSelection();
  }, [clearLoadError, resetFilterDependentSelection]);

  return (
    <Stack spacing={2}>
      <TransactionSelectionActions
        hasSelection={hasTransactionSelection(selectionIntent)}
        isApplying={isApplyingSelectionAction}
        error={selectionActionError}
        onSetStatus={handleSetSelectedStatus}
      />

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
          // Stable backend identity lets native selection + draft restoration survive RowNode recreation.
          getRowId={getRowId}
          // Presentation only: shared helper maps interaction mode to default/overridden CSS classes.
          getRowClass={getTransactionRowClass}
          initialState={initialState}
          rowSelection={{
            mode: 'multiRow',

            // Infinite header behaviour depends on our configured page/filtered/all semantic, so the
            // selection column supplies its own header instead of enabling AG Grid's default header.
            headerCheckbox: false,

            // Selection is checkbox/action driven in this demo. Clicking arbitrary row content should
            // not silently toggle business selection.
            enableClickSelection: false,

            // Native loaded-row eligibility boundary. AG Grid evaluates this callback and stores the
            // result in `RowNode.selectable`. Both the custom page header and filtered/all reconciliation
            // read that native flag, so restricted rows are never passed to selection APIs and never
            // manufactured into logical exclude IDs.
            isRowSelectable: isTransactionRowSelectable,
          }}
          selectionColumnDef={selectionColumnDef}
          activeOverlay={loadError ? GridErrorOverlay : undefined}
          activeOverlayParams={loadError ? { message: loadError, onRetry: retryLoad } : undefined}
          onGridReady={handleGridReady}
          // Both events can materialise/recreate Infinite RowNodes that need selection/draft reconciliation.
          onModelUpdated={handleRowsChanged}
          onPaginationChanged={handleRowsChanged}
          onRowSelected={onRowSelected}
          onSelectionChanged={handleSelectionChanged}
          onFilterChanged={handleFilterChanged}
          // AG Grid emits this after a committed value change; tracked editing filters out its own
          // programmatic `setDataValue` writes using a source tag + synchronous ref guard.
          onCellValueChanged={handleCellValueChanged}
          onStateUpdated={onStateUpdated}
        />
      </Box>
    </Stack>
  );
}
