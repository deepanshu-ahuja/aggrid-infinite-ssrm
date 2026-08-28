import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type {
  CellClickedEvent,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import type { GridRowsLoader } from '@/shared/grid/data/gridData.types';
import { useServerSideRowLoading } from '@/shared/grid/data/server-side/useServerSideRowLoading';
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
import { getLogicalSelectedRowCount } from '@/shared/grid/selection/selectionCount';
import { useSsrmSelectionController } from '@/shared/grid/selection/server-side/useSsrmSelectionController';
import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';
import { useGridStatePersistence } from '@/shared/grid/state/useGridStatePersistence';
import { listTransactions } from '../api/transactions.api';
import type { Transaction, TransactionStatus } from '../api/transactions.contracts';
import {
  transactionsGridConfig,
  type TransactionsSsrmGridOptions,
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

const SSRM_STATE_KEY = 'transactions:ssrm';
const getTransactionId = (row: Transaction) => row.id;
const getRowId = ({ data }: GetRowIdParams<Transaction>) => getTransactionId(data);
const EMPTY_SELECTION: ServerSelectionIntent<string> = { mode: 'include', ids: [] };

const loadTransactionRows: GridRowsLoader<Transaction> = (request, context) =>
  listTransactions(mapTransactionGridRequest(request), context.signal);

interface ConflictTarget {
  rowId: string;
  field: TransactionEditableField;
  anchorEl: HTMLElement;
}

export interface TransactionsSsrmGridProps {
  gridOptions?: TransactionsSsrmGridOptions;
}

/** Concrete Transactions SSRM root with native SSRM lifecycle kept visible. */
export function TransactionsSsrmGrid({
  gridOptions: gridOptionsOverride,
}: TransactionsSsrmGridProps) {
  const gridOptions = gridOptionsOverride ?? transactionsGridConfig.ssrm.gridOptions;
  const gridApi = useRef<GridApi<Transaction> | null>(null);
  const [isGridReady, setIsGridReady] = useState(false);
  const [, setSelectionRevision] = useState(0);
  const [filteredSelectionTotal, setFilteredSelectionTotal] = useState(0);
  const [conflictTarget, setConflictTarget] = useState<ConflictTarget | null>(null);

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
  } = useSsrmSelectionController({ gridApi, getRowId: getTransactionId });

  const {
    datasource,
    error: loadError,
    totalCount,
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

  const selectionIntent = isGridReady ? readSelectionIntent() : EMPTY_SELECTION;
  const hasSelection = hasTransactionSelection(selectionIntent);
  const selectionScopeTotal = isFilteredSelectAllActive ? filteredSelectionTotal : totalCount;
  const selectedRowCount = getLogicalSelectedRowCount(selectionIntent, selectionScopeTotal);

  const selectedDirtyUpdates = isGridReady
    ? buildSelectedTrackedGridUpdatePayload(state, selectionIntent).updates
    : [];
  const selectedEditsHaveConflict = hasTrackedGridUpdateConflict(state, selectedDirtyUpdates);
  const statusActionBlockedByConflict = hasSelectedTrackedGridFieldConflict(
    state,
    selectionIntent,
    ['status'],
  );

  const handleSaveSelected = useCallback(() => {
    if (!gridApi.current) return;
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
    (status: TransactionStatus) => {
      const api = gridApi.current;
      if (!api) return;
      const currentSelection = readSelectionIntent();
      if (
        !hasTransactionSelection(currentSelection) ||
        hasSelectedTrackedGridFieldConflict(state, currentSelection, ['status'])
      ) return;

      applySelectionAction(
        buildTransactionSelectionActionRequest(
          currentSelection,
          isFilteredSelectAllActive ? 'filtered' : 'all',
          api.getFilterModel(),
          { status },
        ),
      );
    },
    [applySelectionAction, isFilteredSelectAllActive, readSelectionIntent, state],
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
        isFilteredSelectAllActive ? 'filtered' : 'all',
        api.getFilterModel(),
      ),
    );
  }, [exportSelected, isFilteredSelectAllActive, readSelectionIntent]);

  const handleSelectAllFiltered = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    // Capture the accepted filtered universe while handling the user action. React renders the stored
    // number later; it never reaches through `gridApi.current` during render just to display a count.
    setFilteredSelectionTotal(api.getDisplayedRowCount());
    selectAllFiltered();
  }, [selectAllFiltered]);

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
    api.setGridOption?.('context', rowEditActionsContext);
    api.refreshCells?.({ columns: [...TRANSACTION_EDITABLE_FIELDS, 'editActions'], force: true });
  }, [rowEditActionsContext]);

  const { initialState, onStateUpdated } = useGridStatePersistence<Transaction>({ key: SSRM_STATE_KEY });

  const handleGridReady = useCallback((event: GridReadyEvent<Transaction>) => {
    gridApi.current = event.api;
    setIsGridReady(true);
  }, []);

  const handleModelUpdated = useCallback(() => {
    syncSelectionAfterRowsChange();
    const api = gridApi.current;
    if (!api) return;

    // A filtered result can change after a server refresh while filtered-wide selection remains active.
    // Publish that event-derived count into React instead of reading the API ref during render.
    if (isFilteredSelectAllActive) setFilteredSelectionTotal(api.getDisplayedRowCount());
    restoreTrackedEdits(api);
  }, [isFilteredSelectAllActive, restoreTrackedEdits, syncSelectionAfterRowsChange]);

  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<Transaction>) => {
      onSelectionChanged(event);
      setSelectionRevision((revision) => revision + 1);
    },
    [onSelectionChanged],
  );

  const handleFilterChanged = useCallback(() => {
    clearLoadError();
    setFilteredSelectionTotal(0);
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
        isExportingSelected={isExportingSelected}
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
        <Typography variant="body2" color="warning.main">{editActionError}</Typography>
      ) : null}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <Button variant="outlined" size="small" onClick={selectCurrentPage}>Select current page</Button>
        <Button variant="outlined" size="small" onClick={handleSelectAllFiltered}>Select all filtered</Button>
        <Button variant="outlined" size="small" onClick={clearSelection}>Clear selection</Button>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        SSRM header checkbox selects all records. Current Page and All Filtered are explicit controls
        because SSRM does not support those native Select-All modes.
      </Typography>

      {selectionError ? <Alert severity="warning">{selectionError}</Alert> : null}

      <Box sx={{ height: 620, width: '100%' }}>
        <AgGridReact<Transaction>
          {...gridOptions}
          rowModelType="serverSide"
          serverSideDatasource={datasource}
          columnDefs={transactionColumns}
          context={rowEditActionsContext}
          getRowId={getRowId}
          getRowClass={getTransactionRowClass}
          initialState={initialState}
          rowSelection={{
            mode: 'multiRow',
            headerCheckbox: true,
            selectAll: 'all',
            groupSelects: 'self',
            isRowSelectable: isTransactionRowSelectable,
          }}
          activeOverlay={loadError ? GridErrorOverlay : undefined}
          activeOverlayParams={loadError ? { message: loadError, onRetry: retryLoad } : undefined}
          onGridReady={handleGridReady}
          onGridPreDestroyed={() => { gridApi.current = null; }}
          onModelUpdated={handleModelUpdated}
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
