import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
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
import type { InfiniteSelectionMode, ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';
import { browserGridStateStore } from '@/shared/grid/state/gridStatePersistence';
import { listTransactions } from '../api/transactions.api';
import type { Transaction } from '../api/transactions.contracts';
import {
  transactionsGridConfig,
  type TransactionsInfiniteGridOptions,
} from '../transactionsGrid.config';
import { TransactionEditingControls } from './TransactionEditingControls';
import {
  buildTransactionBulkSelection,
  type TransactionBulkSelection,
} from './transactionBulkSelection';
import {
  buildSelectedTransactionUpdatePayload,
  useTransactionEditing,
  type TransactionUpdatePayload,
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
 * ROOT OWNERSHIP RULE
 * -------------------
 * This component owns the actual `<AgGridReact>` and ONE authoritative `GridApi` ref. Native filter,
 * sort, pagination and ordinary selection information is read from that API when needed; it is not
 * mirrored upward through React state/refs.
 *
 * Application state remains only where Infinite cannot represent the business meaning:
 * - dataset-wide Select All over unloaded filtered/all records;
 * - accumulated unsaved edits keyed by stable transaction ID;
 * - supporting totals/errors and temporary development preview UI.
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

  /** The single authoritative AG Grid API for this rendered Infinite grid. */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  const [loadError, setLoadError] = useState<string>();
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [allTotal, setAllTotal] = useState(0);
  const [totalError, setTotalError] = useState<string>();

  /** Development presentation state only; these do not duplicate AG Grid state. */
  const [selectionPreview, setSelectionPreview] =
    useState<TransactionBulkSelection>();
  const [selectionPreviewError, setSelectionPreviewError] = useState<string>();
  const [selectedEditPreview, setSelectedEditPreview] =
    useState<TransactionUpdatePayload>();
  const [showAllLocalEdits, setShowAllLocalEdits] = useState(false);

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

  const clearActionPreviews = useCallback(() => {
    setSelectionPreview(undefined);
    setSelectionPreviewError(undefined);
    setSelectedEditPreview(undefined);
  }, []);

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

    syncLoadedDatasetCheckboxes();
    gridApi.current?.refreshHeader();
  }, [datasetSelection.intent, selectionScope, syncLoadedDatasetCheckboxes]);

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
          clearActionPreviews();
        },
      },
    };
  }, [
    clearActionPreviews,
    datasetSelection.headerLabel,
    datasetSelection.headerState,
    datasetSelection.setHeaderSelected,
    selectionScope,
  ]);

  const readPageSelectionIntent = useCallback((): ServerSelectionIntent<string> => {
    const nativeSelection = gridApi.current?.getState().rowSelection;

    return {
      mode: 'include',
      ids: Array.isArray(nativeSelection) ? nativeSelection : [],
    };
  }, []);

  const readLogicalSelection = useCallback(
    () =>
      selectionScope === 'page'
        ? readPageSelectionIntent()
        : datasetSelection.intent,
    [datasetSelection.intent, readPageSelectionIntent, selectionScope],
  );

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

  const handleRowSelected = useCallback(
    (event: RowSelectedEvent<Transaction>) => {
      if (selectionScope === 'page') return;
      if (event.source === 'api' || !event.data) return;

      datasetSelection.setRowSelected(
        event.data.id,
        event.node.isSelected() === true,
      );
      clearActionPreviews();
    },
    [clearActionPreviews, datasetSelection.setRowSelected, selectionScope],
  );

  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<Transaction>) => {
      clearActionPreviews();

      if (selectionScope !== 'page') return;

      const nativeSelection = event.api.getState().rowSelection;
      onSelectionChange?.({
        mode: 'include',
        ids: Array.isArray(nativeSelection) ? nativeSelection : [],
      });
    },
    [clearActionPreviews, onSelectionChange, selectionScope],
  );

  const handleFilterChanged = useCallback(() => {
    setLoadError(undefined);
    clearActionPreviews();

    if (selectionScope === 'filtered') {
      setFilteredTotal(0);
    }

    if (selectionScope !== 'page') {
      datasetSelection.onFilterChanged?.();
    }
  }, [clearActionPreviews, datasetSelection.onFilterChanged, selectionScope]);

  /**
   * Reads native filter state from THIS root GridApi only when the action needs it. No filter ref,
   * filter callback bridge or duplicate React state is maintained.
   */
  const handlePreviewSelectionPayload = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;

    try {
      const selection = readLogicalSelection();
      const nextPreview =
        selectionScope === 'filtered'
          ? buildTransactionBulkSelection(selection, {
              selectionScope: 'filtered',
              filterModel: api.getFilterModel(),
            })
          : buildTransactionBulkSelection(selection, {
              selectionScope,
            });

      setSelectionPreview(nextPreview);
      setSelectionPreviewError(undefined);
    } catch (error) {
      setSelectionPreview(undefined);
      setSelectionPreviewError(
        error instanceof Error
          ? error.message
          : 'The selection payload could not be built.',
      );
    }
  }, [readLogicalSelection, selectionScope]);

  const handlePreviewSelectedEdits = useCallback(() => {
    setSelectedEditPreview(
      buildSelectedTransactionUpdatePayload(
        editing.state,
        readLogicalSelection(),
      ),
    );
  }, [editing.state, readLogicalSelection]);

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

      {import.meta.env.DEV ? (
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ sm: 'center' }}
          >
            <Button
              variant="outlined"
              size="small"
              onClick={handlePreviewSelectionPayload}
            >
              Preview selection payload
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={handlePreviewSelectedEdits}
            >
              Preview selected edit payload
            </Button>
            <Typography variant="caption" color="text.secondary">
              Development validation only — no backend action is called.
            </Typography>
          </Stack>

          {showAllLocalEdits ? (
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

          {selectionPreviewError ? (
            <Alert severity="error">{selectionPreviewError}</Alert>
          ) : null}

          {selectionPreview ? (
            <Box
              component="pre"
              data-testid="selection-payload-preview"
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
              {JSON.stringify(selectionPreview, null, 2)}
            </Box>
          ) : null}

          {selectedEditPreview ? (
            <Box
              component="pre"
              data-testid="selected-edit-payload-preview"
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
              {JSON.stringify(selectedEditPreview, null, 2)}
            </Box>
          ) : null}
        </Stack>
      ) : null}

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
