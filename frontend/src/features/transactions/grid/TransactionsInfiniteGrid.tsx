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
  StateUpdatedEvent,
  ViewportChangedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { createInfiniteDatasource } from '@/shared/grid/data/infinite/createInfiniteDatasource';
import { GridErrorOverlay } from '@/shared/grid/overlays/GridErrorOverlay';
import { InfiniteCurrentPageSelectionHeader } from '@/shared/grid/selection/infinite/InfiniteCurrentPageSelectionHeader';
import { useDatasetSelection } from '@/shared/grid/selection/infinite/useDatasetSelection';
import { SelectionHeaderCheckbox } from '@/shared/grid/selection/SelectionHeaderCheckbox';
import type {
  InfiniteSelectionMode,
  ServerSelectionIntent,
} from '@/shared/grid/selection/serverSelection';
import { browserGridStateStore } from '@/shared/grid/state/gridStatePersistence';
import { listTransactions } from '../api/transactions.api';
import type { Transaction } from '../api/transactions.contracts';
import {
  transactionsGridConfig,
  type TransactionsInfiniteGridOptions,
} from '../transactionsGrid.config';
import { useTransactionsInfiniteGridDevTools } from './dev/useTransactionsInfiniteGridDevTools';
import { TransactionEditingControls } from './TransactionEditingControls';
import { useTransactionEditing } from './transactionEditing';
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
 * ROOT OWNERSHIP RULE
 * -------------------
 * This component owns the actual `<AgGridReact>` and ONE authoritative `GridApi` ref. Native filter,
 * sort, pagination and ordinary selection information is read from that API when needed; it is not
 * mirrored upward through React state/refs.
 *
 * Application state remains only where Infinite cannot represent the business meaning:
 * - dataset-wide Select All over unloaded filtered/all records;
 * - accumulated unsaved edits keyed by stable transaction ID;
 * - supporting totals/errors required to render production behavior.
 *
 * Runtime developer diagnostics live behind `useTransactionsInfiniteGridDevTools`. Removing those
 * diagnostics must not require rewriting the grid lifecycle or business-selection implementation.
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
   *
   * A ref is correct because assigning the API does not represent renderable React state. Consumers
   * read it only when an imperative grid operation is required: cache refresh, native selection,
   * current filter state, loaded-row synchronisation, or edit-flow targeting.
   */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  /**
   * Datasource failure currently presented through AG Grid's active error overlay.
   *
   * This is React state because a failed/successful request must change rendered overlay props. It
   * is intentionally separate from `totalError`, which can fail while normal row loading still works.
   */
  const [loadError, setLoadError] = useState<string>();

  /**
   * Backend row count for AG Grid's currently accepted FILTERED query.
   *
   * Filtered dataset selection needs this count to calculate its header state without loading every
   * matching row. It is reset when the query changes and repopulated only after AG Grid knows the
   * authoritative last row for the new Infinite model.
   */
  const [filteredTotal, setFilteredTotal] = useState(0);

  /**
   * Complete unfiltered backend row count used only by `selectionScope === 'all'`.
   *
   * This is separate from `filteredTotal` because "Select All Records" must remain independent of
   * whichever column filters happen to be applied to the visible grid.
   */
  const [allTotal, setAllTotal] = useState(0);

  /**
   * Failure of the supporting unfiltered-count request required by all-record selection.
   *
   * The grid may still load rows successfully, so this error must not be collapsed into `loadError`.
   */
  const [totalError, setTotalError] = useState<string>();

  /**
   * Dataset selection is the one Infinite selection capability that must remain application-owned.
   * Page/manual mode never uses this controller as its source of truth.
   */
  const datasetSelection = useDatasetSelection({
    scope: selectionScope === 'all' ? 'all' : 'filtered',
    totalRowCount:
      selectionScope === 'all'
        ? allTotal
        : selectionScope === 'filtered'
          ? filteredTotal
          : 0,
    onSelectionChange:
      selectionScope === 'page' ? undefined : onSelectionChange,
  });

  /** Accumulated local edits survive Infinite cache eviction by stable transaction ID. */
  const editing = useTransactionEditing();

  /** Flow 1 / Flow 2 consume the SAME root GridApi instead of capturing another API ref. */
  const editFlows = useTransactionEditFlows(editing, gridApi);

  /**
   * Page/manual selection is native AG Grid selection, so read it from GridState when needed rather
   * than maintaining a second selected-ID collection in React.
   */
  const readPageSelectionIntent = useCallback((): ServerSelectionIntent<string> => {
    const nativeSelection = gridApi.current?.getState().rowSelection;

    return {
      mode: 'include',
      ids: Array.isArray(nativeSelection) ? nativeSelection : [],
    };
  }, []);

  /**
   * Gives actions one uniform logical-selection reader while preserving the ownership difference:
   * native GridState for page/manual mode, application include/exclude intent for dataset modes.
   */
  const readLogicalSelection = useCallback(
    () =>
      selectionScope === 'page'
        ? readPageSelectionIntent()
        : datasetSelection.intent,
    [datasetSelection.intent, readPageSelectionIntent, selectionScope],
  );

  /** Stable accessor lets dev tooling inspect the same authoritative API without owning another ref. */
  const getGridApi = useCallback(() => gridApi.current, []);

  /**
   * One removable integration point for runtime-only diagnostics.
   *
   * The hook may observe production state to render previews, but production selection/editing/grid
   * behavior never reads state back from the hook.
   */
  const devTools = useTransactionsInfiniteGridDevTools({
    selectionScope,
    getGridApi,
    readLogicalSelection,
    editState: editing.state,
    editPayload: editing.payload,
  });

  /** Native Grid State preferences; localStorage is only today's replaceable store implementation. */
  const initialState = useMemo(
    () => browserGridStateStore.load(INFINITE_STATE_KEY),
    [],
  );

  const handleStateUpdated = useCallback(
    (event: StateUpdatedEvent<Transaction>) => {
      browserGridStateStore.save(INFINITE_STATE_KEY, event.state);
    },
    [],
  );

  /** All-record custom Select All needs a complete unfiltered backend total. */
  useEffect(() => {
    if (selectionScope !== 'all') return;

    /**
     * Only the total is required, so requesting one record avoids transferring an unnecessary page.
     * The AbortController prevents a late response from updating state after scope/unmount changes.
     */
    const controller = new AbortController();

    void listTransactions(
      {
        offset: 0,
        limit: 1,
        sort: [],
        filters: [],
      },
      controller.signal,
    )
      .then(({ totalCount }) => {
        setAllTotal(totalCount);
        setTotalError(undefined);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTotalError(
            'The total row count required for all-record selection could not be loaded.',
          );
        }
      });

    return () => controller.abort();
  }, [selectionScope]);

  /**
   * Feature-specific backend loader consumed by the shared Infinite datasource adapter.
   *
   * The callback translates AG Grid's block request at the feature boundary and clears the visible
   * datasource error only after a request has actually recovered successfully.
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
        /** API source prevents this visual reconciliation from being treated as a new user choice. */
        node.setSelected(shouldBeChecked, false, 'api');
      }
    });
  }, [datasetSelection.isRowSelected, selectionScope]);

  /**
   * Refresh derived information only after AG Grid's current row model changes.
   *
   * Reading the filtered total from AG Grid's accepted model avoids older overlapping datasource
   * requests racing to overwrite React state with a stale query count.
   */
  const updateAfterRowsChange = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    if (selectionScope === 'filtered' && api.isLastRowIndexKnown()) {
      setFilteredTotal(api.getDisplayedRowCount());
    }

    syncLoadedDatasetCheckboxes();
  }, [selectionScope, syncLoadedDatasetCheckboxes]);

  useEffect(() => {
    if (selectionScope === 'page') return;

    /**
     * Logical dataset selection can change without AG Grid replacing RowNodes, so loaded checkboxes
     * and the custom header must be refreshed from application-owned include/exclude state.
     */
    syncLoadedDatasetCheckboxes();
    gridApi.current?.refreshHeader();
  }, [datasetSelection.intent, selectionScope, syncLoadedDatasetCheckboxes]);

  /**
   * Configures only the dedicated native selection column.
   *
   * Page mode delegates the header to a native-current-page implementation. Dataset modes use the
   * custom header because Infinite cannot natively express selecting unloaded filtered/all records.
   */
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

  /** Capture AG Grid's single API instance once the rendered grid is ready. */
  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;

      /** Defer until AG Grid has had a chance to construct its initial Infinite model/RowNodes. */
      window.setTimeout(updateAfterRowsChange, 0);
    },
    [updateAfterRowsChange],
  );

  /** Reapply accumulated edits when the first materialised rows become available. */
  const handleFirstDataRendered = useCallback(
    (event: FirstDataRenderedEvent<Transaction>) => {
      editing.restoreTrackedEdits(event.api);
    },
    [editing.restoreTrackedEdits],
  );

  /** Reapply accumulated edits when cache/pagination changes materialise different RowNodes. */
  const handleViewportChanged = useCallback(
    (event: ViewportChangedEvent<Transaction>) => {
      editing.restoreTrackedEdits(event.api);
    },
    [editing.restoreTrackedEdits],
  );

  /**
   * Dataset-mode row selection must update application include/exclude intent.
   *
   * Page mode remains native. API-driven checkbox reconciliation is ignored to avoid feedback loops.
   */
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

  /**
   * Page/manual mode publishes AG Grid's native row selection directly to feature consumers.
   * Dataset modes publish through `useDatasetSelection`, so this event must not create a second path.
   */
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

  /**
   * A filter change starts a new server query and can invalidate filtered-dataset Select All intent.
   * The selection strategy owns that semantic reset; this root only resets query-derived support data.
   */
  const handleFilterChanged = useCallback(() => {
    setLoadError(undefined);
    devTools.clearPreviews();

    if (selectionScope === 'filtered') {
      /** The old total describes the old query and must not drive the new header while rows reload. */
      setFilteredTotal(0);
    }

    if (selectionScope !== 'page') {
      datasetSelection.onFilterChanged?.();
    }
  }, [datasetSelection.onFilterChanged, devTools.clearPreviews, selectionScope]);

  /** Retry the native Infinite cache after clearing the currently rendered datasource error. */
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

      {totalError ? <Alert severity="error">{totalError}</Alert> : null}

      <Box sx={{ height: 620, width: '100%' }}>
        <AgGridReact<Transaction>
          {...gridOptions}
          rowModelType="infinite"
          datasource={datasource}
          columnDefs={transactionColumns}
          getRowId={getRowId}
          initialState={initialState}
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
          onStateUpdated={handleStateUpdated}
        />
      </Box>
    </Stack>
  );
}
