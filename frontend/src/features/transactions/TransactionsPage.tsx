import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Box, Card, CardContent, Stack, Typography } from '@mui/material';
import type {
  FirstDataRenderedEvent,
  GridApi,
  IRowNode,
  StateUpdatedEvent,
  ViewportChangedEvent,
} from 'ag-grid-community';
import { browserGridStateStore } from '@/shared/grid/state/gridStatePersistence';
import type { Transaction } from './api/transactions.contracts';
import { TransactionEditingControls } from './grid/TransactionEditingControls';
import {
  type TransactionChanges,
  type TransactionEditTarget,
  useTransactionEditing,
} from './grid/transactionEditing';
import { TransactionsInfiniteGrid } from './grid/TransactionsInfiniteGrid';
import { TransactionsSsrmGrid } from './grid/TransactionsSsrmGrid';
import { transactionsGridConfig } from './transactionsGrid.config';

const INFINITE_STATE_KEY = 'transactions:infinite';
const SSRM_STATE_KEY = 'transactions:ssrm';

/**
 * Resolves exactly the rows on AG Grid's current pagination page.
 *
 * Page is a user/business scope. It is intentionally independent from Infinite/SSRM block sizes and
 * whatever extra rows the browser cache happens to contain.
 */
function getCurrentPageNodes(
  api: GridApi<Transaction>,
): IRowNode<Transaction>[] | undefined {
  const pageSize = api.paginationGetPageSize();
  const currentPage = api.paginationGetCurrentPage();
  const rowCount = api.paginationGetRowCount();
  const startIndex = currentPage * pageSize;
  const endIndex = Math.min(startIndex + pageSize, rowCount);
  const nodes: IRowNode<Transaction>[] = [];

  for (let rowIndex = startIndex; rowIndex < endIndex; rowIndex += 1) {
    const node = api.getDisplayedRowAtIndex(rowIndex);

    /**
     * Server-backed row models can briefly expose unresolved stubs while a page is loading. Refuse a
     * partial bulk edit instead of silently changing only the rows that happened to load first.
     */
    if (!node?.data) return undefined;
    nodes.push(node);
  }

  return nodes;
}

