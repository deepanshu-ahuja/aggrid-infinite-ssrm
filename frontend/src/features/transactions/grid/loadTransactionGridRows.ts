import type { GridRowsLoader } from '@/shared/grid/data/gridData.types';
import { listTransactions } from '../api/transactions.api';
import type { Transaction } from '../api/transactions.contracts';
import { mapTransactionGridRequest } from './transactionRequest.mapper';

/**
 * Feature-owned flat row loader shared by Infinite and SSRM datasource adapters.
 *
 * Both AG Grid row models already reduce their request into the same shared `FlatGridBlockRequest`.
 * This function is therefore the single Transactions boundary that maps that request into the backend
 * contract and performs the API call. Row-model-specific datasource/retry mechanics remain in
 * `shared/grid/data/infinite` and `shared/grid/data/server-side`.
 */
export const loadTransactionGridRows: GridRowsLoader<Transaction> = (
  request,
  context,
) =>
  listTransactions(
    mapTransactionGridRequest(request),
    context.signal,
  );
