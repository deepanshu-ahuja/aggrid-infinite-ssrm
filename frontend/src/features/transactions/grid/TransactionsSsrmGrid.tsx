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
import {
  isServerRowSelected,
  updateRowSelection,
  type ServerSelection,
} from '@/shared/grid/selection/serverSelection';
import {
  createEmptyServerSideSelectionState,
  readFlatServerSideSelectionState,
} from '@/shared/grid/selection/serverSideSelection';
import { useGridStatePersistence } from '@/shared/grid/state/useGridStatePersistence';
import { listTransactions } from '../api/transactions.api';
import type { Transaction } from '../api/transactions.contracts';
import {
  transactionsGridConfig,
  type TransactionsSsrmGridOptions,
} from '../transactionsGrid.config';
import { TransactionEditingControls } from './TransactionEditingControls';
import { transactionEditingConfig } from './transactionEditing';
import { transactionColumns } from './transactionColumns';
import { mapTransactionGridRequest } from './transactionRequest.mapper';

/** Separate persisted native Grid State for the SSRM instance. */
const SSRM_STATE_KEY = 'transactions:ssrm';

/** Stable backend identity is required by SSRM native selection and local edit restoration. */
const getRowId = ({ data }: GetRowIdParams<Transaction>) => data.id;

/**
 * Custom logical selection used only for SSRM's unsupported Select All Filtered behavior.
 * `exclude + []` means every row in the CURRENT filtered dataset is logically selected.
 */
function createFilteredSelectAllState(): ServerSelection<string> {
  return { mode: 'exclude', ids: new Set<string>() };
}

export interface TransactionsSsrmGridProps {
  /** Optional native AG Grid options override for tests/embedding. */
  gridOptions?: TransactionsSsrmGridOptions;
}

/**
 * Concrete Transactions SSRM composition.
 *
 * Native SSRM selection remains the source of truth wherever AG Grid supports the required behavior.
 * Application state exists only for the missing Select All Filtered semantics and user-facing errors.
 * Temporary developer payload previews are deliberately not wired into this production-shaped root.
 */