export function TransactionsPage() {
  const gridApi = useRef<GridApi<Transaction> | null>(null);
  const [editingError, setEditingError] = useState<string>();
  const [showEditPayload, setShowEditPayload] = useState(false);

  const editing = useTransactionEditing();

  const infiniteInitialState = useMemo(
    () => browserGridStateStore.load(INFINITE_STATE_KEY),
    [],
  );
  const ssrmInitialState = useMemo(
    () => browserGridStateStore.load(SSRM_STATE_KEY),
    [],
  );

  const handleInfiniteStateUpdated = useCallback(
    (event: StateUpdatedEvent<Transaction>) => {
      browserGridStateStore.save(INFINITE_STATE_KEY, event.state);
    },
    [],
  );

  const handleSsrmStateUpdated = useCallback(
    (event: StateUpdatedEvent<Transaction>) => {
      browserGridStateStore.save(SSRM_STATE_KEY, event.state);
    },
    [],
  );

  /**
   * Capture the native GridApi from events supplied through normal GridOptions. The concrete Infinite
   * and SSRM components still own their own row-model lifecycle; this feature-level reference exists
   * only so the editing controls can resolve the visible current page at action time.
   */
  const handleFirstDataRendered = useCallback(
    (event: FirstDataRenderedEvent<Transaction>) => {
      gridApi.current = event.api;
      editing.restoreTrackedEdits(event.api);
    },
    [editing],
  );

  /**
   * Reconcile edits whenever rendered rows change. This matters when the user edits Page 1, navigates
   * far enough for a server-backed cache block to be evicted, then returns to Page 1 before saving.
   * The backend still returns the original value, so the accumulated client edit is reapplied by ID.
   */
  const handleViewportChanged = useCallback(
    (event: ViewportChangedEvent<Transaction>) => {
      gridApi.current = event.api;
      editing.restoreTrackedEdits(event.api);
    },
    [editing],
  );

  const resolveEditTarget = useCallback((target: TransactionEditTarget) => {
    const api = gridApi.current;

    if (!api) {
      setEditingError('The grid is not ready yet.');
      return undefined;
    }

    const pageNodes = getCurrentPageNodes(api);

    if (!pageNodes) {
      setEditingError('The current page is still loading. Try again when its rows are visible.');
      return undefined;
    }

    const targetNodes =
      target === 'page'
        ? pageNodes
        : pageNodes.filter((node) => node.isSelected() === true);

    if (target === 'selected' && targetNodes.length === 0) {
      setEditingError('No rows are selected on the current page.');
      return undefined;
    }

    setEditingError(undefined);
    return targetNodes;
  }, []);

  /** Flow 1: propagate the user's most recent direct cell edit within the current page only. */
  const handleApplyLastEdit = useCallback(
    (target: TransactionEditTarget) => {
      if (!editing.lastEdit) return;

      const nodes = resolveEditTarget(target);
      if (!nodes) return;

      editing.applyChangesToNodes(nodes, {
        [editing.lastEdit.field]: editing.lastEdit.value,
      });
      setShowEditPayload(false);
    },
    [editing, resolveEditTarget],
  );

  /** Flow 2: apply only the fields opted into by the bulk-edit form to current-page rows. */
  const handleApplyBulkEdit = useCallback(
    (target: TransactionEditTarget, changes: TransactionChanges) => {
      const nodes = resolveEditTarget(target);
      if (!nodes) return;

      editing.applyChangesToNodes(nodes, changes);
      setShowEditPayload(false);
    },
    [editing, resolveEditTarget],
  );

  const commonEditingGridOptions = useMemo(
    () => ({
      onCellValueChanged: editing.handleCellValueChanged,
      onFirstDataRendered: handleFirstDataRendered,
      onViewportChanged: handleViewportChanged,
    }),
    [editing.handleCellValueChanged, handleFirstDataRendered, handleViewportChanged],
  );

  const infiniteGridOptions = useMemo(
    () => ({
      ...transactionsGridConfig.infinite.gridOptions,
      ...commonEditingGridOptions,
      initialState: infiniteInitialState,
      onStateUpdated: handleInfiniteStateUpdated,
    }),
    [commonEditingGridOptions, handleInfiniteStateUpdated, infiniteInitialState],
  );

  const ssrmGridOptions = useMemo(
    () => ({
      ...transactionsGridConfig.ssrm.gridOptions,
      ...commonEditingGridOptions,
      initialState: ssrmInitialState,
      onStateUpdated: handleSsrmStateUpdated,
    }),
    [commonEditingGridOptions, handleSsrmStateUpdated, ssrmInitialState],
  );

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <div>
            <Typography variant="h6">Transaction activity</Typography>
            <Typography variant="body2" color="text.secondary">
              Sorting and filtering are executed by the Django API. Editing is currently client-side
              only so the flows and eventual update payload can be validated before a backend update
              endpoint is introduced.
            </Typography>
          </div>

          <TransactionEditingControls
            editedRowCount={editing.editedRowCount}
            lastEdit={editing.lastEdit}
            onApplyLastEdit={handleApplyLastEdit}
            onApplyBulkEdit={handleApplyBulkEdit}
            onPreviewPayload={() => setShowEditPayload(true)}
          />

          {editingError ? <Alert severity="warning">{editingError}</Alert> : null}

          {import.meta.env.DEV && showEditPayload ? (
            <Box
              component="pre"
              data-testid="edited-payload-preview"
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

          {transactionsGridConfig.activeGrid === 'infinite' ? (
            <TransactionsInfiniteGrid
              key={`infinite-${transactionsGridConfig.infinite.selectionScope}`}
              selectionScope={transactionsGridConfig.infinite.selectionScope}
              gridOptions={infiniteGridOptions}
            />
          ) : (
            <TransactionsSsrmGrid key="ssrm" gridOptions={ssrmGridOptions} />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
