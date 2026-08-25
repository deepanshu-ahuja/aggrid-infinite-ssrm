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
import { useTrackedGridEditing } from '@/shared/grid/editing/useTrackedGridEditing';
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
import { TransactionEditingControls } from './TransactionEditingControls';
import { transactionEditingConfig } from './transactionEditing';
import { transactionColumns } from './transactionColumns';
import { mapTransactionGridRequest } from './transactionRequest.mapper';

/**
 * Grid State persistence key is row-model-specific because Infinite and SSRM may legitimately save
 * different native AG Grid state even when they render the same Transaction columns.
 */
const INFINITE_STATE_KEY = 'transactions:infinite';

/**
 * Stable backend identity is required for native Infinite row selection and local edit restoration
 * to survive cache eviction / RowNode recreation.
 */
const getRowId = ({ data }: GetRowIdParams<Transaction>) => data.id;

export interface TransactionsInfiniteGridProps {
  /** Optional selection mode override used by embedding/tests; config remains the normal source. */
  selectionScope?: InfiniteSelectionMode;
  /** Optional native AG Grid options override; this is not a wrapper-specific option surface. */
  gridOptions?: TransactionsInfiniteGridOptions;
  /** Publishes the logical include/exclude selection without exposing internal selection machinery. */
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
}

/**
 * Concrete Transactions Infinite-grid composition.
 *
 * OWNERSHIP BOUNDARY
 * ------------------
 * This component deliberately owns `<AgGridReact>` and the one authoritative `GridApi` ref. Shared
 * hooks provide narrowly-scoped capabilities around that root (editing, dataset selection support,
 * Grid State persistence), but they do not hide native AG Grid props/events behind an app wrapper.
 *
 * TEMPORARY DEV UI
 * ----------------
 * Developer payload previews are intentionally NOT wired into this root. Temporary diagnostics must
 * not force production lifecycle callbacks, dependency arrays or selection/edit state to exist. The
 * underlying reusable selection/edit helpers remain available for a future real action UI.
 */
