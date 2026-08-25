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
import type {
  Transaction,
  TransactionFilter,
} from '../api/transactions.contracts';
import {
  transactionsGridConfig,
  type TransactionsSsrmGridOptions,
} from '../transactionsGrid.config';
import { TransactionEditingControls } from './TransactionEditingControls';
import {
  buildTransactionBulkSelection,
  type TransactionBulkSelection,
} from './transactionBulkSelection';
import { transactionEditingConfig } from './transactionEditing';
import { transactionColumns } from './transactionColumns';
import { mapTransactionGridRequest } from './transactionRequest.mapper';

/** SSRM and Infinite intentionally persist native Grid State under different keys. */
const SSRM_STATE_KEY = 'transactions:ssrm';

/** Stable backend identity is required for SSRM native selection and edit restoration. */
const getRowId = ({ data }: GetRowIdParams<Transaction>) => data.id;

/**
 * Logical Select-All-Filtered starts as "everything matching the current filter is selected".
 * Excluded IDs are added only when the user manually clears loaded rows afterward.
 */
function createFilteredSelectAllState(): ServerSelection<string> {
  return { mode: 'exclude', ids: new Set<string>() };
}

export interface TransactionsSsrmGridProps {
  /** Optional native AG Grid options override; the component still renders `AgGridReact` directly. */
  gridOptions?: TransactionsSsrmGridOptions;
}

/**
 * Concrete Transactions SSRM composition.
 *
 * ROOT OWNERSHIP
 * --------------
 * This root owns `<AgGridReact>` and one authoritative `GridApi` ref. Native SSRM selection remains
 * AG Grid-owned whenever AG Grid can represent it. Application state exists only for behavior AG Grid
 * cannot express directly (notably Select All Filtered), unsaved edits, user-facing errors and
 * temporary developer previews.
 *
 * SSRM-specific selection is intentionally still explicit here. We should extract it only after the
 * SSRM semantics are fully agreed, rather than prematurely forcing Infinite and SSRM into one model.
 */
