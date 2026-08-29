// GRIDCAP-ROWMODEL-CLIENT | GRIDCAP-DATA-LOAD | GRIDCAP-ROW-ID | GRIDCAP-SEL-MANUAL | GRIDCAP-SEL-PAGE | GRIDCAP-SEL-FILTERED | GRIDCAP-SEL-ALL | GRIDCAP-COUNT-SELECTED | GRIDCAP-ACTION-SELECTED | GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-SAVE-ROW | GRIDCAP-EDIT-SAVE-SELECTED | GRIDCAP-EDIT-DISCARD | GRIDCAP-EDIT-CONFLICT | GRIDCAP-EDIT-VALIDATION | GRIDCAP-COUNT-EDITED | GRIDCAP-IMPORT | GRIDCAP-EXPORT-PAGE | GRIDCAP-EXPORT-SELECTED | GRIDCAP-STATE-PERSISTENCE | GRIDCAP-ERROR-RETRY | GRIDCAP-LIFECYCLE-REFRESH | GRIDCAP-LIFECYCLE-DESTROY | GRIDCAP-ROW-ELIGIBILITY | GRIDCAP-COLUMNS
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
import {
  hasGridFieldValidationError,
  hasGridRowValidationError,
  hasGridUpdateValidationError,
} from '@/shared/grid/validation/gridValidation';
import { useClientTransactions } from '../api/transactions.queries';
import type { Transaction, TransactionStatus } from '../api/transactions.contracts';
import {
  transactionsGridConfig,
  type TransactionsClientGridOptions,
} from '../transactionsGrid.config';
import { TransactionEditConflictPopover } from './TransactionEditConflictPopover';
import { TransactionEditingControls } from './TransactionEditingControls';
import { TransactionExportActions } from './TransactionExportActions';
import { TransactionImportAction } from './TransactionImportAction';
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

/** Concrete Transactions Client-Side Row Model root. */
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
    validationState,
    payload,
    editedRowCount,
    conflictCount,
    validationErrorCount,
    lastEdit,
    applyChangesToNodes,
    restoreTrackedEdits,
    handleCellValueChanged,
    acknowledgeChanges,
    discardRow,
    discardRows,
    resolveConflictWithRemote,
    resolveConflictWithLocal,
    setServerValidationErrors,
  } = useTrackedGridEditing(transactionEditingConfig);

  const {
    error: editActionError,
    applyLastEdit,
    applyBulkChanges,
  } = useCurrentPageEditActions({ lastEdit, applyChangesToNodes }, gridApi);

  const { saveRow, saveBulk, isSaving, saveError } = useTransactionEditPersistence({
    updates: payload.updates,
    acknowledgeChanges,
    onPersistedRows: applyAuthoritativeRows,
    onServerValidationErrors: (rowErrors) => {
      for (const error of rowErrors) setServerValidationErrors(error.rowId, error.fields);
    },
  });

  const handleSelectedTransactionUpdateApplied = useCallback(() => {
    clearSelection();
    void refetch();
  }, [clearSelection, refetch]);

  const {
    updateSelectedTransactions,
    isUpdatingSelectedTransactions,
    selectedTransactionUpdateError,
  } = useTransactionSelectionAction({ onApplied: handleSelectedTransactionUpdateApplied });

  const hasSelection = selectedRowCount > 0;
  const selectedDirtyUpdates = buildSelectedTrackedGridUpdatePayload(state, selectionSnapshot).updates;
  const selectedEditsHaveConflict = hasTrackedGridUpdateConflict(state, selectedDirtyUpdates);
  const selectedEditsHaveValidationError = hasGridUpdateValidationError(
    validationState,
    selectedDirtyUpdates,
  );
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
    if (
      hasTrackedGridUpdateConflict(state, updates) ||
      hasGridUpdateValidationError(validationState, updates)
    ) {
      return;
    }
    saveBulk(updates);
  }, [readSelectionIntent, saveBulk, state, validationState]);

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
    (status: TransactionStatus) => {
      const currentSelection = readSelectionIntent();
      if (
        currentSelection.ids.length === 0 ||
        hasSelectedTrackedGridFieldConflict(state, currentSelection, ['status'])
      ) {
        return;
      }

      updateSelectedTransactions({
        selection: currentSelection,
        changes: { status },
      });
    },
    [readSelectionIntent, state, updateSelectedTransactions],
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
      isRowInvalid: (rowId) => hasGridRowValidationError(validationState, rowId),
      isCellConflicted: (rowId, field) => hasTrackedGridFieldConflict(state, rowId, field),
      isCellInvalid: (rowId, field) => hasGridFieldValidationError(validationState, rowId, field),
      getCellValidationMessages: (rowId, field) =>
        validationState[rowId]?.[field]?.map((error) => error.message) ?? [],
      getCellConflict: (rowId, field) => {
        const conflict = state.conflictsById[rowId]?.[field];
        const localValue = state.changesById[rowId]?.[field];
        return conflict && localValue !== undefined
          ? { localValue, remoteValue: conflict.remoteValue }
          : undefined;
      },
      isSaving,
      onSaveRow: (rowId) => {
        if (
          !hasTrackedGridRowConflict(state, rowId) &&
          !hasGridRowValidationError(validationState, rowId)
        ) {
          saveRow(rowId);
        }
      },
      onDiscardRow: handleDiscardRow,
    }),
    [handleDiscardRow, isSaving, saveRow, state, validationState],
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
      <TransactionImportAction onImported={() => void refetch()} />

      <TransactionSelectionActions
        hasSelection={hasSelection}
        selectedRowCount={selectedRowCount}
        isApplying={isUpdatingSelectedTransactions}
        statusActionBlockedByConflict={statusActionBlockedByConflict}
        error={selectedTransactionUpdateError}
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
        validationErrorCount={validationErrorCount}
        selectedEditedRowCount={selectedDirtyUpdates.length}
        selectedEditsHaveConflict={selectedEditsHaveConflict}
        selectedEditsHaveValidationError={selectedEditsHaveValidationError}
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