export function TransactionsInfiniteGrid({
  selectionScope: selectionScopeOverride,
  gridOptions: gridOptionsOverride,
  onSelectionChange,
}: TransactionsInfiniteGridProps) {
  /** Derived configuration; no independent state lifecycle is required. */
  const selectionScope =
    selectionScopeOverride ?? transactionsGridConfig.infinite.selectionScope;
  const gridOptions =
    gridOptionsOverride ?? transactionsGridConfig.infinite.gridOptions;

  /**
   * Single authoritative imperative AG Grid API for this rendered grid.
   * A ref is correct because assigning the API does not itself change UI.
   */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  /**
   * Failure from the normal Infinite row datasource. This is separate from selection-support errors
   * because supporting totals may fail while ordinary row loading remains usable.
   */
  const [loadError, setLoadError] = useState<string>();

  /**
   * Feature-owned way to load the COMPLETE unfiltered Transaction count. The shared support hook
   * owns request lifetime/error/count state; Transactions owns only the API request shape.
   */
  const loadAllTotal = useCallback(async (signal: AbortSignal) => {
    const { totalCount } = await listTransactions(
      { offset: 0, limit: 1, sort: [], filters: [] },
      signal,
    );
    return totalCount;
  }, []);

  /**
   * Supporting counts required for dataset-level Infinite selection across unloaded rows.
   * `setFilteredTotal` receives AG Grid's accepted model count; reset removes stale old-query data.
   */
  const {
    totalRowCount,
    error: datasetSupportError,
    setFilteredTotal,
    resetFilteredTotal,
  } = useInfiniteDatasetSelectionSupport({
    scope: selectionScope,
    loadAllTotal,
  });

  /**
   * Application-owned logical selection exists only for filtered/all dataset modes. Page/manual
   * selection remains native AG Grid state and is published from `onSelectionChanged` below.
   */
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
    onSelectionChange:
      selectionScope === 'page' ? undefined : onSelectionChange,
  });

  /**
   * Shared edit engine owns cache-surviving mechanics; Transactions supplies row identity, editable
   * fields and typed field reads through `transactionEditingConfig`.
   */
  const {
    editedRowCount,
    handleCellValueChanged,
    lastEdit,
    applyChangesToNodes,
    restoreTrackedEdits,
  } = useTrackedGridEditing(transactionEditingConfig);

  /**
   * Reusable current-page edit actions resolve page/selected-page RowNodes from the same root GridApi
   * and delegate mutation to the edit engine.
   */
  const {
    error: editActionError,
    applyLastEdit,
    applyBulkChanges,
  } = useCurrentPageEditActions(
    { lastEdit, applyChangesToNodes },
    gridApi,
  );

  /**
   * Shared bridge persists native AG Grid user preferences while this root still wires the returned
   * native props directly onto `<AgGridReact>`.
   */
  const { initialState, onStateUpdated } =
    useGridStatePersistence<Transaction>({
      key: INFINITE_STATE_KEY,
    });

  /**
   * Feature-specific row loader. AG Grid request translation stays at the Transactions boundary;
   * successful recovery clears the visible row-load error after a request actually succeeds.
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
        onError: () =>
          setLoadError('Rows could not be loaded. Please retry.'),
      }),
    [loadRows],
  );

  /**
   * Dataset selection can describe unloaded records while AG Grid checkboxes exist only for loaded
   * RowNodes. Reconcile materialised nodes from logical include/exclude state. Page mode skips this
   * because native selection already owns its rows.
   */
  const syncLoadedDatasetCheckboxes = useCallback(() => {
    if (selectionScope === 'page') return;

    gridApi.current?.forEachNode((node) => {
      if (!node.data) return;

      const shouldBeChecked = isRowSelected(node.data.id);

      if (node.isSelected() !== shouldBeChecked) {
        /** API source prevents visual reconciliation from becoming a new user selection action. */
        node.setSelected(shouldBeChecked, false, 'api');
      }
    });
  }, [isRowSelected, selectionScope]);

  /**
   * Runs after AG Grid changes its accepted model. Filtered totals are read from that accepted model
   * rather than overlapping datasource responses, avoiding stale-request races.
   */
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

    /** Logical selection can change without AG Grid replacing RowNodes, so refresh visible state. */
    syncLoadedDatasetCheckboxes();
    gridApi.current?.refreshHeader();
  }, [datasetSelectionIntent, selectionScope, syncLoadedDatasetCheckboxes]);

  /**
   * Configure only AG Grid's dedicated selection column. Page mode keeps native row selection with a
   * current-page header; dataset modes need an application header for unloaded filtered/all rows.
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
        ...headerState,
        label: headerLabel,
        onChange: setHeaderSelected,
      },
    };
  }, [headerLabel, headerState, selectionScope, setHeaderSelected]);

  /** Capture the root GridApi and defer model-derived reads until AG Grid constructs initial rows. */
  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;
      window.setTimeout(updateAfterRowsChange, 0);
    },
    [updateAfterRowsChange],
  );

  /** Restore local unsaved edits when the first set of RowNodes is materialised. */
  const handleFirstDataRendered = useCallback(
    (event: FirstDataRenderedEvent<Transaction>) =>
      restoreTrackedEdits(event.api),
    [restoreTrackedEdits],
  );

  /** Restore local edits when pagination/cache churn creates different RowNodes. */
  const handleViewportChanged = useCallback(
    (event: ViewportChangedEvent<Transaction>) =>
      restoreTrackedEdits(event.api),
    [restoreTrackedEdits],
  );

  /**
   * Dataset-mode user checkbox changes update logical include/exclude state. API-sourced events are
   * ignored because they were emitted by our own checkbox reconciliation.
   */
  const handleRowSelected = useCallback(
    (event: RowSelectedEvent<Transaction>) => {
      if (
        selectionScope === 'page' ||
        event.source === 'api' ||
        !event.data
      ) {
        return;
      }

      setRowSelected(
        event.data.id,
        event.node.isSelected() === true,
      );
    },
    [selectionScope, setRowSelected],
  );

  /**
   * Page mode publishes native AG Grid selection. Dataset modes publish from `useDatasetSelection`,
   * so this event intentionally does not create a second publication path for those modes.
   */
  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<Transaction>) => {
      if (selectionScope !== 'page') return;

      const nativeSelection = event.api.getState().rowSelection;
      onSelectionChange?.({
        mode: 'include',
        ids: Array.isArray(nativeSelection) ? nativeSelection : [],
      });
    },
    [onSelectionChange, selectionScope],
  );

  /**
   * A filter change starts a new server query: clear old row-load error, reset the old filtered
   * count, then let dataset-selection semantics decide whether logical selection must reset.
   */
  const handleFilterChanged = useCallback(() => {
    setLoadError(undefined);

    if (selectionScope === 'filtered') {
      resetFilteredTotal();
    }

    if (selectionScope !== 'page') {
      onDatasetFilterChanged?.();
    }
  }, [onDatasetFilterChanged, resetFilteredTotal, selectionScope]);

  /** Retry AG Grid's native Infinite cache after removing the currently rendered error overlay. */
  const handleRetryLoad = useCallback(() => {
    setLoadError(undefined);
    gridApi.current?.refreshInfiniteCache();
  }, []);

  return (
    <Stack spacing={2}>
      <TransactionEditingControls
        editedRowCount={editedRowCount}
        lastEdit={lastEdit}
        onApplyLastEdit={applyLastEdit}
        onApplyBulkEdit={applyBulkChanges}
      />

      {editActionError ? (
        <Typography variant="body2" color="warning.main">
          {editActionError}
        </Typography>
      ) : null}

      {datasetSupportError ? (
        <Alert severity="error">{datasetSupportError}</Alert>
      ) : null}

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
              ? { message: loadError, onRetry: handleRetryLoad }
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
          onCellValueChanged={handleCellValueChanged}
          onStateUpdated={onStateUpdated}
        />
      </Box>
    </Stack>
  );
}
