import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type {
  FilterModel,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  IRowNode,
  RowSelectedEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { createServerSideDatasource } from '@/shared/grid/data/server-side/createServerSideDatasource';
import { GridErrorOverlay } from '@/shared/grid/overlays/GridErrorOverlay';
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
import { listTransactions } from '../api/transactions.api';
import type {
  Transaction,
  TransactionFilter,
} from '../api/transactions.contracts';
import type { TransactionsSsrmGridOptions } from '../transactionsGrid.config';
import {
  buildTransactionBulkSelection,
  type TransactionBulkSelection,
} from './transactionBulkSelection';
import { transactionColumns } from './transactionColumns';
import { mapTransactionGridRequest } from './transactionRequest.mapper';

/**
 * Stable backend identity is required for SSRM server-side selection state.
 *
 * Sorting, filtering, pagination, cache eviction and store refreshes can move/recreate RowNodes, but
 * a Transaction ID remains the same logical record.
 */
const getRowId = ({ data }: GetRowIdParams<Transaction>) => data.id;

/**
 * Custom state used ONLY for the capability AG Grid SSRM does not natively provide:
 * Select All Filtered across unloaded server rows.
 *
 * `exclude + []`
 *     all rows in the captured filtered dataset are selected.
 *
 * `exclude + [A]`
 *     all rows in that dataset except A are selected.
 */
function createFilteredSelectAllState(): ServerSelection<string> {
  return {
    mode: 'exclude',
    ids: new Set<string>(),
  };
}

export interface TransactionsSsrmGridProps {
  /** Native SSRM pagination/cache options assembled by Transactions configuration. */
  gridOptions: TransactionsSsrmGridOptions;
}

/**
 * Transactions implementation backed by AG Grid Enterprise Server-Side Row Model (SSRM).
 *
 * SELECTION BOUNDARY
 * ------------------
 * Use AG Grid natively whenever SSRM already supports the requirement:
 *
 * - individual/manual rows -> native SSRM selection;
 * - native header checkbox -> native SSRM All Records;
 * - unloaded all-record selection -> `getServerSideSelectionState()` rules.
 *
 * AG Grid SSRM explicitly does NOT support native Select-All modes `currentPage` or `filtered`.
 * Therefore those two optional client behaviours are explicit controls:
 *
 * - Select current page -> native selection over the loaded RowNodes on the current pagination page;
 * - Select all filtered -> small application-owned include/exclude state + captured filter model.
 *
 * We intentionally do NOT copy the complete Infinite selection implementation into SSRM.
 */
export function TransactionsSsrmGrid({
  gridOptions,
}: TransactionsSsrmGridProps) {
  /** Imperative API for native SSRM selection, pagination and failed-load retry. */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  /** Datasource failure shown inside AG Grid using the shared Active Overlay. */
  const [loadError, setLoadError] = useState<string>();

  /** Readable error for a selection command/adapter mismatch. */
  const [selectionError, setSelectionError] = useState<string>();

  /**
   * Undefined means AG Grid's native SSRM selection state is the source of truth.
   *
   * Defined means the user explicitly chose Select All Filtered, which SSRM cannot represent
   * natively across unloaded rows.
   */
  const [filteredSelection, setFilteredSelection] =
    useState<ServerSelection<string>>();

  /**
   * Snapshot of the APPLIED AG Grid filter model that defined Select All Filtered.
   *
   * This is intentionally captured at selection time. A later filter change clears filtered Select
   * All rather than silently reinterpreting its exceptions against a new query.
   */
  const [filteredSelectionFilterModel, setFilteredSelectionFilterModel] =
    useState<FilterModel>({});

  /** Temporary browser-validation payload; no real bulk endpoint is called. */
  const [preview, setPreview] = useState<TransactionBulkSelection>();
  const [previewError, setPreviewError] = useState<string>();

  /**
   * Feature/domain loader. The shared SSRM datasource owns AG Grid callback plumbing; this callback
   * owns Transactions request mapping and API access.
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

  /** Keep one datasource identity across ordinary React renders. */
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

  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;
    },
    [],
  );

  /** A preview is a snapshot, so clear it whenever selection meaning changes. */
  const clearPreview = useCallback(() => {
    setPreview(undefined);
    setPreviewError(undefined);
  }, []);

  /**
   * Makes currently loaded RowNodes visually agree with custom Select All Filtered state.
   *
   * `api.forEachNode()` visits loaded SSRM RowNodes only. Unloaded matching rows remain represented
   * logically by `exclude`; loaded/reloaded rows receive their checkbox state here.
   *
   * Source `api` prevents programmatic checkbox restoration from feeding back into our custom
   * exception list through `onRowSelected`.
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

  /** Restore custom filtered selection when SSRM creates/reloads RowNodes. */
  const handleModelUpdated = useCallback(() => {
    if (!filteredSelection) return;
    syncLoadedFilteredSelection(filteredSelection);
  }, [filteredSelection, syncLoadedFilteredSelection]);

  /**
   * Row checkbox changes stay native unless custom Select All Filtered is active. In filtered mode,
   * unchecked rows become exceptions (`exclude [id]`). API-driven checkbox sync is ignored.
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
   * If custom filtered Select All is active and the native header moves SSRM to `selectAll: true`,
   * the user has explicitly switched to native All Records, so discard the custom filter context.
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
          setFilteredSelectionFilterModel({});
          setSelectionError(undefined);
        }
      } catch {
        /**
         * Transactions is explicitly flat (`groupSelects: 'self'`). If that configuration changes
         * later, the adapter/contract must be reviewed instead of crashing this UI event.
         */
      }
    },
    [clearPreview, filteredSelection],
  );

  /**
   * Collect exactly the RowNodes belonging to the current pagination page.
   *
   * SSRM is asynchronous. If one expected page row is still an unresolved stub, return undefined
   * instead of silently selecting only the subset that happened to finish loading first.
   */
  const getCurrentPageNodes = useCallback(
    (api: GridApi<Transaction>): IRowNode<Transaction>[] | undefined => {
      const pageSize = api.paginationGetPageSize();
      const currentPage = api.paginationGetCurrentPage();
      const rowCount = api.paginationGetRowCount();
      const startIndex = currentPage * pageSize;
      const endIndex = Math.min(startIndex + pageSize, rowCount);

      const nodes: IRowNode<Transaction>[] = [];

      for (let rowIndex = startIndex; rowIndex < endIndex; rowIndex += 1) {
        const node = api.getDisplayedRowAtIndex(rowIndex);

        if (!node?.data) return undefined;
        nodes.push(node);
      }

      return nodes;
    },
    [],
  );

  /**
   * Explicit Current Page command.
   *
   * Ordinary manual selection is preserved and the page IDs are added to it. If a dataset-wide mode
   * is active (native All Records or custom All Filtered), Current Page first returns to ordinary
   * explicit selection so incompatible meanings are not mixed.
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
      setFilteredSelectionFilterModel({});

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
      clearPreview();
    } catch (error) {
      setSelectionError(
        error instanceof Error
          ? error.message
          : 'Current-page selection could not be applied.',
      );
    }
  }, [clearPreview, filteredSelection, getCurrentPageNodes]);

  /**
   * Explicit Select All Filtered command.
   *
   * SSRM cannot natively express this across unloaded rows. Clear competing native selection,
   * capture the applied filter model, store `exclude + []`, then sync currently loaded rows.
   */
  const handleSelectAllFiltered = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    const nextSelection = createFilteredSelectAllState();

    /** Clear old custom state first so native API-driven deselection cannot become exceptions. */
    setFilteredSelection(undefined);
    setFilteredSelectionFilterModel({});

    api.setServerSideSelectionState(
      createEmptyServerSideSelectionState(),
    );

    const definingFilterModel = api.getFilterModel();

    setFilteredSelectionFilterModel(definingFilterModel);
    setFilteredSelection(nextSelection);
    syncLoadedFilteredSelection(nextSelection, api);

    setSelectionError(undefined);
    clearPreview();
  }, [clearPreview, syncLoadedFilteredSelection]);

  /**
   * Filter changes invalidate only custom Select All Filtered. Native manual selection and native
   * All Records remain AG Grid-owned and are preserved.
   */
  const handleFilterChanged = useCallback(() => {
    clearPreview();

    if (!filteredSelection) return;

    setFilteredSelection(undefined);
    setFilteredSelectionFilterModel({});
    gridApi.current?.setServerSideSelectionState(
      createEmptyServerSideSelectionState(),
    );
    setSelectionError(undefined);
  }, [clearPreview, filteredSelection]);

  /** Explicit user clear resets both native and custom filtered selection. */
  const handleClearSelection = useCallback(() => {
    setFilteredSelection(undefined);
    setFilteredSelectionFilterModel({});
    gridApi.current?.setServerSideSelectionState(
      createEmptyServerSideSelectionState(),
    );
    setSelectionError(undefined);
    clearPreview();
  }, [clearPreview]);

  /**
   * Temporary development validation. Builds the exact selection/query payload a future bulk action
   * would use, but deliberately performs NO backend action.
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
            filterModel: filteredSelectionFilterModel,
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
  }, [filteredSelection, filteredSelectionFilterModel]);

  /** SSRM-native failed-load retry; do not rebuild the datasource/cache manually. */
  const handleRetryLoad = useCallback(() => {
    setLoadError(undefined);
    gridApi.current?.retryServerSideLoads();
  }, []);

  return (
    <Stack spacing={1.5}>
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

        <Button
          variant="outlined"
          size="small"
          onClick={handlePreviewSelection}
        >
          Preview selection payload
        </Button>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        SSRM header checkbox selects all records. Current Page and All Filtered are explicit
        controls because SSRM does not support those native Select-All modes.
      </Typography>

      {selectionError ? (
        <Alert severity="warning">{selectionError}</Alert>
      ) : null}

      {previewError ? <Alert severity="error">{previewError}</Alert> : null}

      {preview ? (
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
          rowModelType="serverSide"
          serverSideDatasource={datasource}
          columnDefs={transactionColumns}
          {...gridOptions}
          getRowId={getRowId}
          /**
           * Keep SSRM's supported selection native and explicit.
           *
           * `selectAll: 'all'` keeps the native header as All Records, including unloaded rows.
           * `groupSelects: 'self'` guarantees the flat SSRM selection-state shape used by our adapter.
           */
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
          onModelUpdated={handleModelUpdated}
          onRowSelected={handleRowSelected}
          onSelectionChanged={handleSelectionChanged}
          onFilterChanged={handleFilterChanged}
        />
      </Box>
    </Stack>
  );
}
