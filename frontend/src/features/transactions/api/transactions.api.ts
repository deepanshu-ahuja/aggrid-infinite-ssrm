import { patchJson, postJson } from '@/shared/api/apiClient';
import type {
  TransactionBulkUpdateRequest,
  TransactionBulkUpdateResponse,
  TransactionListRequest,
  TransactionListResponse,
  TransactionUpdateChanges,
  TransactionUpdateResponse,
} from './transactions.contracts';

export function listTransactions(
  request: TransactionListRequest,
  signal?: AbortSignal,
) {
  return postJson<TransactionListResponse, TransactionListRequest>(
    '/transactions/query/',
    request,
    signal,
  );
}

/** Save one Transaction patch; row-model-specific cache handling belongs to the grid root after success. */
export function updateTransaction(
  transactionId: string,
  changes: TransactionUpdateChanges,
  signal?: AbortSignal,
) {
  return patchJson<TransactionUpdateResponse, TransactionUpdateChanges>(
    `/transactions/${encodeURIComponent(transactionId)}/`,
    changes,
    signal,
  );
}

/** Save many explicit Transaction row patches in one backend operation. */
export function bulkUpdateTransactions(
  request: TransactionBulkUpdateRequest,
  signal?: AbortSignal,
) {
  return patchJson<TransactionBulkUpdateResponse, TransactionBulkUpdateRequest>(
    '/transactions/bulk/',
    request,
    signal,
  );
}
