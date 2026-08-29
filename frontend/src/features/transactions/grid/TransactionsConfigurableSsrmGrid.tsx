// GRIDCAP-CONFIGURABLE-TABLE | GRIDCAP-ROWMODEL-SSRM | GRIDCAP-DATA-LOAD | GRIDCAP-ROW-ID | GRIDCAP-ROW-ELIGIBILITY
import { useCallback, useRef } from 'react';
import { Alert, Box, Stack, Typography } from '@mui/material';
import type { GetRowIdParams, GridApi, GridReadyEvent } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { useCompiledConfigurableTable } from '@/shared/grid/configuration/useCompiledConfigurableTable';
import type { GridRowsLoader } from '@/shared/grid/data/gridData.types';
import { useServerSideRowLoading } from '@/shared/grid/data/server-side/useServerSideRowLoading';
import { GridErrorOverlay } from '@/shared/grid/overlays/GridErrorOverlay';
import {
  TRANSACTIONS_CONFIGURABLE_TABLE_KEY,
} from '../configurable/transactionsConfigurableTable.definition';
import { transactionsConfigurableTableProvider } from '../configurable/transactionsConfigurableTable.provider';
import {
  resolveTransactionConfigurableRowsLoader,
  transactionsConfigurableTableRegistries,
} from '../configurable/transactionsConfigurableTable.registry';
import type { Transaction } from '../api/transactions.contracts';
import { transactionsGridConfig } from '../transactionsGrid.config';
import { isTransactionRowSelectable } from './transactionRowInteraction';

/**
 * Fourth, intentionally isolated SSRM composition path. It proves only the metadata boundary first;
 * the existing /client, /infinite and /ssrm roots are not refactored to make this experiment work.
 */
export function TransactionsConfigurableSsrmGrid() {
  const gridApi = useRef<GridApi<Transaction> | null>(null);
  const gridOptions = transactionsGridConfig.ssrm.gridOptions;

  const tableQuery = useCompiledConfigurableTable<Transaction>({
    definitionKey: TRANSACTIONS_CONFIGURABLE_TABLE_KEY,
    provider: transactionsConfigurableTableProvider,
    registries: transactionsConfigurableTableRegistries,
  });

  const loadRows = useCallback<GridRowsLoader<Transaction>>(
    (request, context) => {
      const dataSourceKey = tableQuery.data?.definition.dataSourceKey;
      if (!dataSourceKey) {
        return Promise.reject(new Error('Configurable table metadata is not ready.'));
      }
      return resolveTransactionConfigurableRowsLoader(dataSourceKey)(request, context);
    },
    [tableQuery.data?.definition.dataSourceKey],
  );

  const { datasource, error: loadError, retry: retryLoad, clearError } = useServerSideRowLoading({
    gridApi,
    loadRows,
    defaultBlockSize: gridOptions.cacheBlockSize ?? 100,
  });

  const getRowId = useCallback(
    ({ data }: GetRowIdParams<Transaction>) => {
      const rowIdField = tableQuery.data?.definition.rowIdField;
      if (!rowIdField) return data.id;

      const value = data[rowIdField as keyof Transaction];
      return typeof value === 'string' || typeof value === 'number' ? String(value) : data.id;
    },
    [tableQuery.data?.definition.rowIdField],
  );

  const handleGridReady = useCallback((event: GridReadyEvent<Transaction>) => {
    gridApi.current = event.api;
  }, []);

  if (tableQuery.isPending) {
    return <Typography color="text.secondary">Loading configurable table definition…</Typography>;
  }

  if (tableQuery.isError || !tableQuery.data) {
    return (
      <Alert severity="error">
        Configurable table definition could not be compiled:{' '}
        {tableQuery.error instanceof Error ? tableQuery.error.message : 'Unknown configuration error.'}
      </Alert>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="h6" fontWeight={700}>
          Configurable SSRM experiment
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Columns come from validated JSON-safe metadata; SSRM loading and lifecycle remain native
          frontend mechanics.
        </Typography>
      </Box>

      <Box sx={{ height: 620, width: '100%' }}>
        <AgGridReact<Transaction>
          {...gridOptions}
          rowModelType="serverSide"
          serverSideDatasource={datasource}
          columnDefs={tableQuery.data.columnDefs}
          getRowId={getRowId}
          rowSelection={{
            mode: 'multiRow',
            headerCheckbox: true,
            selectAll: 'all',
            enableClickSelection: false,
            isRowSelectable: isTransactionRowSelectable,
          }}
          activeOverlay={loadError ? GridErrorOverlay : undefined}
          activeOverlayParams={loadError ? { message: loadError, onRetry: retryLoad } : undefined}
          onGridReady={handleGridReady}
          onGridPreDestroyed={() => {
            gridApi.current = null;
          }}
          onFilterChanged={clearError}
        />
      </Box>
    </Stack>
  );
}
