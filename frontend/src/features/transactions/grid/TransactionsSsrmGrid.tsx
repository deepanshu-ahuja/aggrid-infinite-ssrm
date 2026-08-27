import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type {
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import type { GridRowsLoader } from '@/shared/grid/data/gridData.types';
import { useServerSideRowLoading } from '@/shared/grid/data/server-side/useServerSideRowLoading';
import { buildSelectedTrackedGridUpdatePayload } from '@/shared/grid/editing/trackedGridEditing';
import { useCurrentPageEditActions } from '@/shared/grid/editing/useCurrentPageEditActions';
import { useTrackedGridEditing } from '@/shared/grid/editing/useTrackedGridEditing';
import { GridErrorOverlay } from '@/shared/grid/overlays/GridErrorOverlay';
import { useSsrmSelectionController } from '@/shared/grid/selection/server-side/useSsrmSelectionController';
import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';
import { useGridStatePersistence } from '@/shared/grid/state/useGridStatePersistence';
import { listTransactions } from '../api/transactions.api';
import type { Transaction, TransactionStatus } from '../api/transactions.contracts';
import {
  transactionsGridConfig,
  type TransactionsSsrmGridOptions,
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

const SSRM_STATE_KEY = 'transactions:ssrm';
const getTransactionId = (row: Transaction) => row.id;
const getRowId = ({ data }: GetRowIdParams<Transaction>) => getTransactionId(data);
const EMPTY_SELECTION: ServerSelectionIntent<string> = { mode: 'include', ids: [] };

/**
 * AG Grid's SSRM datasource asks for row ranges later through `getRows`. Keep the loader feature-owned:
 * it translates AG Grid's request into the Transactions backend contract, while the shared datasource
 * hook owns cancellation/error/lifecycle mechanics.
 */
const loadTransactionRows: GridRowsLoader<Transaction> = (request, context) =>
  listTransactions(mapTransactionGridRequest(request), context.signal);

export interface TransactionsSsrmGridProps {
  gridOptions?: TransactionsSsrmGridOptions;
}

/**
 * Concrete Transactions SSRM root.
 *
 * This is intentionally where the important AG Grid capabilities are visibly composed. We do not hide
 * `AgGridReact`, `GridApi`, row-model events, selection wiring or editing wiring behind a generic grid
 * wrapper because a developer debugging SSRM lifecycle needs to see those native boundaries.
 */
export function TransactionsSsrmGrid({
  gridOptions: gridOptionsOverride,
}: TransactionsSsrmGridProps) {
  const gridOptions = gridOptionsOverride ?? transactionsGridConfig.ssrm.gridOptions;

  // One authoritative AG Grid API ref belongs to the concrete root. Hooks receive this same ref instead
  // of creating wrapper APIs or mirrored React state for grid operations.
  const gridApi = useRef<GridApi<Transaction> | null>(null);
  const [isGridReady, setIsGridReady] = useState(false);

  /**
   * Checkbox state itself stays inside AG Grid. This revision counter exists only because the external
   * MUI action controls render outside the grid and need React to recalculate their derived state after
   * native selection changes.
   */
  const [, setSelectionRevision] = useState(0);

  const {
    error: selectionError,
    isFilteredSelectAllActive,
    readSelectionIntent,
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
   * Backend writes are authoritative. `refreshServerSide()` tells SSRM to ask its datasource for fresh
   * server rows using SSRM's own cache/lifecycle instead of us patching RowNodes manually.
   */
  const handlePersistedRows = useCallback(() => {
    gridApi.current?.refreshServerSide();
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
  const selectionIntent = isGridReady ? readSelectionIntent() : EMPTY_SELECTION;
  const selectedDirtyUpdates = isGridReady
    ? buildSelectedTrackedGridUpdatePayload(state, selectionIntent).updates
    : [];

  const handleSaveSelected = useCallback(() => {
    if (!gridApi.current) return;

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

      // Always read logical selection at click time. Native SSRM may represent All Records across rows
      // that are not loaded, so `api.getSelectedRows()` would be the wrong business-action boundary.
      const currentSelection = readSelectionIntent();
      if (!hasTransactionSelection(currentSelection)) return;

      applySelectionAction(
        buildTransactionSelectionActionRequest(
          currentSelection,
          // Only our custom filtered-wide mode adds translated filters. Native All Records deliberately
          // sends no filters so Python targets the whole eligible dataset.
          isFilteredSelectAllActive ? 'filtered' : 'all',
          api.getFilterModel(),
          { status },
        ),
      );
    },
    [applySelectionAction, isFilteredSelectAllActive, readSelectionIntent],
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
   * AG Grid cell renderers receive `context` outside React's normal prop tree. Push the latest callback
   * references into the native grid context, then redraw only the Actions column so row renderers see
   * current dirty/saving state without recreating the whole grid.
   */
  useEffect(() => {
    const api = gridApi.current;
    if (!api) return;

    api.setGridOption?.('context', rowEditActionsContext);
    api.refreshCells?.({ columns: ['editActions'], force: true });
  }, [rowEditActionsContext]);

  const { initialState, onStateUpdated } = useGridStatePersistence<Transaction>({
    key: SSRM_STATE_KEY,
  });

  const handleGridReady = useCallback((event: GridReadyEvent<Transaction>) => {
    // Capture exactly the GridApi instance AG Grid created. Other hooks/actions share this same ref.
    gridApi.current = event.api;
    setIsGridReady(true);
  }, []);

  /**
   * `modelUpdated` means SSRM's displayed RowNodes may have been loaded/replaced/recreated. Reconcile
   * custom filtered checkbox presentation and restore still-unsaved drafts onto the new RowNodes.
   */
  const handleModelUpdated = useCallback(() => {
    syncSelectionAfterRowsChange();
    const api = gridApi.current;
    if (api) restoreTrackedEdits(api);
  }, [restoreTrackedEdits, syncSelectionAfterRowsChange]);

  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<Transaction>) => {
      // First let the SSRM selection controller handle native-vs-custom ownership transitions.
      onSelectionChanged(event);

      // Then trigger only a React re-render for external action controls; selected IDs remain AG Grid-owned.
      setSelectionRevision((revision) => revision + 1);
    },
    [onSelectionChanged],
  );

  const handleFilterChanged = useCallback(() => {
    clearLoadError();

    // Custom Select All Filtered belongs to the old filter universe, so it must be cleared. Native All
    // Records and explicit native selections are intentionally preserved by the selection controller.
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
        SSRM header checkbox selects all records. Current Page and All Filtered are explicit
        controls because SSRM does not support those native Select-All modes.
      </Typography>

      {selectionError ? <Alert severity="warning">{selectionError}</Alert> : null}

      <Box sx={{ height: 620, width: '100%' }}>
        <AgGridReact<Transaction>
          {...gridOptions}
          rowModelType="serverSide"
          serverSideDatasource={datasource}
          columnDefs={transactionColumns}
          context={rowEditActionsContext}
          // Stable backend identity is mandatory for selection/edit restoration when SSRM recreates nodes.
          getRowId={getRowId}
          // Shared interaction class helper supplies restricted-row presentation only; it does not enforce behavior.
          getRowClass={getTransactionRowClass}
          initialState={initialState}
          rowSelection={{
            mode: 'multiRow',

            // SSRM DOES support native All Records. Keep the native header enabled instead of replacing
            // it with an application header and duplicating server-side selection state.
            headerCheckbox: true,
            selectAll: 'all',

            // This controller is intentionally flat-row selection. Group/tree selection would produce
            // a different server-side selection-state shape and needs a separate design.
            groupSelects: 'self',

            // This is the native loaded-row eligibility boundary. AG Grid evaluates it and writes the
            // result to `RowNode.selectable`; shared Current Page / All Filtered mechanics consume that
            // native flag. Restricted rows are therefore never passed into selection API calls and are
            // never converted into frontend exclude IDs.
            isRowSelectable: isTransactionRowSelectable,
          }}
          activeOverlay={loadError ? GridErrorOverlay : undefined}
          activeOverlayParams={loadError ? { message: loadError, onRetry: retryLoad } : undefined}
          onGridReady={handleGridReady}
          // Model changes are where newly materialised SSRM RowNodes need selection/draft reconciliation.
          onModelUpdated={handleModelUpdated}
          onRowSelected={onRowSelected}
          onSelectionChanged={handleSelectionChanged}
          onFilterChanged={handleFilterChanged}
          // AG Grid fires this only after a cell value is committed; the tracked-edit hook distinguishes
          // real user commits from its own programmatic `setDataValue` writes.
          onCellValueChanged={handleCellValueChanged}
          onStateUpdated={onStateUpdated}
        />
      </Box>
    </Stack>
  );
}
