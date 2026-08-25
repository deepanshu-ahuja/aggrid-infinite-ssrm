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
import { GridErrorOverlay } from '@/shared/grid/overlays/GridErrorOverlay';
import { InfiniteCurrentPageSelectionHeader } from '@/shared/grid/selection/infinite/InfiniteCurrentPageSelectionHeader';
import { useDatasetSelection } from '@/shared/grid/selection/infinite/useDatasetSelection';
import { useInfiniteDatasetSelectionSupport } from '@/shared/grid/selection/infinite/useInfiniteDatasetSelectionSupport';
import { SelectionHeaderCheckbox } from '@/shared/grid/selection/SelectionHeaderCheckbox';
import type {
  InfiniteSelectionMode,
  ServerSelectionIntent,
} from '@/shared/grid/selection/serverSelection';
import { useGridStatePersistence } from '@/shared/grid/state/useGridStatePersistence';
import { listTransactions } from '../api/transactions.api';
import type { Transaction } from '../api/transactions.contracts';
import {
  transactionsGridConfig,
  type TransactionsInfiniteGridOptions,
} from '../transactionsGrid.config';
import { useTransactionsInfiniteGridDevTools } from './dev/useTransactionsInfiniteGridDevTools';
import { TransactionEditingControls } from './TransactionEditingControls';
import { buildTransactionBulkSelection } from './transactionBulkSelection';
import {
  buildSelectedTransactionUpdatePayload,
  useTransactionEditing,
} from './transactionEditing';
import { transactionColumns } from './transactionColumns';
import { mapTransactionGridRequest } from './transactionRequest.mapper';
import { useTransactionEditFlows } from './useTransactionEditFlows';

const INFINITE_STATE_KEY = 'transactions:infinite';

/** Stable backend identity lets Infinite preserve native row selection across cache recreation. */
const getRowId = ({ data }: GetRowIdParams<Transaction>) => data.id;

export interface TransactionsInfiniteGridProps {
  /** Optional override for the Infinite header selection behavior. */
  selectionScope?: InfiniteSelectionMode;
  /** Optional native GridOptions override for tests/embedding. */
  gridOptions?: TransactionsInfiniteGridOptions;
  /** Optional consumer notification of the current logical selection. */
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
}

/**
 * Production-shaped Transactions Infinite root.
 *
 * This component still owns `<AgGridReact>` and ONE authoritative `GridApi` ref. Reusable hooks own
 * capability mechanics around that root, but they do not hide AG Grid's native lifecycle or props.
 */
