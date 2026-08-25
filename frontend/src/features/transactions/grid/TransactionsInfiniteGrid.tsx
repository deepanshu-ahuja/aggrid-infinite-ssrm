import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Stack, Typography } from '@mui/material';
import type {
  FirstDataRenderedEvent,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  RowSelectedEvent,
  SelectionChangedEvent,
  SelectionColumnDef,
  ViewportChangedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { createInfiniteDatasource } from '@/shared/grid/data/infinite/createInfiniteDatasource';
import { useCurrentPageEditActions } from '@/shared/grid/editing/useCurrentPageEditActions';
import { buildSelectedTrackedGridUpdatePayload } from '@/shared/grid/editing/trackedGridEditing';
import { useTrackedGridEditing } from '@/shared/grid/editing/useTrackedGridEditing';
import { GridErrorOverlay } from '@/shared/grid/overlays/GridErrorOverlay';
import { InfiniteCurrentPageSelectionHeader } from '@/shared/grid/selection/infinite/InfiniteCurrentPageSelectionHeader';
import { useDatasetSelection } from '@/shared/grid/selection/infinite/useDatasetSelection';
import { useInfiniteDatasetSelectionSupport } from '@/shared/grid/selection/infinite/useInfiniteDatasetSelectionSupport';
import { SelectionHeaderCheckbox } from '@/shared/grid/selection/SelectionHeaderCheckbox';
import type { InfiniteSelectionMode, ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';
import { useGridStatePersistence } from '@/shared/grid/state/useGridStatePersistence';
import { listTransactions } from '../api/transactions.api';
import type { Transaction } from '../api/transactions.contracts';
import { transactionsGridConfig, type TransactionsInfiniteGridOptions } from '../transactionsGrid.config';
import { useTransactionsInfiniteGridDevTools } from './dev/useTransactionsInfiniteGridDevTools';
import { TransactionEditingControls } from './TransactionEditingControls';
import { buildTransactionBulkSelection } from './transactionBulkSelection';
import { transactionEditingConfig } from './transactionEditing';
import { transactionColumns } from './transactionColumns';
import { mapTransactionGridRequest } from './transactionRequest.mapper';

const INFINITE_STATE_KEY = 'transactions:infinite';
const getRowId = ({ data }: GetRowIdParams<Transaction>) => data.id;

export interface TransactionsInfiniteGridProps {
  selectionScope?: InfiniteSelectionMode;
  gridOptions?: TransactionsInfiniteGridOptions;
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
}

/** Concrete Infinite grid composition; shared hooks provide capabilities without hiding AgGridReact. */
export function TransactionsInfiniteGrid({
  selectionScope: selectionScopeOverride,
  gridOptions: gridOptionsOverride,
  onSelectionChange,
}: TransactionsInfiniteGridProps) {
  const selectionScope = selectionScopeOverride ?? transactionsGridConfig.infinite.selectionScope;
  const gridOptions = gridOptionsOverride ?? transactionsGridConfig.infinite.gridOptions;

  /** Single authoritative imperative AG Grid API. */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  /** Row-datasource failure shown by the grid overlay; separate from selection-support errors. */
  const [loadError, setLoadError] = useState<string>();

  const loadAllTotal = useCallback(async (signal: AbortSignal) => {
    const { totalCount } = await listTransactions(
      { offset: 0, limit: 1, sort: [], filters: [] },
      signal,
    );
    return totalCount;
  }, []);

  const {
    totalRowCount,
    error: datasetSupportError,
    setFilteredTotal,
    resetFilteredTotal,
  } = useInfiniteDatasetSelectionSupport({ scope: selectionScope, loadAllTotal });

  const {
    intent: datasetSelectionIntent,
    isRowSelected,
    setRowSelected,
    headerState,
    headerLabel,
    setHeaderSelected,
    onFilterChanged: onDatasetFilterChanged,
  } = useDatasetSelection({
    scope: selectionScope === 'all' ? 'all' : 'filtered',
    totalRowCount,
    onSelectionChange: selectionScope === 'page' ? undefined : onSelectionChange,
  });

  const editing = useTrackedGridEditing(transactionEditingConfig);
  const {
    state: editingState,
    editedRowCount,
    handleCellValueChanged,
    lastEdit,
    applyChangesToNodes,
    restoreTrackedEdits,
    payload: editPayload,
  } = editing;

  const editActions = useCurrentPageEditActions(
    { lastEdit, applyChangesToNodes },
    gridApi,
  );
  const {
    error: editActionError,
    applyLastEdit,
    applyBulkChanges,
  } = editActions;

  const readPageSelectionIntent = useCallback((): ServerSelectionIntent<string> => {
    const nativeSelection = gridApi.current?.getState().rowSelection;
    return { mode: 'include', ids: Array.isArray(nativeSelection) ? nativeSelection : [] };
  }, []);

  const readLogicalSelection = useCallback(
    () => selectionScope === 'page' ? readPageSelectionIntent() : datasetSelectionIntent,
    [datasetSelectionIntent, readPageSelectionIntent, selectionScope],
  );

  const buildSelectionPayload = useCallback(() => {
    const api = gridApi.current;
    if (!api) throw new Error('The grid is not ready yet.');
    const selection = readLogicalSelection();
    return selectionScope === 'filtered'
      ? buildTransactionBulkSelection(selection, {
          selectionScope: 'filtered',
          filterModel: api.getFilterModel(),
        })
      : buildTransactionBulkSelection(selection, { selectionScope });
  }, [readLogicalSelection, selectionScope]);

  const buildSelectedEditPayload = useCallback(
    () => buildSelectedTrackedGridUpdatePayload(editingState, readLogicalSelection()),
    [editingState, readLogicalSelection],
  );

  const devTools = useTransactionsInfiniteGridDevTools({
    buildSelectionPayload,
    buildSelectedEditPayload,
    editPayload,
  });
  const {
    clearPreviews,
    hideAllLocalEdits,
    showAllLocalEditsPreview,
    devToolsUi,
  } = devTools;

  const { initialState, onStateUpdated } = useGridStatePersistence<Transaction>({
    key: INFINITE_STATE_KEY,
  });

  const loadRows = useCallback(
    async (
      request: Parameters<typeof mapTransactionGridRequest>[0],
      context: { signal: AbortSignal },
    ) => {
      const result = await listTransactions(mapTransactionGridRequest(request), context.signal);
      setLoadError(undefined);
      return result;
    },
    [],
  );

  const datasource = useMemo(
    () => createInfiniteDatasource<Transaction>({
      loadRows,
      onError: () => setLoadError('Rows could not be loaded. Please retry.'),
    }),
    [loadRows],
  );

  const syncLoadedDatasetCheckboxes = useCallback(() => {
    if (selectionScope === 'page') return;
    gridApi.current?.forEachNode((node) => {
      if (!node.data) return;
      const shouldBeChecked = isRowSelected(node.data.id);
      if (node.isSelected() !== shouldBeChecked) node.setSelected(shouldBeChecked, false, 'api');
    });
  }, [isRowSelected, selectionScope]);

  const updateAfterRowsChange = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;
    if (selectionScope === 'filtered' && api.isLastRowIndexKnown()) {
      setFilteredTotal(api.getDisplayedRowCount());
    }
    syncLoadedDatasetCheckboxes();
  }, [selectionScope, setFilteredTotal, syncLoadedDatasetCheckboxes]);

  useEffect(() => {
    if (selectionScope === 'page') return;
    syncLoadedDatasetCheckboxes();
    gridApi.current?.refreshHeader();
  }, [datasetSelectionIntent, selectionScope, syncLoadedDatasetCheckboxes]);

  const selectionColumnDef = useMemo<SelectionColumnDef>(() => {
    const base: SelectionColumnDef = {
      width: 52,
      minWidth: 52,
      maxWidth: 52,
      resizable: false,
      sortable: false,
    };
    if (selectionScope === 'page') {
      return { ...base, headerComponent: InfiniteCurrentPageSelectionHeader };
    }
    return {
      ...base,
      headerComponent: SelectionHeaderCheckbox,
      headerComponentParams: {
        ...headerState,
        label: headerLabel,
        onChange: (checked: boolean) => {
          setHeaderSelected(checked);
          clearPreviews();
        },
      },
    };
  }, [clearPreviews, headerLabel, headerState, selectionScope, setHeaderSelected]);

  const handleGridReady = useCallback((event: GridReadyEvent<Transaction>) => {
    gridApi.current = event.api;
    window.setTimeout(updateAfterRowsChange, 0);
  }, [updateAfterRowsChange]);

  const handleFirstDataRendered = useCallback(
    (event: FirstDataRenderedEvent<Transaction>) => restoreTrackedEdits(event.api),
    [restoreTrackedEdits],
  );

  const handleViewportChanged = useCallback(
    (event: ViewportChangedEvent<Transaction>) => restoreTrackedEdits(event.api),
    [restoreTrackedEdits],
  );

  const handleRowSelected = useCallback((event: RowSelectedEvent<Transaction>) => {
    if (selectionScope === 'page' || event.source === 'api' || !event.data) return;
    setRowSelected(event.data.id, event.node.isSelected() === true);
    clearPreviews();
  }, [clearPreviews, selectionScope, setRowSelected]);

  const handleSelectionChanged = useCallback((event: SelectionChangedEvent<Transaction>) => {
    clearPreviews();
    if (selectionScope !== 'page') return;
    const nativeSelection = event.api.getState().rowSelection;
    onSelectionChange?.({ mode: 'include', ids: Array.isArray(nativeSelection) ? nativeSelection : [] });
  }, [clearPreviews, onSelectionChange, selectionScope]);

  const handleFilterChanged = useCallback(() => {
    setLoadError(undefined);
    clearPreviews();
    if (selectionScope === 'filtered') resetFilteredTotal();
    if (selectionScope !== 'page') onDatasetFilterChanged?.();
  }, [clearPreviews, onDatasetFilterChanged, resetFilteredTotal, selectionScope]);

  const handleRetryLoad = useCallback(() => {
    setLoadError(undefined);
    gridApi.current?.refreshInfiniteCache();
  }, []);

  return (
    <Stack spacing={2}>
      <TransactionEditingControls
        editedRowCount={editedRowCount}
        lastEdit={lastEdit}
        onApplyLastEdit={(target) => {
          if (applyLastEdit(target)) hideAllLocalEdits();
        }}
        onApplyBulkEdit={(target, changes) => {
          if (applyBulkChanges(target, changes)) hideAllLocalEdits();
        }}
        onPreviewPayload={showAllLocalEditsPreview}
      />

      {editActionError ? <Typography variant="body2" color="warning.main">{editActionError}</Typography> : null}
      {devToolsUi}
      {datasetSupportError ? <Alert severity="error">{datasetSupportError}</Alert> : null}

      <Box sx={{ height: 620, width: '100%' }}>
        <AgGridReact<Transaction>
          {...gridOptions}
          rowModelType="infinite"
          datasource={datasource}
          columnDefs={transactionColumns}
          getRowId={getRowId}
          initialState={initialState}
          rowSelection={{ mode: 'multiRow', headerCheckbox: false, enableClickSelection: false }}
          selectionColumnDef={selectionColumnDef}
          activeOverlay={loadError ? GridErrorOverlay : undefined}
          activeOverlayParams={loadError ? { message: loadError, onRetry: handleRetryLoad } : undefined}
          onGridReady={handleGridReady}
          onFirstDataRendered={handleFirstDataRendered}
          onViewportChanged={handleViewportChanged}
          onModelUpdated={updateAfterRowsChange}
          onPaginationChanged={updateAfterRowsChange}
          onRowSelected={handleRowSelected}
          onSelectionChanged={handleSelectionChanged}
          onFilterChanged={handleFilterChanged}
          onCellValueChanged={handleCellValueChanged}
          onStateUpdated={onStateUpdated}
        />
      </Box>
    </Stack>
  );
}
