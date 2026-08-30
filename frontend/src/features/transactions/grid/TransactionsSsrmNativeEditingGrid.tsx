// GRIDCAP-ROWMODEL-SSRM | GRIDCAP-DATA-LOAD | GRIDCAP-ROW-ID | GRIDCAP-SEL-MANUAL | GRIDCAP-SEL-PAGE | GRIDCAP-SEL-FILTERED | GRIDCAP-SEL-ALL | GRIDCAP-COUNT-SELECTED | GRIDCAP-SEL-TARGET | GRIDCAP-ACTION-SELECTED | GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-SAVE-ROW | GRIDCAP-EDIT-SAVE-SELECTED | GRIDCAP-EDIT-DISCARD | GRIDCAP-EDIT-VALIDATION | GRIDCAP-COUNT-EDITED | GRIDCAP-IMPORT | GRIDCAP-EXPORT-PAGE | GRIDCAP-EXPORT-SELECTED | GRIDCAP-STATE-PERSISTENCE | GRIDCAP-ERROR-RETRY | GRIDCAP-LIFECYCLE-REFRESH | GRIDCAP-LIFECYCLE-DESTROY | GRIDCAP-ROW-ELIGIBILITY | GRIDCAP-COLUMNS
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type {
  CellValueChangedEvent,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { CellSelectionModule, ClipboardModule } from 'ag-grid-enterprise';
import { AgGridReact } from 'ag-grid-react';
import type { GridRowsLoader } from '@/shared/grid/data/gridData.types';
import { useServerSideRowLoading } from '@/shared/grid/data/server-side/useServerSideRowLoading';
import {
  buildSelectedGridDraftUpdatePayload,
  hasGridDraftField,
} from '@/shared/grid/editing/gridDraftEditing';
import { useGridDraftEditing } from '@/shared/grid/editing/useGridDraftEditing';
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
import { TransactionExportActions } from './TransactionExportActions';
import { TransactionImportAction } from './TransactionImportAction';
import type { TransactionNativeDraftContext } from './TransactionNativeDraftRowActions';
import { TransactionSelectionActions } from './TransactionSelectionActions';
import {
  isTransactionEditableField,
  TRANSACTION_EDITABLE_FIELDS,
  type TransactionEditableField,
  type TransactionEditableValue,
} from './transactionEditing';
import { transactionNativeEditingColumns } from './transactionNativeEditingColumns';
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
import './TransactionsSsrmNativeEditingGrid.css';

const SSRM_NATIVE_EDITING_STATE_KEY = 'transactions:ssrm-native-editing-spike';
const getTransactionId = (row: Transaction) => row.id;
const getRowId = ({ data }: GetRowIdParams<Transaction>) => getTransactionId(data);
const EMPTY_SELECTION: ServerSelectionIntent<string> = { mode: 'include', ids: [] };

const loadTransactionRows: GridRowsLoader<Transaction> = (request, context) =>
  listTransactions(mapTransactionGridRequest(request), context.signal);

export interface TransactionsSsrmNativeEditingGridProps {
  gridOptions?: TransactionsSsrmGridOptions;
}

/**
 * Isolated SSRM editing experiment.
 *
 * Existing `/ssrm` remains untouched. Native AG Grid editing owns single edits, Cell Selection,
 * Ctrl/Cmd+D, Ctrl/Cmd+Enter and Fill Handle. The only external edit state is BASE + LOCAL for fields
 * that are genuinely dirty; no server blocks or REMOTE/conflict state are copied into React.
 */
export function TransactionsSsrmNativeEditingGrid({
  gridOptions: gridOptionsOverride,
}: TransactionsSsrmNativeEditingGridProps) {
  const gridOptions = gridOptionsOverride ?? transactionsGridConfig.ssrm.gridOptions;
  const gridApi = useRef<GridApi<Transaction> | null>(null);
  const [isGridReady, setIsGridReady] = useState(false);
  const [, setSelectionRevision] = useState(0);
  const [serverValidationMessage, setServerValidationMessage] = useState<string>();

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
    filteredCount,
    retry: retryLoad,
    clearError: clearLoadError,
  } = useServerSideRowLoading({
    gridApi,
    loadRows: loadTransactionRows,
    defaultBlockSize: gridOptions.cacheBlockSize ?? 100,
  });

  const {
    state: draftState,
    payload,
    editedRowCount,
    editedCellCount,
    handleCellValueChanged,
    restoreDrafts,
    acknowledgeChanges,
    discardRow,
    discardRows,
  } = useGridDraftEditing<Transaction, TransactionEditableField, TransactionEditableValue>({
    getRowId: getTransactionId,
    isEditableField: isTransactionEditableField,
  });

  const handlePersistedRows = useCallback(() => {
    gridApi.current?.refreshServerSide();
  }, []);

  const { saveRow, saveBulk, isSaving, saveError } = useTransactionEditPersistence({
    updates: payload.updates,
    acknowledgeChanges,
    onPersistedRows: handlePersistedRows,
    onServerValidationErrors: (rowErrors) => {
      const parts = rowErrors.flatMap((rowError) =>
        Object.entries(rowError.fields).flatMap(([field, messages]) =>
          (messages ?? []).map((message) => `${rowError.rowId} ${field}: ${message}`),
        ),
      );
      setServerValidationMessage(parts.join(' '));
    },
  });

  const handleDiscardRow = useCallback(
    (rowId: string) => {
      discardRow(rowId);
      setServerValidationMessage(undefined);
      // Discard asks the datasource for authoritative data instead of treating BASE as latest REMOTE.
      gridApi.current?.refreshServerSide();
    },
    [discardRow],
  );

  const rowEditActionsContext = useMemo<TransactionNativeDraftContext>(
    () => ({
      isRowDirty: (rowId) => Boolean(draftState.draftsById[rowId]),
      isCellDirty: (rowId, field) => hasGridDraftField(draftState, rowId, field),
      isSaving,
      onSaveRow: (rowId) => saveRow(rowId),
      onDiscardRow: handleDiscardRow,
    }),
    [draftState, handleDiscardRow, isSaving, saveRow],
  );

  useEffect(() => {
    const api = gridApi.current;
    if (!api) return;

    api.setGridOption('context', rowEditActionsContext);
    api.refreshCells({
      columns: [...TRANSACTION_EDITABLE_FIELDS, 'editActions'],
      force: true,
    });
  }, [rowEditActionsContext]);

  const handleDraftCellValueChanged = useCallback(
    (event: CellValueChangedEvent<Transaction>) => {
      setServerValidationMessage(undefined);
      handleCellValueChanged(event);
    },
    [handleCellValueChanged],
  );

  const handleSelectedTransactionUpdateApplied = useCallback(() => {
    clearSelection();
    handlePersistedRows();
  }, [clearSelection, handlePersistedRows]);

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

  const selectionIntent = isGridReady ? readSelectionIntent() : EMPTY_SELECTION;
  const hasSelection = hasTransactionSelection(selectionIntent);
  const selectionScopeTotal = isFilteredSelectAllActive ? filteredCount : totalCount;
  const selectedRowCount = getLogicalSelectedRowCount(selectionIntent, selectionScopeTotal);
  const selectedDirtyUpdates = buildSelectedGridDraftUpdatePayload(draftState, selectionIntent).updates;

  const handleSaveSelected = useCallback(() => {
    const updates = buildSelectedGridDraftUpdatePayload(draftState, readSelectionIntent()).updates;
    saveBulk(updates);
  }, [draftState, readSelectionIntent, saveBulk]);

  const handleDiscardSelected = useCallback(() => {
    const updates = buildSelectedGridDraftUpdatePayload(draftState, readSelectionIntent()).updates;
    if (updates.length === 0) return;

    discardRows(updates.map((update) => update.id));
    setServerValidationMessage(undefined);
    gridApi.current?.refreshServerSide();
  }, [discardRows, draftState, readSelectionIntent]);

  const handleSetSelectedStatus = useCallback(
    (status: TransactionStatus) => {
      const api = gridApi.current;
      if (!api) return;

      const currentSelection = readSelectionIntent();
      if (!hasTransactionSelection(currentSelection)) return;

      updateSelectedTransactions(
        buildTransactionSelectionActionRequest(
          currentSelection,
          isFilteredSelectAllActive ? 'filtered' : 'all',
          api.getFilterModel(),
          { status },
        ),
      );
    },
    [isFilteredSelectAllActive, readSelectionIntent, updateSelectedTransactions],
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

  const { initialState, onStateUpdated } = useGridStatePersistence<Transaction>({
    key: SSRM_NATIVE_EDITING_STATE_KEY,
  });

  const handleGridReady = useCallback((event: GridReadyEvent<Transaction>) => {
    gridApi.current = event.api;
    setIsGridReady(true);
  }, []);

  const handleModelUpdated = useCallback(() => {
    syncSelectionAfterRowsChange();
    const api = gridApi.current;
    if (api) restoreDrafts(api);
  }, [restoreDrafts, syncSelectionAfterRowsChange]);

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

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Native editing spike: use Ctrl/Cmd+D, Ctrl/Cmd+Enter, or the Fill Handle on selected cells.
        Invalid editor values are blocked by AG Grid validation.
      </Alert>

      <TransactionImportAction onImported={handlePersistedRows} />

      <TransactionSelectionActions
        hasSelection={hasSelection}
        selectedRowCount={selectedRowCount}
        isApplying={isUpdatingSelectedTransactions}
        statusActionBlockedByConflict={false}
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

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', md: 'center' }}
      >
        <Typography variant="body2">
          {editedRowCount} {editedRowCount === 1 ? 'row' : 'rows'} edited total;{' '}
          {selectedDirtyUpdates.length} selected; {editedCellCount}{' '}
          {editedCellCount === 1 ? 'cell' : 'cells'} changed.
        </Typography>

        <Button
          size="small"
          variant="contained"
          disabled={selectedDirtyUpdates.length === 0 || isSaving}
          onClick={handleSaveSelected}
        >
          Save selected edits ({selectedDirtyUpdates.length})
        </Button>

        <Button
          size="small"
          variant="outlined"
          disabled={selectedDirtyUpdates.length === 0 || isSaving}
          onClick={handleDiscardSelected}
        >
          Discard selected edits
        </Button>
      </Stack>

      {saveError ? <Alert severity="error">{saveError}</Alert> : null}
      {serverValidationMessage ? <Alert severity="error">{serverValidationMessage}</Alert> : null}

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
        No conflict resolver and no fetched-block snapshot: only edited BASE + LOCAL fields are retained.
      </Typography>

      {selectionError ? <Alert severity="warning">{selectionError}</Alert> : null}

      <Box sx={{ height: 620, width: '100%' }}>
        <AgGridReact<Transaction>
          {...gridOptions}
          modules={[CellSelectionModule, ClipboardModule]}
          rowModelType="serverSide"
          serverSideDatasource={datasource}
          columnDefs={transactionNativeEditingColumns}
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
          cellSelection={{
            enableHeaderHighlight: true,
            handle: {
              mode: 'fill',
              direction: 'y',
            },
          }}
          invalidEditValueMode="block"
          activeOverlay={loadError ? GridErrorOverlay : undefined}
          activeOverlayParams={loadError ? { message: loadError, onRetry: retryLoad } : undefined}
          onGridReady={handleGridReady}
          onGridPreDestroyed={() => {
            gridApi.current = null;
          }}
          onModelUpdated={handleModelUpdated}
          onRowSelected={onRowSelected}
          onSelectionChanged={handleSelectionChanged}
          onFilterChanged={handleFilterChanged}
          onCellValueChanged={handleDraftCellValueChanged}
          onStateUpdated={onStateUpdated}
        />
      </Box>
    </Stack>
  );
}