export function TransactionsInfiniteGrid({
  selectionScope: selectionScopeOverride,
  gridOptions: gridOptionsOverride,
  onSelectionChange,
}: TransactionsInfiniteGridProps) {
  const selectionScope =
    selectionScopeOverride ?? transactionsGridConfig.infinite.selectionScope;
  const gridOptions =
    gridOptionsOverride ?? transactionsGridConfig.infinite.gridOptions;

  /**
   * The single authoritative AG Grid imperative API for this rendered Infinite grid.
   * A ref is appropriate because assigning the API should not itself trigger rendering.
   */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  /**
   * Datasource failure rendered through AG Grid's active overlay.
   * Selection-supporting total failures remain independent so row loading can stay usable.
   */
  const [loadError, setLoadError] = useState<string>();

  /**
   * Feature-specific way to obtain the complete unfiltered total. The shared Infinite selection
   * support hook owns request lifetime/error/count state; Transactions owns only its API contract.
   */
  const loadAllTotal = useCallback(async (signal: AbortSignal) => {
    const { totalCount } = await listTransactions(
      {
        offset: 0,
        limit: 1,
        sort: [],
        filters: [],
      },
      signal,
    );

    return totalCount;
  }, []);

  const datasetSelectionSupport = useInfiniteDatasetSelectionSupport({
    scope: selectionScope,
    loadAllTotal,
  });

  /**
   * Infinite cannot represent Select-All over unloaded filtered/all records natively, so only that
   * logical dataset selection remains application-owned. Page/manual mode stays native AG Grid.
   */
  const datasetSelection = useDatasetSelection({
    scope: selectionScope === 'all' ? 'all' : 'filtered',
    totalRowCount: datasetSelectionSupport.totalRowCount,
    onSelectionChange:
      selectionScope === 'page' ? undefined : onSelectionChange,
  });

  /** Transactions supplies row/field semantics; shared/grid owns cache-surviving edit mechanics. */
  const editing = useTransactionEditing();

  /** Transaction Flow 1/2 semantics compose the shared current-page target resolver. */
  const editFlows = useTransactionEditFlows(editing, gridApi);

  /** Page/manual selection is native AG Grid selection and is read only when an action needs it. */
  const readPageSelectionIntent = useCallback((): ServerSelectionIntent<string> => {
    const nativeSelection = gridApi.current?.getState().rowSelection;

    return {
      mode: 'include',
      ids: Array.isArray(nativeSelection) ? nativeSelection : [],
    };
  }, []);

  /** Uniform production selection reader across native-page and application-dataset modes. */
  const readLogicalSelection = useCallback(
    () =>
      selectionScope === 'page'
        ? readPageSelectionIntent()
        : datasetSelection.intent,
    [datasetSelection.intent, readPageSelectionIntent, selectionScope],
  );

  /**
   * Backend-facing selection payload builder used by developer UI today and available to a future
   * real bulk-action UI without depending on Dev Tools.
   */
  const buildSelectionPayload = useCallback(() => {
    const api = gridApi.current;
    if (!api) throw new Error('The grid is not ready yet.');

    const selection = readLogicalSelection();

    return selectionScope === 'filtered'
      ? buildTransactionBulkSelection(selection, {
          selectionScope: 'filtered',
          filterModel: api.getFilterModel(),
        })
      : buildTransactionBulkSelection(selection, {
          selectionScope,
        });
  }, [readLogicalSelection, selectionScope]);

  /**
   * Intersects accumulated edits with current logical selection. This is production-capable action
   * logic; Dev Tools merely renders the result for validation.
   */
  const buildSelectedEditPayload = useCallback(
    () =>
      buildSelectedTransactionUpdatePayload(
        editing.state,
        readLogicalSelection(),
      ),
    [editing.state, readLogicalSelection],
  );

  /** Dev-only hook owns presentation/snapshots only; it receives reusable action callbacks. */
  const devTools = useTransactionsInfiniteGridDevTools({
    buildSelectionPayload,
    buildSelectedEditPayload,
    editPayload: editing.payload,
  });

  /** Repeated native Grid State load/save wiring is shared without wrapping `AgGridReact`. */
  const gridState = useGridStatePersistence<Transaction>({
    key: INFINITE_STATE_KEY,
  });

  /**
   * Transactions backend loader consumed by the shared Infinite datasource adapter.
   * Feature mapping remains here because shared grid code must not know transaction query syntax.
   */
  const loadRows = useCallback(
    async (
      request: Parameters<typeof mapTransactionGridRequest>[0],
      context: { signal: AbortSignal },
    ) => {
      const result = await listTransactions(
        mapTransactionGridRequest(request),
        context.signal,
      );

      setLoadError(undefined);
      return result;
    },
    [],
  );

  /** Stable datasource identity prevents ordinary React renders from resetting Infinite cache state. */
  const datasource = useMemo(
    () =>
      createInfiniteDatasource<Transaction>({
        loadRows,
        onError: () => {
          setLoadError('Rows could not be loaded. Please retry.');
        },
      }),
    [loadRows],
  );

  /**
   * Dataset Select All can describe unloaded rows, so newly materialised RowNodes reconcile from the
   * custom include/exclude state. Page/manual mode deliberately skips this synchronization.
   */
  const syncLoadedDatasetCheckboxes = useCallback(() => {
    if (selectionScope === 'page') return;

    gridApi.current?.forEachNode((node) => {
      if (!node.data) return;

      const shouldBeChecked = datasetSelection.isRowSelected(node.data.id);

      if (node.isSelected() !== shouldBeChecked) {
        node.setSelected(shouldBeChecked, false, 'api');
      }
    });
  }, [datasetSelection.isRowSelected, selectionScope]);

  /**
   * Refresh query-derived support state only after AG Grid has accepted the current Infinite model.
   * This avoids stale overlapping block requests directly racing to update the filtered total.
   */
  const updateAfterRowsChange = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    if (selectionScope === 'filtered' && api.isLastRowIndexKnown()) {
      datasetSelectionSupport.setFilteredTotal(api.getDisplayedRowCount());
    }

    syncLoadedDatasetCheckboxes();
  }, [
    datasetSelectionSupport.setFilteredTotal,
    selectionScope,
    syncLoadedDatasetCheckboxes,
  ]);

  useEffect(() => {
    if (selectionScope === 'page') return;

    syncLoadedDatasetCheckboxes();
    gridApi.current?.refreshHeader();
  }, [datasetSelection.intent, selectionScope, syncLoadedDatasetCheckboxes]);

  /** Native selection column remains visible in the concrete grid composition. */
  const selectionColumnDef = useMemo<SelectionColumnDef>(() => {
    const base: SelectionColumnDef = {
      width: 52,
      minWidth: 52,
      maxWidth: 52,
      resizable: false,
      sortable: false,
    };

    if (selectionScope === 'page') {
      return {
        ...base,
        headerComponent: InfiniteCurrentPageSelectionHeader,
      };
    }

    return {
      ...base,
      headerComponent: SelectionHeaderCheckbox,
      headerComponentParams: {
        ...datasetSelection.headerState,
        label: datasetSelection.headerLabel,
        onChange: (checked: boolean) => {
          datasetSelection.setHeaderSelected(checked);
          devTools.clearPreviews();
        },
      },
    };
  }, [
    datasetSelection.headerLabel,
    datasetSelection.headerState,
    datasetSelection.setHeaderSelected,
    devTools.clearPreviews,
    selectionScope,
  ]);

  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;
      window.setTimeout(updateAfterRowsChange, 0);
    },
    [updateAfterRowsChange],
  );

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

  /** Dataset-mode user row selection updates logical include/exclude state; page mode stays native. */
  const handleRowSelected = useCallback(
    (event: RowSelectedEvent<Transaction>) => {
      if (selectionScope === 'page') return;
      if (event.source === 'api' || !event.data) return;

      datasetSelection.setRowSelected(
        event.data.id,
        event.node.isSelected() === true,
      );
      devTools.clearPreviews();
    },
    [datasetSelection.setRowSelected, devTools.clearPreviews, selectionScope],
  );

  /** Page/manual selection publishes native Grid State selection to feature consumers. */
  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<Transaction>) => {
      devTools.clearPreviews();

      if (selectionScope !== 'page') return;

      const nativeSelection = event.api.getState().rowSelection;
      onSelectionChange?.({
        mode: 'include',
        ids: Array.isArray(nativeSelection) ? nativeSelection : [],
      });
    },
    [devTools.clearPreviews, onSelectionChange, selectionScope],
  );

  /** Filter changes reset only query-derived support state; the selection strategy owns semantics. */
  const handleFilterChanged = useCallback(() => {
    setLoadError(undefined);
    devTools.clearPreviews();

    if (selectionScope === 'filtered') {
      datasetSelectionSupport.resetFilteredTotal();
    }

    if (selectionScope !== 'page') {
      datasetSelection.onFilterChanged?.();
    }
  }, [
    datasetSelection.onFilterChanged,
    datasetSelectionSupport.resetFilteredTotal,
    devTools.clearPreviews,
    selectionScope,
  ]);

  const handleRetryLoad = useCallback(() => {
    setLoadError(undefined);
    gridApi.current?.refreshInfiniteCache();
  }, []);

  return (
    <Stack spacing={2}>
      <TransactionEditingControls
        editedRowCount={editing.editedRowCount}
        lastEdit={editing.lastEdit}
        onApplyLastEdit={(target) => {
          if (editFlows.applyLastEdit(target)) devTools.hideAllLocalEdits();
        }}
        onApplyBulkEdit={(target, changes) => {
          if (editFlows.applyBulkChanges(target, changes)) {
            devTools.hideAllLocalEdits();
          }
        }}
        onPreviewPayload={devTools.showAllLocalEditsPreview}
      />

      {editFlows.error ? (
        <Typography variant="body2" color="warning.main">
          {editFlows.error}
        </Typography>
      ) : null}

      {devTools.devToolsUi}

      {datasetSelectionSupport.error ? (
        <Alert severity="error">{datasetSelectionSupport.error}</Alert>
      ) : null}

      <Box sx={{ height: 620, width: '100%' }}>
        <AgGridReact<Transaction>
          {...gridOptions}
          rowModelType="infinite"
          datasource={datasource}
          columnDefs={transactionColumns}
          getRowId={getRowId}
          initialState={gridState.initialState}
          rowSelection={{
            mode: 'multiRow',
            headerCheckbox: false,
            enableClickSelection: false,
          }}
          selectionColumnDef={selectionColumnDef}
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
          onModelUpdated={updateAfterRowsChange}
          onPaginationChanged={updateAfterRowsChange}
          onRowSelected={handleRowSelected}
          onSelectionChanged={handleSelectionChanged}
          onFilterChanged={handleFilterChanged}
          onCellValueChanged={editing.handleCellValueChanged}
          onStateUpdated={gridState.onStateUpdated}
        />
      </Box>
    </Stack>
  );
}
