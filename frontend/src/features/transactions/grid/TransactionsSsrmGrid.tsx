import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type {
  FirstDataRenderedEvent,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  RowSelectedEvent,
  SelectionChangedEvent,
  ViewportChangedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { createServerSideDatasource } from '@/shared/grid/data/server-side/createServerSideDatasource';
import { useCurrentPageEditActions } from '@/shared/grid/editing/useCurrentPageEditActions';
import { useTrackedGridEditing } from '@/shared/grid/editing/useTrackedGridEditing';
import { GridErrorOverlay } from '@/shared/grid/overlays/GridErrorOverlay';
import { getCurrentPageNodes } from '@/shared/grid/pagination/getCurrentPageNodes';
import { buildGridBulkSelection } from '@/shared/grid/selection/gridBulkSelection';
import {
  isServerRowSelected,
  toServerSelectionIntent,
  updateRowSelection,
  type ServerSelection,
} from '@/shared/grid/selection/serverSelection';
import {
  createEmptyServerSideSelectionState,
  readFlatServerSideSelectionState,
  serverSideSelectionToIntent,
} from '@/shared/grid/selection/serverSideSelection';
import { useGridStatePersistence } from '@/shared/grid/state/useGridStatePersistence';
import { listTransactions } from '../api/transactions.api';
import type { Transaction, TransactionFilter } from '../api/transactions.contracts';
import { transactionsGridConfig, type TransactionsSsrmGridOptions } from '../transactionsGrid.config';
import { TransactionEditingControls } from './TransactionEditingControls';
import { buildTransactionBulkSelection, type TransactionBulkSelection } from './transactionBulkSelection';
import { transactionEditingConfig } from './transactionEditing';
import { transactionColumns } from './transactionColumns';
import { mapTransactionGridRequest } from './transactionRequest.mapper';

const SSRM_STATE_KEY = 'transactions:ssrm';
const getRowId = ({ data }: GetRowIdParams<Transaction>) => data.id;

function createFilteredSelectAllState(): ServerSelection<string> {
  return { mode: 'exclude', ids: new Set<string>() };
}

export interface TransactionsSsrmGridProps {
  gridOptions?: TransactionsSsrmGridOptions;
}

/** Concrete Transactions SSRM composition. SSRM-specific selection remains explicit in this root. */
export function TransactionsSsrmGrid({ gridOptions: gridOptionsOverride }: TransactionsSsrmGridProps) {
  const gridOptions = gridOptionsOverride ?? transactionsGridConfig.ssrm.gridOptions;

  /** Single authoritative AG Grid API; assignment itself is not renderable state. */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  /** Independent user-facing states: datasource failure, SSRM selection failure, custom filtered mode. */
  const [loadError, setLoadError] = useState<string>();
  const [selectionError, setSelectionError] = useState<string>();
  const [filteredSelection, setFilteredSelection] = useState<ServerSelection<string>>();

  /** Temporary SSRM developer presentation; SSRM Dev Tools extraction remains a later concern. */
  const [preview, setPreview] = useState<TransactionBulkSelection>();
  const [previewError, setPreviewError] = useState<string>();
  const [showAllLocalEdits, setShowAllLocalEdits] = useState(false);

  const editing = useTrackedGridEditing(transactionEditingConfig);
  const {
    editedRowCount,
    handleCellValueChanged,
    lastEdit,
    applyChangesToNodes,
    restoreTrackedEdits,
    payload: editPayload,
  } = editing;

  const {
    error: editActionError,
    applyLastEdit,
    applyBulkChanges,
  } = useCurrentPageEditActions({ lastEdit, applyChangesToNodes }, gridApi);

  const { initialState, onStateUpdated } = useGridStatePersistence<Transaction>({
    key: SSRM_STATE_KEY,
  });

  const loadRows = useCallback(
    (
      request: Parameters<typeof mapTransactionGridRequest>[0],
      context: { signal: AbortSignal },
    ) => listTransactions(mapTransactionGridRequest(request), context.signal),
    [],
  );

  const datasource = useMemo(
    () => createServerSideDatasource<Transaction>({
      loadRows,
      onError: () => setLoadError('Rows could not be loaded. Please retry.'),
      defaultBlockSize: gridOptions.cacheBlockSize ?? 100,
    }),
    [gridOptions.cacheBlockSize, loadRows],
  );

  const handleGridReady = useCallback((event: GridReadyEvent<Transaction>) => {
    gridApi.current = event.api;
  }, []);

  const handleFirstDataRendered = useCallback(
    (event: FirstDataRenderedEvent<Transaction>) => restoreTrackedEdits(event.api),
    [restoreTrackedEdits],
  );

  const handleViewportChanged = useCallback(
    (event: ViewportChangedEvent<Transaction>) => restoreTrackedEdits(event.api),
    [restoreTrackedEdits],
  );

  const clearPreview = useCallback(() => {
    setPreview(undefined);
    setPreviewError(undefined);
  }, []);

  const syncLoadedFilteredSelection = useCallback(
    (selection: ServerSelection<string>, api = gridApi.current) => {
      if (!api) return;
      api.forEachNode((node) => {
        if (!node.data) return;
        const shouldBeSelected = isServerRowSelected(selection, node.data.id);
        if (node.isSelected() !== shouldBeSelected) {
          node.setSelected(shouldBeSelected, false, 'api');
        }
      });
    },
    [],
  );

  const handleModelUpdated = useCallback(() => {
    if (filteredSelection) syncLoadedFilteredSelection(filteredSelection);
  }, [filteredSelection, syncLoadedFilteredSelection]);

  const handleRowSelected = useCallback((event: RowSelectedEvent<Transaction>) => {
    if (event.source === 'api' || !event.data) return;
    setFilteredSelection((current) => {
      if (!current) return current;
      return updateRowSelection(current, event.data!.id, event.node.isSelected() === true);
    });
    clearPreview();
  }, [clearPreview]);

  const handleSelectionChanged = useCallback((event: SelectionChangedEvent<Transaction>) => {
    clearPreview();
    if (!filteredSelection) return;
    try {
      const nativeState = readFlatServerSideSelectionState(
        event.serverSideState ?? gridApi.current?.getServerSideSelectionState(),
      );
      if (nativeState.selectAll) {
        setFilteredSelection(undefined);
        setSelectionError(undefined);
      }
    } catch {
      /** Flat Transactions selection assumes `groupSelects: 'self'`; revisit if grouping is added. */
    }
  }, [clearPreview, filteredSelection]);

  const handleSelectCurrentPage = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;
    try {
      const nativeState = readFlatServerSideSelectionState(api.getServerSideSelectionState());
      const pageNodes = getCurrentPageNodes(api);
      if (!pageNodes) {
        setSelectionError('The current page is still loading. Select it again after the rows are visible.');
        return;
      }
      const wasFilteredSelectAll = Boolean(filteredSelection);
      setFilteredSelection(undefined);
      if (nativeState.selectAll || wasFilteredSelectAll) {
        api.setServerSideSelectionState(createEmptyServerSideSelectionState());
      }
      if (pageNodes.length > 0) api.setNodesSelected({ nodes: pageNodes, newValue: true });
      setSelectionError(undefined);
      clearPreview();
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : 'Current-page selection could not be applied.');
    }
  }, [clearPreview, filteredSelection]);

  const handleSelectAllFiltered = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;
    const nextSelection = createFilteredSelectAllState();
    setFilteredSelection(undefined);
    api.setServerSideSelectionState(createEmptyServerSideSelectionState());
    setFilteredSelection(nextSelection);
    syncLoadedFilteredSelection(nextSelection, api);
    setSelectionError(undefined);
    clearPreview();
  }, [clearPreview, syncLoadedFilteredSelection]);

  const handleFilterChanged = useCallback(() => {
    clearPreview();
    if (!filteredSelection) return;
    setFilteredSelection(undefined);
    gridApi.current?.setServerSideSelectionState(createEmptyServerSideSelectionState());
    setSelectionError(undefined);
  }, [clearPreview, filteredSelection]);

  const handleClearSelection = useCallback(() => {
    setFilteredSelection(undefined);
    gridApi.current?.setServerSideSelectionState(createEmptyServerSideSelectionState());
    setSelectionError(undefined);
    clearPreview();
  }, [clearPreview]);

  const handlePreviewSelection = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;
    try {
      let nextPreview: TransactionBulkSelection;
      if (filteredSelection) {
        nextPreview = buildTransactionBulkSelection(toServerSelectionIntent(filteredSelection), {
          selectionScope: 'filtered',
          filterModel: api.getFilterModel(),
        });
      } else {
        const intent = serverSideSelectionToIntent(
          readFlatServerSideSelectionState(api.getServerSideSelectionState()),
        );
        nextPreview = intent.mode === 'include'
          ? buildGridBulkSelection<string, TransactionFilter>(intent, [])
          : buildTransactionBulkSelection(intent, { selectionScope: 'all' });
      }
      setPreview(nextPreview);
      setPreviewError(undefined);
    } catch (error) {
      setPreview(undefined);
      setPreviewError(error instanceof Error ? error.message : 'The SSRM selection payload could not be built.');
    }
  }, [filteredSelection]);

  const handleRetryLoad = useCallback(() => {
    setLoadError(undefined);
    gridApi.current?.retryServerSideLoads();
  }, []);

  return (
    <Stack spacing={2}>
      <TransactionEditingControls
        editedRowCount={editedRowCount}
        lastEdit={lastEdit}
        onApplyLastEdit={(target) => {
          if (applyLastEdit(target)) setShowAllLocalEdits(false);
        }}
        onApplyBulkEdit={(target, changes) => {
          if (applyBulkChanges(target, changes)) setShowAllLocalEdits(false);
        }}
        onPreviewPayload={() => setShowAllLocalEdits(true)}
      />

      {editActionError ? <Typography variant="body2" color="warning.main">{editActionError}</Typography> : null}

      {import.meta.env.DEV && showAllLocalEdits ? (
        <Box component="pre" data-testid="all-local-edits-preview" sx={{ m: 0, p: 1.5, overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.default', fontSize: '0.75rem' }}>
          {JSON.stringify(editPayload, null, 2)}
        </Box>
      ) : null}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <Button variant="outlined" size="small" onClick={handleSelectCurrentPage}>Select current page</Button>
        <Button variant="outlined" size="small" onClick={handleSelectAllFiltered}>Select all filtered</Button>
        <Button variant="outlined" size="small" onClick={handleClearSelection}>Clear selection</Button>
        {import.meta.env.DEV ? <Button variant="outlined" size="small" onClick={handlePreviewSelection}>Preview selection payload</Button> : null}
      </Stack>

      <Typography variant="caption" color="text.secondary">
        SSRM header checkbox selects all records. Current Page and All Filtered are explicit controls because SSRM does not support those native Select-All modes.
      </Typography>

      {selectionError ? <Alert severity="warning">{selectionError}</Alert> : null}
      {import.meta.env.DEV && previewError ? <Alert severity="error">{previewError}</Alert> : null}
      {import.meta.env.DEV && preview ? (
        <Box component="pre" data-testid="ssrm-selection-payload-preview" sx={{ m: 0, p: 1.5, overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.default', fontSize: '0.75rem' }}>
          {JSON.stringify(preview, null, 2)}
        </Box>
      ) : null}

      <Box sx={{ height: 620, width: '100%' }}>
        <AgGridReact<Transaction>
          {...gridOptions}
          rowModelType="serverSide"
          serverSideDatasource={datasource}
          columnDefs={transactionColumns}
          getRowId={getRowId}
          initialState={initialState}
          rowSelection={{ mode: 'multiRow', headerCheckbox: true, selectAll: 'all', groupSelects: 'self' }}
          activeOverlay={loadError ? GridErrorOverlay : undefined}
          activeOverlayParams={loadError ? { message: loadError, onRetry: handleRetryLoad } : undefined}
          onGridReady={handleGridReady}
          onFirstDataRendered={handleFirstDataRendered}
          onViewportChanged={handleViewportChanged}
          onModelUpdated={handleModelUpdated}
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
