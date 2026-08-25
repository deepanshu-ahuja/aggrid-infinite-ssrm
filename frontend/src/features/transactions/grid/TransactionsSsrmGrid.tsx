import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type {
  FirstDataRenderedEvent,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  RowSelectedEvent,
  SelectionChangedEvent,
  StateUpdatedEvent,
  ViewportChangedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { createServerSideDatasource } from '@/shared/grid/data/server-side/createServerSideDatasource';
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
import { browserGridStateStore } from '@/shared/grid/state/gridStatePersistence';
import { listTransactions } from '../api/transactions.api';
import type { Transaction, TransactionFilter } from '../api/transactions.contracts';
import {
  transactionsGridConfig,
  type TransactionsSsrmGridOptions,
} from '../transactionsGrid.config';
import { TransactionEditingControls } from './TransactionEditingControls';
import {
  buildTransactionBulkSelection,
  type TransactionBulkSelection,
} from './transactionBulkSelection';
import { useTransactionEditing } from './transactionEditing';
import { transactionColumns } from './transactionColumns';
import { mapTransactionGridRequest } from './transactionRequest.mapper';
import { useTransactionEditFlows } from './useTransactionEditFlows';

const SSRM_STATE_KEY = 'transactions:ssrm';

/** Stable backend identity is required for SSRM server-side selection state and edit restoration. */
const getRowId = ({ data }: GetRowIdParams<Transaction>) => data.id;

/** Custom state only for SSRM's unsupported Select All Filtered semantics. */
function createFilteredSelectAllState(): ServerSelection<string> {
  return {
    mode: 'exclude',
    ids: new Set<string>(),
  };
}

export interface TransactionsSsrmGridProps {
  /** Optional native GridOptions override for tests/embedding. */
  gridOptions?: TransactionsSsrmGridOptions;
}

/**
 * Production-shaped Transactions SSRM root.
 *
 * ROOT OWNERSHIP RULE
 * -------------------
 * This component owns `<AgGridReact>` and ONE authoritative `GridApi` ref. Native SSRM selection,
 * filters, pagination, retry and Grid State are read/written through that API rather than mirrored
 * into parent state or extra refs.
 *
 * React/application state remains only for behavior SSRM cannot represent (Select All Filtered),
 * accumulated unsaved edits, user-facing errors and temporary development previews.
 */
export function TransactionsSsrmGrid({
  gridOptions: gridOptionsOverride,
}: TransactionsSsrmGridProps) {
  const gridOptions = gridOptionsOverride ?? transactionsGridConfig.ssrm.gridOptions;

  /** The single authoritative AG Grid API for this rendered SSRM grid. */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  const [loadError, setLoadError] = useState<string>();
  const [selectionError, setSelectionError] = useState<string>();
  const [filteredSelection, setFilteredSelection] =
    useState<ServerSelection<string>>();

  /** Development/UI state only. */
  const [preview, setPreview] = useState<TransactionBulkSelection>();
  const [previewError, setPreviewError] = useState<string>();
  const [showAllLocalEdits, setShowAllLocalEdits] = useState(false);

  const editing = useTransactionEditing();
  const editFlows = useTransactionEditFlows(editing, gridApi);

  /** Native Grid State preferences; localStorage is only today's replaceable store implementation. */
  const initialState = useMemo(
    () => browserGridStateStore.load(SSRM_STATE_KEY),
    [],
  );

  const handleStateUpdated = useCallback(
    (event: StateUpdatedEvent<Transaction>) => {
      browserGridStateStore.save(SSRM_STATE_KEY, event.state);
    },
    [],
  );

  const loadRows = useCallback(
    (
      request: Parameters<typeof mapTransactionGridRequest>[0],
      context: { signal: AbortSignal },
    ) =>
      listTransactions(
        mapTransactionGridRequest(request),
        context.signal,
      ),
    [],
  );

  const datasource = useMemo(
    () =>
      createServerSideDatasource<Transaction>({
        loadRows,
        onError: () => {
          setLoadError('Rows could not be loaded. Please retry.');
        },
        defaultBlockSize: gridOptions.cacheBlockSize ?? 100,
      }),
    [gridOptions.cacheBlockSize, loadRows],
  );

  const handleGridReady = useCallback((event: GridReadyEvent<Transaction>) => {
    gridApi.current = event.api;
  }, []);

  const handleFirstDataRendered = useCallback(
    (event: FirstDataRenderedEvent<Transaction>) => {
      editing.restoreTrackedEdits(event.api);
    },
    [editing.restoreTrackedEdits],
  );

  const handleViewportChanged = useCallback(
    (event: ViewportChangedEvent<Transaction>) => {
      editing.restoreTrackedEdits(event.api);
    },
    [editing.restoreTrackedEdits],
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
    if (!filteredSelection) return;
    syncLoadedFilteredSelection(filteredSelection);
  }, [filteredSelection, syncLoadedFilteredSelection]);

  const handleRowSelected = useCallback(
    (event: RowSelectedEvent<Transaction>) => {
      if (event.source === 'api' || !event.data) return;

      setFilteredSelection((current) => {
        if (!current) return current;

        return updateRowSelection(
          current,
          event.data!.id,
          event.node.isSelected() === true,
        );
      });

      clearPreview();
    },
    [clearPreview],
  );

  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<Transaction>) => {
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
    },
    [clearPreview, filteredSelection],
  );

  /** SSRM has no native `selectAll: 'currentPage'`; resolve that page then use native selection. */
  const handleSelectCurrentPage = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    try {
      const nativeState = readFlatServerSideSelectionState(
        api.getServerSideSelectionState(),
      );
      const pageNodes = getCurrentPageNodes(api);

      if (!pageNodes) {
        setSelectionError(
          'The current page is still loading. Select it again after the rows are visible.',
        );
        return;
      }

      const wasFilteredSelectAll = Boolean(filteredSelection);
      setFilteredSelection(undefined);

      if (nativeState.selectAll || wasFilteredSelectAll) {
        api.setServerSideSelectionState(createEmptyServerSideSelectionState());
      }

      if (pageNodes.length > 0) {
        api.setNodesSelected({
          nodes: pageNodes,
          newValue: true,
        });
      }

      setSelectionError(undefined);
      clearPreview();
    } catch (error) {
      setSelectionError(
        error instanceof Error
          ? error.message
          : 'Current-page selection could not be applied.',
      );
    }
  }, [clearPreview, filteredSelection]);

  /**
   * SSRM cannot express Select All Filtered across unloaded rows. Only the logical include/exclude
   * selection is custom; the applied filter itself remains AG Grid-owned.
   */
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

  /** Filter changes invalidate only the unsupported custom Select All Filtered mode. */
  const handleFilterChanged = useCallback(() => {
    clearPreview();

    if (!filteredSelection) return;

    setFilteredSelection(undefined);
    gridApi.current?.setServerSideSelectionState(
      createEmptyServerSideSelectionState(),
    );
    setSelectionError(undefined);
  }, [clearPreview, filteredSelection]);

  const handleClearSelection = useCallback(() => {
    setFilteredSelection(undefined);
    gridApi.current?.setServerSideSelectionState(
      createEmptyServerSideSelectionState(),
    );
    setSelectionError(undefined);
    clearPreview();
  }, [clearPreview]);

  /** Native SSRM selection and native filter state are read from the root GridApi at action time. */
  const handlePreviewSelection = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    try {
      let nextPreview: TransactionBulkSelection;

      if (filteredSelection) {
        nextPreview = buildTransactionBulkSelection(
          toServerSelectionIntent(filteredSelection),
          {
            selectionScope: 'filtered',
            filterModel: api.getFilterModel(),
          },
        );
      } else {
        const intent = serverSideSelectionToIntent(
          readFlatServerSideSelectionState(api.getServerSideSelectionState()),
        );

        nextPreview =
          intent.mode === 'include'
            ? buildGridBulkSelection<string, TransactionFilter>(intent, [])
            : buildTransactionBulkSelection(intent, {
                selectionScope: 'all',
              });
      }

      setPreview(nextPreview);
      setPreviewError(undefined);
    } catch (error) {
      setPreview(undefined);
      setPreviewError(
        error instanceof Error
          ? error.message
          : 'The SSRM selection payload could not be built.',
      );
    }
  }, [filteredSelection]);

  const handleRetryLoad = useCallback(() => {
    setLoadError(undefined);
    gridApi.current?.retryServerSideLoads();
  }, []);

  return (
    <Stack spacing={2}>
      <TransactionEditingControls
        editedRowCount={editing.editedRowCount}
        lastEdit={editing.lastEdit}
        onApplyLastEdit={(target) => {
          if (editFlows.applyLastEdit(target)) setShowAllLocalEdits(false);
        }}
        onApplyBulkEdit={(target, changes) => {
          if (editFlows.applyBulkChanges(target, changes)) {
            setShowAllLocalEdits(false);
          }
        }}
        onPreviewPayload={() => setShowAllLocalEdits(true)}
      />

      {editFlows.error ? (
        <Typography variant="body2" color="warning.main">
          {editFlows.error}
        </Typography>
      ) : null}

      {import.meta.env.DEV && showAllLocalEdits ? (
        <Box
          component="pre"
          data-testid="all-local-edits-preview"
          sx={{
            m: 0,
            p: 1.5,
            overflowX: 'auto',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.default',
            fontSize: '0.75rem',
          }}
        >
          {JSON.stringify(editing.payload, null, 2)}
        </Box>
      ) : null}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <Button variant="outlined" size="small" onClick={handleSelectCurrentPage}>
          Select current page
        </Button>
        <Button variant="outlined" size="small" onClick={handleSelectAllFiltered}>
          Select all filtered
        </Button>
        <Button variant="outlined" size="small" onClick={handleClearSelection}>
          Clear selection
        </Button>
        {import.meta.env.DEV ? (
          <Button variant="outlined" size="small" onClick={handlePreviewSelection}>
            Preview selection payload
          </Button>
        ) : null}
      </Stack>

      <Typography variant="caption" color="text.secondary">
        SSRM header checkbox selects all records. Current Page and All Filtered are explicit controls
        because SSRM does not support those native Select-All modes.
      </Typography>

      {selectionError ? <Alert severity="warning">{selectionError}</Alert> : null}
      {import.meta.env.DEV && previewError ? (
        <Alert severity="error">{previewError}</Alert>
      ) : null}

      {import.meta.env.DEV && preview ? (
        <Box
          component="pre"
          data-testid="ssrm-selection-payload-preview"
          sx={{
            m: 0,
            p: 1.5,
            overflowX: 'auto',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.default',
            fontSize: '0.75rem',
          }}
        >
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
          rowSelection={{
            mode: 'multiRow',
            headerCheckbox: true,
            selectAll: 'all',
            groupSelects: 'self',
          }}
          activeOverlay={loadError ? GridErrorOverlay : undefined}
          activeOverlayParams={
            loadError
              ? {
                  message: loadError,
                  onRetry: handleRetryLoad,
                }
              : undefined
          }
          onGridReady={handleGridReady}
          onFirstDataRendered={handleFirstDataRendered}
          onViewportChanged={handleViewportChanged}
          onModelUpdated={handleModelUpdated}
          onRowSelected={handleRowSelected}
          onSelectionChanged={handleSelectionChanged}
          onFilterChanged={handleFilterChanged}
          onCellValueChanged={editing.handleCellValueChanged}
          onStateUpdated={handleStateUpdated}
        />
      </Box>
    </Stack>
  );
}