export function TransactionsSsrmGrid({
  gridOptions: gridOptionsOverride,
}: TransactionsSsrmGridProps) {
  /** Derived configuration, not independent React state. */
  const gridOptions =
    gridOptionsOverride ?? transactionsGridConfig.ssrm.gridOptions;

  /**
   * Single authoritative imperative API for this rendered SSRM grid.
   * A ref is correct because assigning the API itself is not renderable state.
   */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  /**
   * Normal datasource failure shown through the AG Grid overlay.
   * This is intentionally independent of `selectionError`, because rows can load correctly while a
   * custom selection operation fails.
   */
  const [loadError, setLoadError] = useState<string>();

  /** User-facing failure from custom SSRM selection actions such as Current Page / All Filtered. */
  const [selectionError, setSelectionError] = useState<string>();

  /**
   * Application-owned state ONLY while Select-All-Filtered is active.
   *
   * `undefined` means native SSRM selection is authoritative. When defined, this include/exclude
   * state represents selection across unloaded filtered rows that AG Grid cannot model natively.
   */
  const [filteredSelection, setFilteredSelection] =
    useState<ServerSelection<string>>();

  /**
   * Temporary developer-only presentation state.
   * These values must never become an input to production selection/edit behavior; they only snapshot
   * already-computed production state for inspection.
   */
  const [preview, setPreview] = useState<TransactionBulkSelection>();
  const [previewError, setPreviewError] = useState<string>();
  const [showAllLocalEdits, setShowAllLocalEdits] = useState(false);

  /**
   * Shared cache-surviving edit engine. Transactions supplies only its editable-field/row config.
   * Destructuring keeps downstream callback dependencies explicit and avoids opaque hook-result deps.
   */
  const {
    editedRowCount,
    handleCellValueChanged,
    lastEdit,
    applyChangesToNodes,
    restoreTrackedEdits,
    payload: editPayload,
  } = useTrackedGridEditing(transactionEditingConfig);

  /**
   * Shared page/selected-page edit actions use this root's SAME GridApi; no second API owner exists.
   */
  const {
    error: editActionError,
    applyLastEdit,
    applyBulkChanges,
  } = useCurrentPageEditActions(
    { lastEdit, applyChangesToNodes },
    gridApi,
  );

  /** Native AG Grid preference persistence without introducing a grid wrapper. */
  const { initialState, onStateUpdated } =
    useGridStatePersistence<Transaction>({
      key: SSRM_STATE_KEY,
    });

  /**
   * Feature-specific server-row loader. AG Grid request translation stays under Transactions because
   * shared datasource code should not know the backend's Transaction query contract.
   */
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

  /**
   * Keep datasource identity stable across ordinary renders so SSRM cache/store state is not reset.
   * Cache block size is a real datasource dependency because it changes the server request boundary.
   */
  const datasource = useMemo(
    () =>
      createServerSideDatasource<Transaction>({
        loadRows,
        onError: () =>
          setLoadError('Rows could not be loaded. Please retry.'),
        defaultBlockSize: gridOptions.cacheBlockSize ?? 100,
      }),
    [gridOptions.cacheBlockSize, loadRows],
  );

  /** Capture the single root GridApi when AG Grid is ready. */
  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;
    },
    [],
  );

  /** Reapply unsaved edits when the first materialised RowNodes arrive. */
  const handleFirstDataRendered = useCallback(
    (event: FirstDataRenderedEvent<Transaction>) =>
      restoreTrackedEdits(event.api),
    [restoreTrackedEdits],
  );

  /** Reapply unsaved edits when SSRM store/pagination changes materialise different RowNodes. */
  const handleViewportChanged = useCallback(
    (event: ViewportChangedEvent<Transaction>) =>
      restoreTrackedEdits(event.api),
    [restoreTrackedEdits],
  );

  /** Clear stale developer selection snapshots whenever real selection/filter state changes. */
  const clearPreview = useCallback(() => {
    setPreview(undefined);
    setPreviewError(undefined);
  }, []);

  /**
   * Reconcile currently LOADED RowNodes from logical Select-All-Filtered include/exclude state.
   *
   * The logical state can describe unloaded rows, while AG Grid checkboxes exist only for materialised
   * nodes. API-sourced selection is used so this visual reconciliation does not look like a user event.
   */
  const syncLoadedFilteredSelection = useCallback(
    (
      selection: ServerSelection<string>,
      api = gridApi.current,
    ) => {
      if (!api) return;

      api.forEachNode((node) => {
        if (!node.data) return;

        const shouldBeSelected = isServerRowSelected(
          selection,
          node.data.id,
        );

        if (node.isSelected() !== shouldBeSelected) {
          node.setSelected(shouldBeSelected, false, 'api');
        }
      });
    },
    [],
  );

  /** Newly loaded SSRM nodes must inherit custom filtered selection while that mode is active. */
  const handleModelUpdated = useCallback(() => {
    if (filteredSelection) {
      syncLoadedFilteredSelection(filteredSelection);
    }
  }, [filteredSelection, syncLoadedFilteredSelection]);

  /**
   * While custom filtered selection is active, direct user row toggles update its include/exclude
   * exceptions. API-sourced reconciliation events are ignored to avoid feedback loops.
   */
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

  /**
   * Native SSRM Select All takes ownership back from custom Select-All-Filtered.
   * When AG Grid reports native `selectAll`, clear the custom logical state so two selection sources
   * never remain active simultaneously.
   */
  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<Transaction>) => {
      clearPreview();
      if (!filteredSelection) return;

      try {
        const nativeState = readFlatServerSideSelectionState(
          event.serverSideState ??
            gridApi.current?.getServerSideSelectionState(),
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

  /**
   * SSRM has no native "Select current page" mode. Resolve the visible page, clear any dataset-wide
   * native/custom Select All first, then select only those concrete RowNodes via native AG Grid APIs.
   */
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
        api.setServerSideSelectionState(
          createEmptyServerSideSelectionState(),
        );
      }

      if (pageNodes.length > 0) {
        api.setNodesSelected({ nodes: pageNodes, newValue: true });
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
   * Activate custom Select-All-Filtered.
   * Native SSRM selection is cleared first so the custom include/exclude intent becomes the only
   * dataset-wide source of truth, then loaded checkboxes are synchronised from that intent.
   */
  const handleSelectAllFiltered = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    const nextSelection = createFilteredSelectAllState();

    setFilteredSelection(undefined);
    api.setServerSideSelectionState(
      createEmptyServerSideSelectionState(),
    );
    setFilteredSelection(nextSelection);
    syncLoadedFilteredSelection(nextSelection, api);

    setSelectionError(undefined);
    clearPreview();
  }, [clearPreview, syncLoadedFilteredSelection]);

  /**
   * Filter changes invalidate custom Select-All-Filtered because that logical selection described
   * the OLD filtered dataset. Native selection is cleared at the same time to keep ownership singular.
   */
  const handleFilterChanged = useCallback(() => {
    clearPreview();
    if (!filteredSelection) return;

    setFilteredSelection(undefined);
    gridApi.current?.setServerSideSelectionState(
      createEmptyServerSideSelectionState(),
    );
    setSelectionError(undefined);
  }, [clearPreview, filteredSelection]);

  /** Explicitly clear both custom filtered selection and native SSRM selection. */
  const handleClearSelection = useCallback(() => {
    setFilteredSelection(undefined);
    gridApi.current?.setServerSideSelectionState(
      createEmptyServerSideSelectionState(),
    );
    setSelectionError(undefined);
    clearPreview();
  }, [clearPreview]);

  /**
   * Developer-only preview builder.
   * Reads the authoritative selection source at click time: custom filtered intent when active,
   * otherwise native SSRM selection state. This does not perform a backend action.
   */
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
          readFlatServerSideSelectionState(
            api.getServerSideSelectionState(),
          ),
        );

        nextPreview =
          intent.mode === 'include'
            ? buildGridBulkSelection<string, TransactionFilter>(
                intent,
                [],
              )
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

  /** Clear the visible load error and ask AG Grid to retry failed SSRM loads natively. */
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
          if (applyLastEdit(target)) {
            setShowAllLocalEdits(false);
          }
        }}
        onApplyBulkEdit={(target, changes) => {
          if (applyBulkChanges(target, changes)) {
            setShowAllLocalEdits(false);
          }
        }}
        onPreviewPayload={() => setShowAllLocalEdits(true)}
      />

      {editActionError ? (
        <Typography variant="body2" color="warning.main">
          {editActionError}
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
          {JSON.stringify(editPayload, null, 2)}
        </Box>
      ) : null}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <Button
          variant="outlined"
          size="small"
          onClick={handleSelectCurrentPage}
        >
          Select current page
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={handleSelectAllFiltered}
        >
          Select all filtered
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={handleClearSelection}
        >
          Clear selection
        </Button>
        {import.meta.env.DEV ? (
          <Button
            variant="outlined"
            size="small"
            onClick={handlePreviewSelection}
          >
            Preview selection payload
          </Button>
        ) : null}
      </Stack>

      <Typography variant="caption" color="text.secondary">
        SSRM header checkbox selects all records. Current Page and All Filtered are explicit controls
        because SSRM does not support those native Select-All modes.
      </Typography>

      {selectionError ? (
        <Alert severity="warning">{selectionError}</Alert>
      ) : null}

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
              ? { message: loadError, onRetry: handleRetryLoad }
              : undefined
          }
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
