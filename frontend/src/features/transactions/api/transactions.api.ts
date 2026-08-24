import { postJson } from '@/shared/api/apiClient';
import type { TransactionListRequest, TransactionListResponse } from './transactions.contracts';

export function listTransactions(request: TransactionListRequest, signal?: AbortSignal) {
  return postJson<TransactionListResponse, TransactionListRequest>(
    '/transactions/query/',
    request,
    signal,
  );
}