export function TransactionsSsrmGrid({
  gridOptions: gridOptionsOverride,
}: TransactionsSsrmGridProps) {
  const gridOptions =
    gridOptionsOverride ?? transactionsGridConfig.ssrm.gridOptions;

  /** Single authoritative AG Grid API; assigning it is imperative state and should not rerender UI. */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  /** Normal SSRM datasource failure rendered through AG Grid's active error overlay. */
  const [loadError, setLoadError] = useState<string>();

  /** User-facing failure for custom selection operations such as unresolved current-page rows. */
  const [selectionError, setSelectionError] = useState<string>();

  /**
   * Application-owned logical state ONLY while Select All Filtered is active. `undefined` means SSRM
   * native selection is authoritative again. Filter changes invalidate this custom state.
   */
  const [filteredSelection, setFilteredSelection] =
    useState<ServerSelection<string>>();

  /**
   * Shared editing mechanics are row-model-neutral. Transactions supplies only editable-field and
   * row-identity configuration.
   */
  const {
    editedRowCount,
    handleCellValueChanged,
    lastEdit,
    applyChangesToNodes,
    restoreTrackedEdits,
  } = useTrackedGridEditing(transactionEditingConfig);

  /** Current-page edit behavior is shared with Infinite and consumes the same root GridApi. */
  const {
    error: editActionError,
    applyLastEdit,
    applyBulkChanges,
  } = useCurrentPageEditActions(
    { lastEdit, applyChangesToNodes },
    gridApi,
  );

  /** Persist native AG Grid preference state without wrapping the grid component. */
  const { initialState, onStateUpdated } =
    useGridStatePersistence<Transaction>({
      key: SSRM_STATE_KEY,
    });

  /** Feature-owned loader; request translation remains inside Transactions. */
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

  /** Stable datasource identity prevents ordinary React renders from rebuilding SSRM loading state. */
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

  /** Capture the one authoritative SSRM GridApi. */
  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;
    },
    [],
  );

  /** Restore unsaved local edits when SSRM first materialises RowNodes. */
  const handleFirstDataRendered = useCallback(
    (event: FirstDataRenderedEvent<Transaction>) =>
      restoreTrackedEdits(event.api),
    [restoreTrackedEdits],
  );

  /** Restore unsaved edits again as scrolling/cache changes materialise different RowNodes. */
  const handleViewportChanged = useCallback(
    (event: ViewportChangedEvent<Transaction>) =>
      restoreTrackedEdits(event.api),
    [restoreTrackedEdits],
  );

  /**
   * Custom filtered Select All can describe unloaded rows, so newly materialised RowNodes must be
   * reconciled from the logical include/exclude state. API-sourced selection avoids feedback loops.
   */
  const syncLoadedFilteredSelection = useCallback(
    (selection: ServerSelection<string>, api = gridApi.current) => {
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

  /** Reconcile newly loaded nodes only while the custom filtered-selection mode is active. */
  const handleModelUpdated = useCallback(() => {
    if (filteredSelection) {
      syncLoadedFilteredSelection(filteredSelection);
    }
  }, [filteredSelection, syncLoadedFilteredSelection]);

  /**
   * While Select All Filtered is active, user row toggles update only its exception set. Native-mode
   * row events leave `filteredSelection` undefined and therefore require no custom bookkeeping.
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
    },
    [],
  );

  /**
   * If the native SSRM header selects All Records while custom filtered mode is active, native state
   * wins and the custom state is discarded. Flat selection assumes `groupSelects: 'self'`.
   */
  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<Transaction>) => {
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
        /** Revisit this flat-selection assumption if grouping is introduced. */
      }
    },
    [filteredSelection],
  );

  /**
   * SSRM has no native current-page Select All mode. Resolve the visible pagination page, leave any
   * dataset-wide mode if necessary, then use native explicit node selection for exactly those rows.
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

      /** Dataset-wide native/custom modes must be cleared before adding an explicit current page. */
      if (nativeState.selectAll || wasFilteredSelectAll) {
        api.setServerSideSelectionState(
          createEmptyServerSideSelectionState(),
        );
      }

      if (pageNodes.length > 0) {
        api.setNodesSelected({
          nodes: pageNodes,
          newValue: true,
        });
      }

      setSelectionError(undefined);
    } catch (error) {
      setSelectionError(
        error instanceof Error
          ? error.message
          : 'Current-page selection could not be applied.',
      );
    }
  }, [filteredSelection]);

  /**
   * Enter custom Select All Filtered mode. Native SSRM selection is cleared first so there is one
   * active dataset-selection semantic, then currently loaded nodes are visually reconciled.
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
  }, [syncLoadedFilteredSelection]);

  /**
   * A new filter defines a new dataset. Only custom filtered Select All is invalidated; native All
   * Records remains meaningful because it represents the complete dataset independent of visibility.
   */
  const handleFilterChanged = useCallback(() => {
    if (!filteredSelection) return;

    setFilteredSelection(undefined);
    gridApi.current?.setServerSideSelectionState(
      createEmptyServerSideSelectionState(),
    );
    setSelectionError(undefined);
  }, [filteredSelection]);

  /** Explicit user command clears both custom filtered state and native SSRM selection. */
  const handleClearSelection = useCallback(() => {
    setFilteredSelection(undefined);
    gridApi.current?.setServerSideSelectionState(
      createEmptyServerSideSelectionState(),
    );
    setSelectionError(undefined);
  }, []);

  /** Clear the rendered load error and ask AG Grid to retry failed SSRM blocks natively. */
  const handleRetryLoad = useCallback(() => {
    setLoadError(undefined);
    gridApi.current?.retryServerSideLoads();
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
      </Stack>

      <Typography variant="caption" color="text.secondary">
        SSRM header checkbox selects all records. Current Page and All Filtered are explicit controls
        because SSRM does not support those native Select-All modes.
      </Typography>

      {selectionError ? (
        <Alert severity="warning">{selectionError}</Alert>
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
