import { useCallback, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';
import type { GetRowIdParams, GridApi, GridReadyEvent } from 'ag-grid-community';
import { AppGrid } from '@/shared/grid/AppGrid';
import { createServerSideDatasource } from '@/shared/grid/data/server-side/createServerSideDatasource';
import { GridErrorOverlay } from '@/shared/grid/overlays/GridErrorOverlay';
import { listTransactions } from '../api/transactions.api';
import type { Transaction } from '../api/transactions.contracts';
import type { TransactionsSsrmGridOptions } from '../transactionsGrid.config';
import { mapTransactionGridRequest } from './transactionRequest.mapper';
import { transactionColumns } from './transactionColumns';

/**
 * Supplies AG Grid with a stable identity for each Transaction row.
 *
 * SSRM can unload and reload server-side blocks as the user pages, filters, sorts, groups, or
 * refreshes data. A stable backend ID lets AG Grid recognise the same logical row across those
 * operations and preserve row-owned state where the row model supports it.
 *
 * Never use `rowIndex` as the identity: server-side sorting/filtering can move a record to a
 * different position.
 */
const getRowId = ({ data }: GetRowIdParams<Transaction>) => data.id;

export interface TransactionsSsrmGridProps {
  /**
   * Native SSRM pagination/cache options assembled by the Transactions feature configuration.
   *
   * Shared application defaults are already included before they reach this component.
   */
  gridOptions: TransactionsSsrmGridOptions;
}

/**
 * Transactions implementation backed by AG Grid Enterprise's Server-Side Row Model (SSRM).
 *
 * WHY SSRM REMAINS SEPARATE FROM INFINITE ROW MODEL
 * -------------------------------------------------
 * Both row models load blocks from a server, but they have materially different AG Grid APIs and
 * capabilities. SSRM supports richer server-side concepts such as grouping, aggregation, pivoting,
 * server-side selection state, failed-load retry, and hierarchical stores.
 *
 * Keeping this as a separate grid implementation makes those native differences visible instead of
 * hiding them behind conditionals in a "universal" grid component.
 *
 * CURRENT SCOPE
 * -------------
 * This POC currently uses SSRM only as a flat server-backed table:
 * - pagination;
 * - block loading/caching;
 * - sorting;
 * - filtering;
 * - native row selection.
 *
 * Grouping, aggregation and pivoting are deliberately not implemented until a real requirement
 * needs their richer server request/response contract.
 */
export function TransactionsSsrmGrid({
  gridOptions,
}: TransactionsSsrmGridProps) {
  /**
   * AG Grid's imperative API becomes available in `onGridReady`.
   *
   * We currently need it only for SSRM-native recovery (`retryServerSideLoads`). A ref is used
   * because storing the API does not need to trigger a React render.
   */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  /**
   * User-facing datasource failure shown inside AG Grid through the shared Active Overlay.
   *
   * The datasource still calls AG Grid's native `params.fail()` separately. This state is only the
   * presentation layer; it does not replace SSRM's own failed-load bookkeeping.
   */
  const [loadError, setLoadError] = useState<string>();

  /**
   * Feature-specific loader used by the shared SSRM datasource adapter.
   *
   * The datasource adapter normalises the flat SSRM request into `FlatGridBlockRequest`. This
   * callback then maps it to our backend grid-query contract and calls the Transactions endpoint.
   *
   * Do not move `mapTransactionGridRequest` into shared grid infrastructure: valid fields and
   * Transaction-specific value conversions are feature/domain concerns.
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
   * SSRM datasource instance.
   *
   * `useMemo` keeps the datasource identity stable across ordinary React renders. Replacing the
   * datasource unnecessarily can reset SSRM stores/caches and trigger extra backend requests.
   *
   * When a load fails, the shared datasource:
   * 1. invokes this `onError` callback so the application can present a readable message;
   * 2. calls AG Grid's native `params.fail()` so SSRM records that load as failed.
   *
   * `defaultBlockSize` is only a defensive fallback for requests where SSRM does not provide an
   * explicit `endRow`. Normal flat requests use AG Grid's requested range.
   */
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

  /**
   * AG Grid lifecycle callback fired after the grid and its `GridApi` are ready.
   *
   * Keeping the API reference lets the Retry action use SSRM's own recovery method instead of
   * replacing the datasource or manually rebuilding cache state.
   */
  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;
    },
    [],
  );

  /**
   * Retries loads that SSRM has previously marked as failed.
   *
   * This is deliberately different from Infinite Row Model retry:
   * - SSRM: `retryServerSideLoads()`
   * - Infinite: `refreshInfiniteCache()`
   *
   * AG Grid tracks failed SSRM loads after the datasource calls `params.fail()`. Calling
   * `retryServerSideLoads()` asks AG Grid to retry those failed loads using the existing datasource.
   * We therefore do NOT recreate the datasource or maintain our own list of failed blocks.
   *
   * The overlay is cleared while retrying. If a retried request fails again, the datasource's
   * `onError` callback restores it.
   */
  const handleRetryLoad = useCallback(() => {
    setLoadError(undefined);
    gridApi.current?.retryServerSideLoads();
  }, []);

  return (
    <Box sx={{ height: 620, width: '100%' }}>
      <AppGrid<Transaction>
        rowModelType="serverSide"
        serverSideDatasource={datasource}
        columnDefs={transactionColumns}
        /**
         * SSRM receives the feature configuration directly using AG Grid's native option names.
         *
         * This spread comes before the explicit behaviour below so row-model-critical props in this
         * component remain visible. Future Transactions-specific overrides belong in
         * `transactionsGrid.config.ts`, not as hidden constants here.
         */
        {...gridOptions}
        getRowId={getRowId}
        /**
         * Selection is intentionally left at the POC's current native SSRM configuration in this
         * error/retry step.
         *
         * We will review SSRM selection separately because AG Grid has dedicated server-side
         * selection-state APIs for rows that are not loaded in the browser. Do not copy Infinite
         * selection logic into this component.
         */
        rowSelection={{
          mode: 'multiRow',
          headerCheckbox: true,
        }}
        /**
         * Active Overlay is used only for the application-facing datasource error.
         *
         * Normal loading/no-data states remain owned by AG Grid. The underlying failed-load state
         * is also still owned by SSRM through `params.fail()`.
         */
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
      />
    </Box>
  );
}
