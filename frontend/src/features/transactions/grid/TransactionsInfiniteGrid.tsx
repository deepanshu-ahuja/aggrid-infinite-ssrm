// GRIDCAP-ROWMODEL-INFINITE | GRIDCAP-DATA-LOAD | GRIDCAP-ROW-ID | GRIDCAP-SEL-MANUAL | GRIDCAP-SEL-PAGE | GRIDCAP-SEL-FILTERED | GRIDCAP-SEL-ALL | GRIDCAP-COUNT-SELECTED | GRIDCAP-SEL-TARGET | GRIDCAP-ACTION-SELECTED | GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-SAVE-ROW | GRIDCAP-EDIT-SAVE-SELECTED | GRIDCAP-EDIT-DISCARD | GRIDCAP-EDIT-CONFLICT | GRIDCAP-EDIT-VALIDATION | GRIDCAP-COUNT-EDITED | GRIDCAP-IMPORT | GRIDCAP-EXPORT-PAGE | GRIDCAP-EXPORT-SELECTED | GRIDCAP-STATE-PERSISTENCE | GRIDCAP-ERROR-RETRY | GRIDCAP-LIFECYCLE-REFRESH | GRIDCAP-LIFECYCLE-DESTROY | GRIDCAP-ROW-ELIGIBILITY | GRIDCAP-COLUMNS
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type {
  CellClickedEvent,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import type { GridRowsLoader } from '@/shared/grid/data/gridData.types';
import { useInfiniteRowLoading } from '@/shared/grid/data/infinite/useInfiniteRowLoading';
import {
  buildSelectedTrackedGridUpdatePayload,
  hasSelectedTrackedGridFieldConflict,
  hasTrackedGridFieldConflict,
  hasTrackedGridRowConflict,
  hasTrackedGridUpdateConflict,
} from '@/shared/grid/editing/trackedGridEditing';
import { useCurrentPageEditActions } from '@/shared/grid/editing/useCurrentPageEditActions';
import { useTrackedGridEditing } from '@/shared/grid/editing/useTrackedGridEditing';
import { GridErrorOverlay } from '@/shared/grid/overlays/GridErrorOverlay';
import { useInfiniteSelectionController } from '@/shared/grid/selection/infinite/useInfiniteSelectionController';
import type {
  InfiniteSelectionMode,
  ServerSelectionIntent,
} from '@/shared/grid/selection/serverSelection';
import { useGridStatePersistence } from '@/shared/grid/state/useGridStatePersistence';
import {
  hasGridFieldValidationError,
  hasGridRowValidationError,
  hasGridUpdateValidationError,
} from '@/shared/grid/validation/gridValidation';
import { listTransactions } from '../api/transactions.api';
import type { Transaction, TransactionStatus } from '../api/transactions.contracts';
import {
  transactionsGridConfig,
  type TransactionsInfiniteGridOptions,
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
import { transactionColumns } from './transactionColumns';
import { mapTransactionGridRequest } from './transactionRequest.mapper';
import {
  getTransactionRowClass,
  isTransactionRowSelectable,
} from './transactionRowInteraction';
import {
  buildTransactionSelectionActionRequest,
  buildTransactionSelectionTarget,
  hasTransactionSelection,
} from './transactionSelectionAction';
import { useTransactionEditPersistence } from './useTransactionEditPersistence';
import { useTransactionExport } from './useTransactionExport';
import { useTransactionSelectionAction } from './useTransactionSelectionAction';

const INFINITE_STATE_KEY = 'transactions:infinite';
const getTransactionId = (row: Transaction) => row.id;
const getRowId = ({ data }: GetRowIdParams<Transaction>) => getTransactionId(data);

const loadTransactionRows: GridRowsLoader<Transaction> = (request, context) =>
  listTransactions(mapTransactionGridRequest(request), context.signal);

interface ConflictTarget {
  rowId: string;
  field: TransactionEditableField;
  anchorEl: HTMLElement;
}

export interface TransactionsInfiniteGridProps {
  selectionScope?: InfiniteSelectionMode;
  gridOptions?: TransactionsInfiniteGridOptions;
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
}

/** Concrete Transactions Infinite Row Model root. */
export function TransactionsInfiniteGrid({
  selectionScope: selectionScopeOverride,
  gridOptions: gridOptionsOverride,
  onSelectionChange,
}: TransactionsInfiniteGridProps) {
  const selectionScope = selectionScopeOverride ?? transactionsGridConfig.infinite.selectionScope;
  const gridOptions = gridOptionsOverride ?? transactionsGridConfig.infinite.gridOptions;
  const gridApi = useRef<GridApi<Transaction> | null>(null);
  const [, setSelectionRevision] = useState(0);
  const [conflictTarget, setConflictTarget] = useState<ConflictTarget | null>(null);

  const {
    datasource,
    error: loadError,
    totalCount,
    filteredCount,
    retry: retryLoad,
    clearError: clearLoadError,
  } = useInfiniteRowLoading({ gridApi, loadRows: loadTransactionRows });

  const {
    selectionColumnDef,
    readSelectionIntent,
    selectedRowCount,
    clearSelection,
    onRowsChanged: syncSelectionAfterRowsChange,
    onRowSelected,
    onSelectionChanged,
    resetFilterDependentSelection,
  } = useInfiniteSelectionController({
    gridApi,
    scope: selectionScope,
    getRowId: getTransactionId,
    totalCount,
    filteredCount,
    onSelectionChange,
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

  const handlePersistedRows = useCallback(() => {
    gridApi.current?.refreshInfiniteCache();
  }, []);

  const handleSelectedTransactionUpdateApplied = useCallback(() => {
    clearSelection();
    handlePersistedRows();
  }, [clearSelection, handlePersistedRows]);

  const { saveRow, saveBulk, isSaving, saveError } = useTransactionEditPersistence({
    updates: payload.updates,
    acknowledgeChanges,
    onPersistedRows: handlePersistedRows,
    onServerValidationErrors: (rowErrors) => {
      for (const error of rowErrors) setServerValidationErrors(error.rowId, error.fields);
    },
  });

  const {
    updateSelectedTransactions,
    isUpdatingSelectedTransactions,
    selectedTransactionUpdateError,
  } = useTransactionSelectionAction({ onApplied: handleSelectedTransactionUpdateApplied });

  const {
    error: exportError,
    isExportingSelected,
    exportCurrentPage,
    exportSelected,
  } = useTransactionExport();

  const handleDiscardRow = useCallback(
    (rowId: string) => {
      const api = gridApi.current;
      if (!api) return;
      discardRow(api, rowId);
      if (conflictTarget?.rowId === rowId) setConflictTarget(null);
    },
    [conflictTarget?.rowId, discardRow],
  );

  const selectionIntent = readSelectionIntent();
  const hasSelection = hasTransactionSelection(selectionIntent);
  const selectedDirtyUpdates = buildSelectedTrackedGridUpdatePayload(state, selectionIntent).updates;
  const selectedEditsHaveConflict = hasTrackedGridUpdateConflict(state, selectedDirtyUpdates);
  const selectedEditsHaveValidationError = hasGridUpdateValidationError(
    validationState,
    selectedDirtyUpdates,
  );
  const statusActionBlockedByConflict = hasSelectedTrackedGridFieldConflict(
    state,
    selectionIntent,
    ['status'],
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
      const api = gridApi.current;
      if (!api) return;

      const currentSelection = readSelectionIntent();
      if (
        !hasTransactionSelection(currentSelection) ||
        hasSelectedTrackedGridFieldConflict(state, currentSelection, ['status'])
      ) {
        return;
      }

      updateSelectedTransactions(
        buildTransactionSelectionActionRequest(
          currentSelection,
          selectionScope === 'filtered' ? 'filtered' : 'all',
          api.getFilterModel(),
          { status },
        ),
      );
    },
    [readSelectionIntent, selectionScope, state, updateSelectedTransactions],
  );

  const handleExportCurrentPage = useCallback(() => {
    const api = gridApi.current;
    if (api) exportCurrentPage(api);
  }, [exportCurrentPage]);

  const handleExportSelected = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;
    const currentSelection = readSelectionIntent();
    if (!hasTransactionSelection(currentSelection)) return;
    void exportSelected(
      buildTransactionSelectionTarget(
        currentSelection,
        selectionScope === 'filtered' ? 'filtered' : 'all',
        api.getFilterModel(),
      ),
    );
  }, [exportSelected, readSelectionIntent, selectionScope]);

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
    key: INFINITE_STATE_KEY,
  });

  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;
      window.setTimeout(syncSelectionAfterRowsChange, 0);
    },
    [syncSelectionAfterRowsChange],
  );

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
      <TransactionImportAction onImported={handlePersistedRows} />

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
        isExportingSelected={isExportingSelected}
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
          rowModelType="infinite"
          datasource={datasource}
          columnDefs={transactionColumns}
          context={rowEditActionsContext}
          getRowId={getRowId}
          getRowClass={getTransactionRowClass}
          initialState={initialState}
          rowSelection={{
            mode: 'multiRow',
            headerCheckbox: false,
            enableClickSelection: false,
            isRowSelectable: isTransactionRowSelectable,
          }}
          selectionColumnDef={selectionColumnDef}
          activeOverlay={loadError ? GridErrorOverlay : undefined}
          activeOverlayParams={loadError ? { message: loadError, onRetry: retryLoad } : undefined}
          onGridReady={handleGridReady}
          onGridPreDestroyed={() => {
            gridApi.current = null;
          }}
          onModelUpdated={handleRowsChanged}
          onPaginationChanged={handleRowsChanged}
          onRowSelected={onRowSelected}
          onSelectionChanged={handleSelectionChanged}
          onFilterChanged={handleFilterChanged}
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
