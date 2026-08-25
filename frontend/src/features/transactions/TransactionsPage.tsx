import { useCallback, useMemo, useState } from 'react';
import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import type { StateUpdatedEvent } from 'ag-grid-community';
import { browserGridStateStore } from '@/shared/grid/state/gridStatePersistence';
import type { Transaction } from './api/transactions.contracts';
import { TransactionEditingControls } from './grid/TransactionEditingControls';
import { useTransactionEditing } from './grid/transactionEditing';
import { TransactionsInfiniteGrid } from './grid/TransactionsInfiniteGrid';
import { TransactionsSsrmGrid } from './grid/TransactionsSsrmGrid';
import { useTransactionEditFlows } from './grid/useTransactionEditFlows';
import { transactionsGridConfig } from './transactionsGrid.config';

const INFINITE_STATE_KEY = 'transactions:infinite';
const SSRM_STATE_KEY = 'transactions:ssrm';

/**
 * Page-level composition only.
 *
 * Editing behavior is intentionally NOT implemented in this component:
 * - `useTransactionEditing` owns accumulated row/field changes;
 * - `useTransactionEditFlows` owns Flow 1 / Flow 2 current-page targeting;
 * - the concrete Infinite/SSRM grids continue to own their row-model-specific selection behavior;
 * - `TransactionEditingControls` is only today's prototype presentation and can be replaced later.
 *
 * This separation matters because the final client UI for Flow 1 and Flow 2 may be totally different
 * while still reusing the same editing operations underneath.
 */
export function TransactionsPage() {
  const [showAllLocalEdits, setShowAllLocalEdits] = useState(false);

  /** Core local edit/change engine shared by manual editing, Flow 1 and Flow 2. */
  const editing = useTransactionEditing();

  /**
   * UI-independent Flow 1 / Flow 2 orchestration. Today's controls call these functions, but a
   * future inline action/modal/drawer can call the same functions without copying grid logic.
   */
  const editFlows = useTransactionEditFlows(editing);

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
   * Native grid lifecycle props needed by the edit engine. They are composed into both row models
   * because cache/page reconciliation is common, while each grid still owns its native datasource
   * and selection implementation.
   */
  const commonEditingGridOptions = useMemo(
    () => ({
      onCellValueChanged: editing.handleCellValueChanged,
      ...editFlows.gridOptions,
    }),
    [editFlows.gridOptions, editing.handleCellValueChanged],
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

          {/*
           * PROTOTYPE PRESENTATION ONLY
           * ---------------------------
           * This component is not the editing architecture. It is one temporary UI consuming the
           * reusable edit engine/flow operations. Flow 1 and Flow 2 can later move to completely
           * different components/locations without moving their underlying behavior back here.
           */}
          <TransactionEditingControls
            editedRowCount={editing.editedRowCount}
            lastEdit={editing.lastEdit}
            onApplyLastEdit={(target) => {
              if (editFlows.applyLastEdit(target)) setShowAllLocalEdits(false);
            }}
            onApplyBulkEdit={(target, changes) => {
              if (editFlows.applyBulkChanges(target, changes)) setShowAllLocalEdits(false);
            }}
            onPreviewPayload={() => setShowAllLocalEdits(true)}
          />

          {editFlows.error ? (
            <Typography variant="body2" color="warning.main">
              {editFlows.error}
            </Typography>
          ) : null}

          {/*
           * DEVELOPMENT PREVIEW: ALL LOCAL UI EDITS
           * ---------------------------------------
           * This intentionally includes edited-but-unselected rows. It answers "what has the user
           * changed in the UI?", NOT "what would the selected backend Bulk Update send?".
           *
           * The Infinite grid has a separate `Preview selected edit payload` because that operation
           * requires its logical include/exclude selection as well as this accumulated edit state.
           */}
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

          {transactionsGridConfig.activeGrid === 'infinite' ? (
            <TransactionsInfiniteGrid
              key={`infinite-${transactionsGridConfig.infinite.selectionScope}`}
              selectionScope={transactionsGridConfig.infinite.selectionScope}
              gridOptions={infiniteGridOptions}
              editingState={editing.state}
            />
          ) : (
            <TransactionsSsrmGrid key="ssrm" gridOptions={ssrmGridOptions} />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
