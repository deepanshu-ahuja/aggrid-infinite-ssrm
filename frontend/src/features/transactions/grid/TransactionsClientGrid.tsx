// GRIDCAP-ROWMODEL-CLIENT | GRIDCAP-DATA-LOAD | GRIDCAP-ROW-ID | GRIDCAP-SEL-MANUAL | GRIDCAP-SEL-PAGE | GRIDCAP-SEL-FILTERED | GRIDCAP-SEL-ALL | GRIDCAP-COUNT-SELECTED | GRIDCAP-ACTION-SELECTED | GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-SAVE-ROW | GRIDCAP-EDIT-SAVE-SELECTED | GRIDCAP-EDIT-DISCARD | GRIDCAP-EDIT-CONFLICT | GRIDCAP-COUNT-EDITED | GRIDCAP-EXPORT-PAGE | GRIDCAP-EXPORT-SELECTED | GRIDCAP-STATE-PERSISTENCE | GRIDCAP-ERROR-RETRY | GRIDCAP-LIFECYCLE-REFRESH | GRIDCAP-LIFECYCLE-DESTROY | GRIDCAP-ROW-ELIGIBILITY | GRIDCAP-COLUMNS
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type {
  CellClickedEvent,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  RowDataUpdatedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import {
  buildSelectedTrackedGridUpdatePayload,
  hasSelectedTrackedGridFieldConflict,
  hasTrackedGridFieldConflict,
  hasTrackedGridRowConflict,
  hasTrackedGridUpdateConflict,
} from '@/shared/grid/editing/trackedGridEditing';
import { useCurrentPageEditActions } from '@/shared/grid/editing/useCurrentPageEditActions';
import { useTrackedGridEditing } from '@/shared/grid/editing/useTrackedGridEditing';
import { exportCurrentPageCsv } from '@/shared/grid/export/exportCurrentPageCsv';
import { exportSelectedRowsCsv } from '@/shared/grid/export/exportSelectedRowsCsv';
import { GridErrorOverlay } from '@/shared/grid/overlays/GridErrorOverlay';
import {
  useClientSideSelectionController,
  type ClientSideSelectionIntent,
  type ClientSideSelectionScope,
} from '@/shared/grid/selection/client-side/useClientSideSelectionController';
import { useGridStatePersistence } from '@/shared/grid/state/useGridStatePersistence';
import { useClientTransactions } from '../api/transactions.queries';
import type { Transaction, TransactionStatus } from '../api/transactions.contracts';
import {
  transactionsGridConfig,
  type TransactionsClientGridOptions,
} from '../transactionsGrid.config';
import { TransactionEditConflictPopover } from './TransactionEditConflictPopover';
import { TransactionEditingControls } from './TransactionEditingControls';
import { TransactionExportActions } from './TransactionExportActions';
import type { TransactionRowEditActionsContext } from './TransactionRowEditActions';
import { TransactionSelectionActions } from './TransactionSelectionActions';
import {
  isTransactionEditableField,
  transactionEditingConfig,
  TRANSACTION_EDITABLE_FIELDS,
  type TransactionEditableField,
} from './transactionEditing';
import { transactionClientColumns } from './transactionColumns';
import {
  getTransactionRowClass,
  isTransactionRowSelectable,
} from './transactionRowInteraction';
import type { SelectionAfterSuccessPolicy } from './transactionSelectionAction';
import { useTransactionEditPersistence } from './useTransactionEditPersistence';
import { useTransactionSelectionAction } from './useTransactionSelectionAction';

const CLIENT_STATE_KEY = 'transactions:client';
const getTransactionId = (row: Transaction) => row.id;
const getRowId = ({ data }: GetRowIdParams<Transaction>) => getTransactionId(data);
const EMPTY_CLIENT_SELECTION: ClientSideSelectionIntent = { mode: 'include', ids: [] };

interface ConflictTarget {
  rowId: string;
  field: TransactionEditableField;
  anchorEl: HTMLElement;
}

export interface TransactionsClientGridProps {
  selectionScope?: ClientSideSelectionScope;
  gridOptions?: TransactionsClientGridOptions;
  onSelectionChange?: (selection: ClientSideSelectionIntent) => void;
}

/**
 * Concrete Transactions Client-Side Row Model root.
 *
 * The complete bounded working set is fetched once through TanStack Query and passed to native AG Grid
 * `rowData`. From that point AG Grid owns sorting, filtering, pagination and checkbox selection locally.
 * Shared Transaction editing/conflict/row-policy mechanics are reused, but no Infinite datasource,
 * SSRM store state, or unloaded-row selection representation is imported into this root.
 *
 * This concrete root is intentionally a multi-capability integration boundary. The GRIDCAP markers at
 * the top are an extraction map, not a signal that these concerns should be hidden behind one wrapper.
 */
export function TransactionsClientGrid({
  selectionScope: selectionScopeOverride,
  gridOptions: gridOptionsOverride,
  onSelectionChange,
}: TransactionsClientGridProps) {
  const selectionScope = selectionScopeOverride ?? transactionsGridConfig.client.selectionScope;
  const gridOptions = gridOptionsOverride ?? transactionsGridConfig.client.gridOptions;
  const gridApi = useRef<GridApi<Transaction> | null>(null);
  const [selectionSnapshot, setSelectionSnapshot] =
    useState<ClientSideSelectionIntent>(EMPTY_CLIENT_SELECTION);
  const [conflictTarget, setConflictTarget] = useState<ConflictTarget | null>(null);
  const [exportError, setExportError] = useState<string>();

  const {
    rows,
    isLoading,
    error: loadError,
    refetch,
    applyAuthoritativeRows,
  } = useClientTransactions();

  const publishSelection = useCallback(
    (selection: ClientSideSelectionIntent) => {
      // This React snapshot exists only for renderable selected/dirty intersections. AG Grid remains
      // authoritative and every business action re-reads native selected rows at action time.
      setSelectionSnapshot(selection);
      onSelectionChange?.(selection);
    },
    [onSelectionChange],
  );

  const {
    rowSelection,
    selectedRowCount,
    readSelectionIntent,
    clearSelection,
    onSelectionChanged,
    onFilterChanged,
  } = useClientSideSelectionController({
    gridApi,
    scope: selectionScope,
    getRowId: getTransactionId,
    isRowSelectable: isTransactionRowSelectable,
    onSelectionChange: publishSelection,
  });

  const {
    state,
    payload,
    editedRowCount,
    conflictCount,
    lastEdit,
    applyChangesToNodes,
    restoreTrackedEdits,
    handleCellValueChanged,
    acknowledgeChanges,
    discardRow,
    discardRows,
    resolveConflictWithRemote,
    resolveConflictWithLocal,
  } = useTrackedGridEditing(transactionEditingConfig);

  const {
    error: editActionError,
    applyLastEdit,
    applyBulkChanges,
  } = useCurrentPageEditActions({ lastEdit, applyChangesToNodes }, gridApi);

  const { saveRow, saveBulk, isSaving, saveError } = useTransactionEditPersistence({
    updates: payload.updates,
    acknowledgeChanges,
    // Explicit Save endpoints already return authoritative rows, including recomputed interaction
    // policy. Merge those rows directly into the Client query cache instead of refetching all 750 rows.
    onPersistedRows: applyAuthoritativeRows,
  });

  const handleSelectionActionApplied = useCallback(
    (selectionAfterSuccess: SelectionAfterSuccessPolicy) => {
      // GRIDCAP-ACTION-SELECTED | GRIDCAP-LIFECYCLE-REFRESH
      // The feature action chooses whether its successful mutation keeps or clears checkbox state.
      // Client selection is fully native, so delegate clearing to the Client selection controller.
      if (selectionAfterSuccess === 'clear') clearSelection();

      // Selection status API returns only updatedCount. Refetch the bounded collection so Client rowData
      // receives authoritative changed values/policy; stable getRowId lets AG Grid reconcile row identity.
      void refetch();
    },
    [clearSelection, refetch],
  );

  const {
    applySelectionAction,
    isApplyingSelectionAction,
    selectionActionError,
  } = useTransactionSelectionAction({ onApplied: handleSelectionActionApplied });

  const hasSelection = selectedRowCount > 0;
  const selectedDirtyUpdates = buildSelectedTrackedGridUpdatePayload(state, selectionSnapshot).updates;
  const selectedEditsHaveConflict = hasTrackedGridUpdateConflict(state, selectedDirtyUpdates);
  const statusActionBlockedByConflict = hasSelectedTrackedGridFieldConflict(
    state,
    selectionSnapshot,
    ['status'],
  );

  const handleDiscardRow = useCallback(
    (rowId: string) => {
      const api = gridApi.current;
      if (!api) return;
      discardRow(api, rowId);
      if (conflictTarget?.rowId === rowId) setConflictTarget(null);
    },
    [conflictTarget?.rowId, discardRow],
  );

  const handleSaveSelected = useCallback(() => {
    const updates = buildSelectedTrackedGridUpdatePayload(state, readSelectionIntent()).updates;
    if (hasTrackedGridUpdateConflict(state, updates)) return;
    saveBulk(updates);
  }, [readSelectionIntent, saveBulk, state]);

  const handleDiscardSelected = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    const updates = buildSelectedTrackedGridUpdatePayload(state, readSelectionIntent()).updates;
    discardRows(api, updates.map((update) => update.id));
    if (conflictTarget && updates.some((update) => update.id === conflictTarget.rowId)) {
      setConflictTarget(null);
    }
  }, [conflictTarget, discardRows, readSelectionIntent, state]);

  const handleSetSelectedStatus = useCallback(
    (status: TransactionStatus, selectionAfterSuccess: SelectionAfterSuccessPolicy) => {
      const currentSelection = readSelectionIntent();
      if (
        currentSelection.ids.length === 0 ||
        hasSelectedTrackedGridFieldConflict(state, currentSelection, ['status'])
      ) {
        return;
      }

      // Every Client-Side selected row is concrete and therefore expressible as an explicit include
      // target. The wire contract deliberately omits filters for include selections because exact IDs
      // already define the complete target; backend filter translation is only needed for exclude mode.
      applySelectionAction(
        {
          selection: currentSelection,
          changes: { status },
        },
        selectionAfterSuccess,
      );
    },
    [applySelectionAction, readSelectionIntent, state],
  );

  const handleExportCurrentPage = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    const result = exportCurrentPageCsv(api, 'transactions-client-current-page.csv');
    setExportError(result.ok ? undefined : result.error);
  }, []);

  const handleExportSelected = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    const result = exportSelectedRowsCsv(api, 'transactions-client-selected.csv');
    setExportError(result.ok ? undefined : result.error);
  }, []);

  const rowEditActionsContext = useMemo<TransactionRowEditActionsContext>(
    () => ({
      isRowDirty: (rowId) => Boolean(state.changesById[rowId]),
      isRowConflicted: (rowId) => hasTrackedGridRowConflict(state, rowId),
      isCellConflicted: (rowId, field) => hasTrackedGridFieldConflict(state, rowId, field),
      getCellConflict: (rowId, field) => {
        const conflict = state.conflictsById[rowId]?.[field];
        const localValue = state.changesById[rowId]?.[field];
        return conflict && localValue !== undefined
          ? { localValue, remoteValue: conflict.remoteValue }
          : undefined;
      },
      isSaving,
      onSaveRow: (rowId) => {
        if (!hasTrackedGridRowConflict(state, rowId)) saveRow(rowId);
      },
      onDiscardRow: handleDiscardRow,
    }),
    [handleDiscardRow, isSaving, saveRow, state],
  );

  useEffect(() => {
    const api = gridApi.current;
    if (!api) return;

    api.setGridOption('context', rowEditActionsContext);
    api.refreshCells({ columns: [...TRANSACTION_EDITABLE_FIELDS, 'editActions'], force: true });
  }, [rowEditActionsContext]);

  const { initialState, onStateUpdated } = useGridStatePersistence<Transaction>({
    key: CLIENT_STATE_KEY,
  });

  const handleGridReady = useCallback((event: GridReadyEvent<Transaction>) => {
    gridApi.current = event.api;
  }, []);

  const handleRowDataUpdated = useCallback(
    (event: RowDataUpdatedEvent<Transaction>) => {
      // GRIDCAP-EDIT-CONFLICT | GRIDCAP-LIFECYCLE-REFRESH
      // A new Client rowData projection represents authoritative query data. Reconcile it against
      // durable LOCAL drafts before overlaying those drafts back onto the newly-created row objects.
      restoreTrackedEdits(event.api);
    },
    [restoreTrackedEdits],
  );

  const handleCellClicked = useCallback(
    (event: CellClickedEvent<Transaction>) => {
      if (!event.data) return;
      const candidateField = event.colDef.field as string | undefined;
      if (!isTransactionEditableField(candidateField)) return;
      if (!hasTrackedGridFieldConflict(state, event.data.id, candidateField)) return;

      const target = event.event?.target;
      const anchorEl = target instanceof Element ? target.closest('.ag-cell') : null;
      if (!(anchorEl instanceof HTMLElement)) return;

      setConflictTarget({ rowId: event.data.id, field: candidateField, anchorEl });
    },
    [state],
  );

  // The popover is React presentation, so derive it directly from React editing state. Do not route
  // render-time reads through AG Grid context callbacks: those callbacks are intended for grid events
  // and cell renderers, while the React tree should render from React-owned tracked-edit state.
  const activeConflict = useMemo(() => {
    if (!conflictTarget) return undefined;
    const conflict = state.conflictsById[conflictTarget.rowId]?.[conflictTarget.field];
    const localValue = state.changesById[conflictTarget.rowId]?.[conflictTarget.field];
    return conflict && localValue !== undefined
      ? { localValue, remoteValue: conflict.remoteValue }
      : undefined;
  }, [conflictTarget, state.changesById, state.conflictsById]);

  return (
    <Stack spacing={2}>
      <TransactionSelectionActions
        hasSelection={hasSelection}
        selectedRowCount={selectedRowCount}
        isApplying={isApplyingSelectionAction}
        statusActionBlockedByConflict={statusActionBlockedByConflict}
        error={selectionActionError}
        onSetStatus={handleSetSelectedStatus}
      />

      <TransactionExportActions
        hasSelection={hasSelection}
        isExportingSelected={false}
        error={exportError}
        onExportCurrentPage={handleExportCurrentPage}
        onExportSelected={handleExportSelected}
      />

      <TransactionEditingControls
        editedRowCount={editedRowCount}
        conflictCount={conflictCount}
        selectedEditedRowCount={selectedDirtyUpdates.length}
        selectedEditsHaveConflict={selectedEditsHaveConflict}
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
          rowModelType="clientSide"
          rowData={rows}
          loading={isLoading}
          columnDefs={transactionClientColumns}
          context={rowEditActionsContext}
          getRowId={getRowId}
          getRowClass={getTransactionRowClass}
          initialState={initialState}
          rowSelection={rowSelection}
          activeOverlay={loadError ? GridErrorOverlay : undefined}
          activeOverlayParams={
            loadError ? { message: loadError, onRetry: () => void refetch() } : undefined
          }
          onGridReady={handleGridReady}
          // GRIDCAP-LIFECYCLE-DESTROY
          // The concrete root owns this API ref. Clear it before AG Grid destroys the instance so
          // asynchronous callbacks/effects cannot retain and call a stale GridApi during teardown.
          onGridPreDestroyed={() => {
            gridApi.current = null;
          }}
          onRowDataUpdated={handleRowDataUpdated}
          onSelectionChanged={onSelectionChanged}
          onFilterChanged={onFilterChanged}
          onCellClicked={handleCellClicked}
          onCellValueChanged={handleCellValueChanged}
          onStateUpdated={onStateUpdated}
        />
      </Box>

      <TransactionEditConflictPopover
        anchorEl={activeConflict ? conflictTarget?.anchorEl ?? null : null}
        field={conflictTarget?.field}
        localValue={activeConflict?.localValue}
        remoteValue={activeConflict?.remoteValue}
        onClose={() => setConflictTarget(null)}
        onUseServer={() => {
          const api = gridApi.current;
          if (!api || !conflictTarget) return;
          resolveConflictWithRemote(api, conflictTarget.rowId, conflictTarget.field);
          setConflictTarget(null);
        }}
        onKeepLocal={() => {
          if (!conflictTarget) return;
          resolveConflictWithLocal(conflictTarget.rowId, conflictTarget.field);
          setConflictTarget(null);
        }}
      />
    </Stack>
  );
}
