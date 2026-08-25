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
 * WHAT STAYS FEATURE-SPECIFIC
 * ---------------------------
 * Transaction columns, request mapping, API calls, editable-field configuration and final backend
 * selection payload mapping remain here/under the Transactions feature.
 */
export function TransactionsInfiniteGrid({
  selectionScope: selectionScopeOverride,
  gridOptions: gridOptionsOverride,
  onSelectionChange,
}: TransactionsInfiniteGridProps) {
  /**
   * These are derived configuration values, not React state: a render is already triggered when the
   * caller changes an override, and there is no independent lifecycle for these values to manage.
   */
  const selectionScope =
    selectionScopeOverride ?? transactionsGridConfig.infinite.selectionScope;
  const gridOptions =
    gridOptionsOverride ?? transactionsGridConfig.infinite.gridOptions;

  /**
   * Single authoritative imperative AG Grid API for this rendered grid.
   *
   * A ref is correct because assigning the API does not itself change UI. Consumers read it only for
   * imperative/native operations such as retry, reading Grid State/filter state, synchronising loaded
   * checkboxes, or resolving current-page edit targets.
   */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  /**
   * Failure from the normal Infinite row datasource.
   *
   * React state is required because the active AG Grid overlay depends on it. This is intentionally
   * separate from `datasetSupportError`: supporting totals may fail while ordinary row loading works.
   */
  const [loadError, setLoadError] = useState<string>();

  /**
   * Feature-owned implementation for loading the COMPLETE unfiltered Transaction count.
   *
   * The shared selection-support hook owns when this is requested/aborted and how its error/count is
   * stored. Transactions owns only the API contract and request shape. Limit 1 avoids transferring a
   * full page when only `totalCount` is needed.
   */
  const loadAllTotal = useCallback(async (signal: AbortSignal) => {
    const { totalCount } = await listTransactions(
      { offset: 0, limit: 1, sort: [], filters: [] },
      signal,
    );
    return totalCount;
  }, []);

  /**
   * Query-count support required only because Infinite cannot natively represent unloaded dataset
   * selection. `setFilteredTotal` is fed from AG Grid's accepted model; `resetFilteredTotal` clears a
   * stale old-query count immediately when filters change.
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
   * Application-owned logical selection exists only for filtered/all dataset modes.
   *
   * Page mode remains native AG Grid selection; in that mode this controller is not the published
   * source of truth. Destructuring the individual capabilities also keeps hook dependencies explicit
   * instead of depending on an opaque controller object.
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
   * Shared edit engine owns cache-surviving mechanics; Transactions supplies only row identity,
   * editable fields and typed field reads through `transactionEditingConfig`.
   */
  const {
    state: editingState,
    editedRowCount,
    handleCellValueChanged,
    lastEdit,
    applyChangesToNodes,
    restoreTrackedEdits,
    payload: editPayload,
  } = useTrackedGridEditing(transactionEditingConfig);

  /**
   * Reusable current-page edit actions consume the SAME root GridApi. They resolve either the whole
   * visible page or its selected RowNodes, then delegate the actual mutations to the edit engine.
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
   * Page/manual selection is native AG Grid state, so read it only when an action needs it rather
   * than mirroring selected IDs into another React collection.
   */
  const readPageSelectionIntent = useCallback(
    (): ServerSelectionIntent<string> => {
      const nativeSelection = gridApi.current?.getState().rowSelection;

      return {
        mode: 'include',
        ids: Array.isArray(nativeSelection) ? nativeSelection : [],
      };
    },
    [],
  );

  /**
   * Gives production actions one logical-selection reader while preserving the ownership split:
   * native Grid State for page mode, application include/exclude intent for dataset modes.
   */
  const readLogicalSelection = useCallback(
    () =>
      selectionScope === 'page'
        ? readPageSelectionIntent()
        : datasetSelectionIntent,
    [datasetSelectionIntent, readPageSelectionIntent, selectionScope],
  );

  /**
   * Production-capable selection payload builder.
   *
   * Dev Tools call this today, but the logic deliberately lives outside `/dev` because a future real
   * Delete/Export/Bulk Update UI needs the same current selection + applied-filter translation.
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
      : buildTransactionBulkSelection(selection, { selectionScope });
  }, [readLogicalSelection, selectionScope]);

  /**
   * Production-capable intersection of tracked edits with the CURRENT logical selection.
   * Selected-but-unedited rows and edited-but-unselected rows are both omitted.
   */
  const buildSelectedEditPayload = useCallback(
    () =>
      buildSelectedTrackedGridUpdatePayload(
        editingState,
        readLogicalSelection(),
      ),
    [editingState, readLogicalSelection],
  );

  /**
   * Dev tooling owns snapshots/buttons only. It receives production builders/results and must never
   * become the owner of selection membership, edit intersection, filter reads or target resolution.
   */
  const {
    clearPreviews,
    hideAllLocalEdits,
    showAllLocalEditsPreview,
    devToolsUi,
  } = useTransactionsInfiniteGridDevTools({
    buildSelectionPayload,
    buildSelectedEditPayload,
    editPayload,
  });

  /**
   * Shared bridge persists native AG Grid user preferences while this root still wires the returned
   * native `initialState` / `onStateUpdated` props directly onto `<AgGridReact>`.
   */
  const { initialState, onStateUpdated } =
    useGridStatePersistence<Transaction>({
      key: INFINITE_STATE_KEY,
    });

  /**
   * Feature-specific row loader.
   *
   * AG Grid request translation stays at the Transactions boundary. Successful recovery clears the
   * visible row-load error only after a request actually succeeds.
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

  /**
   * Stable datasource identity is important: recreating the Infinite datasource on ordinary React
   * renders would reset AG Grid cache/request state. Only the stable `loadRows` dependency belongs here.
   */
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
   * Dataset selection can describe unloaded records, while AG Grid checkboxes exist only for loaded
   * RowNodes. Reconcile those materialised nodes from the logical include/exclude intent whenever
   * rows or selection change. Page mode skips this because native selection already owns its nodes.
   */
  const syncLoadedDatasetCheckboxes = useCallback(() => {
    if (selectionScope === 'page') return;

    gridApi.current?.forEachNode((node) => {
      if (!node.data) return;

      const shouldBeChecked = isRowSelected(node.data.id);

      if (node.isSelected() !== shouldBeChecked) {
        /** `api` source prevents visual reconciliation from becoming a new user selection event. */
        node.setSelected(shouldBeChecked, false, 'api');
      }
    });
  }, [isRowSelected, selectionScope]);

  /**
   * Runs only after AG Grid's current row model changes.
   *
   * For filtered Select All, read the count from AG Grid's ACCEPTED model instead of directly from
   * overlapping datasource responses; that avoids an older request racing to publish a stale total.
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

    /**
     * Logical selection can change without AG Grid replacing RowNodes. Refresh loaded checkbox state
     * and the custom header from application-owned intent; no duplicate selected-ID state is created.
     */
    syncLoadedDatasetCheckboxes();
    gridApi.current?.refreshHeader();
  }, [datasetSelectionIntent, selectionScope, syncLoadedDatasetCheckboxes]);

  /**
   * Configure only AG Grid's dedicated selection column.
   *
   * Page mode uses the custom current-page header while keeping native row selection. Dataset modes
   * use the application header because Infinite cannot select unloaded filtered/all records natively.
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
        onChange: (checked: boolean) => {
          setHeaderSelected(checked);
          clearPreviews();
        },
      },
    };
  }, [
    clearPreviews,
    headerLabel,
    headerState,
    selectionScope,
    setHeaderSelected,
  ]);

  /** Capture the one root GridApi and defer model-derived reads until AG Grid builds initial rows. */
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

  /** Restore local edits again when pagination/cache churn creates different RowNodes. */
  const handleViewportChanged = useCallback(
    (event: ViewportChangedEvent<Transaction>) =>
      restoreTrackedEdits(event.api),
    [restoreTrackedEdits],
  );

  /**
   * In dataset modes, user checkbox changes update logical include/exclude state.
   * API-sourced events are ignored because they were emitted by our own checkbox reconciliation.
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
      clearPreviews();
    },
    [clearPreviews, selectionScope, setRowSelected],
  );

  /**
   * Page mode publishes native AG Grid selection. Dataset modes publish from `useDatasetSelection`,
   * so this handler intentionally does not create a second publication path for those modes.
   */
  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<Transaction>) => {
      clearPreviews();
      if (selectionScope !== 'page') return;

      const nativeSelection = event.api.getState().rowSelection;
      onSelectionChange?.({
        mode: 'include',
        ids: Array.isArray(nativeSelection) ? nativeSelection : [],
      });
    },
    [clearPreviews, onSelectionChange, selectionScope],
  );

  /**
   * A filter change starts a new server query.
   *
   * - row-load error is cleared so an old failure does not mask a fresh request;
   * - dev snapshots are invalidated because they describe old grid state;
   * - filtered total is reset because the old count belongs to the old query;
   * - dataset-selection semantics decide whether their logical selection must also reset.
   */
  const handleFilterChanged = useCallback(() => {
    setLoadError(undefined);
    clearPreviews();

    if (selectionScope === 'filtered') {
      resetFilteredTotal();
    }

    if (selectionScope !== 'page') {
      onDatasetFilterChanged?.();
    }
  }, [
    clearPreviews,
    onDatasetFilterChanged,
    resetFilteredTotal,
    selectionScope,
  ]);

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
        onApplyLastEdit={(target) => {
          if (applyLastEdit(target)) hideAllLocalEdits();
        }}
        onApplyBulkEdit={(target, changes) => {
          if (applyBulkChanges(target, changes)) hideAllLocalEdits();
        }}
        onPreviewPayload={showAllLocalEditsPreview}
      />

      {editActionError ? (
        <Typography variant="body2" color="warning.main">
          {editActionError}
        </Typography>
      ) : null}

      {devToolsUi}

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
