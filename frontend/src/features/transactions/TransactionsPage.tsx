import { useCallback, useMemo } from 'react';
import { Card, CardContent, Stack, Typography } from '@mui/material';
import type { StateUpdatedEvent } from 'ag-grid-community';
import { browserGridStateStore } from '@/shared/grid/state/gridStatePersistence';
import type { Transaction } from './api/transactions.contracts';
import { TransactionsInfiniteGrid } from './grid/TransactionsInfiniteGrid';
import { TransactionsSsrmGrid } from './grid/TransactionsSsrmGrid';
import { transactionsGridConfig } from './transactionsGrid.config';

/**
 * Keep row-model preference state separate even though both grids currently show Transactions.
 * Infinite and SSRM can evolve different native capabilities, so one implementation must never
 * overwrite the other implementation's saved state.
 */
const INFINITE_STATE_KEY = 'transactions:infinite';
const SSRM_STATE_KEY = 'transactions:ssrm';

export function TransactionsPage() {
  /**
   * AG Grid reads `initialState` only when a grid is created. Memoising the one-time storage read
   * keeps the initial object stable across ordinary page renders.
   */
  const infiniteInitialState = useMemo(
    () => browserGridStateStore.load(INFINITE_STATE_KEY),
    [],
  );
  const ssrmInitialState = useMemo(
    () => browserGridStateStore.load(SSRM_STATE_KEY),
    [],
  );

  /**
   * `stateUpdated` is AG Grid's native event containing the complete current GridState. The storage
   * adapter deliberately persists only layout/filter/sort preference slices and drops pagination and
   * row selection before writing.
   */
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

  const infiniteGridOptions = useMemo(
    () => ({
      ...transactionsGridConfig.infinite.gridOptions,
      initialState: infiniteInitialState,
      onStateUpdated: handleInfiniteStateUpdated,
    }),
    [handleInfiniteStateUpdated, infiniteInitialState],
  );

  const ssrmGridOptions = useMemo(
    () => ({
      ...transactionsGridConfig.ssrm.gridOptions,
      initialState: ssrmInitialState,
      onStateUpdated: handleSsrmStateUpdated,
    }),
    [handleSsrmStateUpdated, ssrmInitialState],
  );

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <div>
            <Typography variant="h6">Transaction activity</Typography>
            <Typography variant="body2" color="text.secondary">
              Sorting and filtering are executed by the Django API.
            </Typography>
          </div>

          {/*
           * These are separate tables. The client configuration chooses one; there is no tab,
           * toggle, or combined Infinite/SSRM component in the application UI.
           *
           * Persisted preferences are supplied as native GridOptions rather than hidden inside a
           * wrapper. Each row model gets its own state key because their supported state can diverge.
           */}
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
