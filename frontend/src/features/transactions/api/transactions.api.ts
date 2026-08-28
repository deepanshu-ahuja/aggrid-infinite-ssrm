import { getJson, patchJson, postBlob, postJson } from '@/shared/api/apiClient';
import type {
  Transaction,
  TransactionBulkUpdateRequest,
  TransactionBulkUpdateResponse,
  TransactionListRequest,
  TransactionListResponse,
  TransactionSelectionActionRequest,
  TransactionSelectionActionResponse,
  TransactionSelectionTargetRequest,
  TransactionUpdateChanges,
  TransactionUpdateResponse,
} from './transactions.contracts';

/**
 * Fetch the complete bounded Transaction working set for Client-Side Row Model.
 *
 * Client-Side owns sorting/filtering/pagination in browser memory, so this collection read is kept
 * separate from the server-grid query endpoint below rather than inventing a giant page size.
 */
export function listAllTransactions(signal?: AbortSignal) {
  return getJson<Transaction[]>('/transactions/', signal);
}

/** Server-backed Infinite/SSRM query for one translated page/block. */
export function listTransactions(request: TransactionListRequest, signal?: AbortSignal) {
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

/** Apply one patch to the complete logical selection, including unloaded server-backed rows. */
export function updateTransactionsBySelection(
  request: TransactionSelectionActionRequest,
  signal?: AbortSignal,
) {
  return patchJson<TransactionSelectionActionResponse, TransactionSelectionActionRequest>(
    '/transactions/selection/',
    request,
    signal,
  );
}

/**
 * Ask the backend to resolve/export the logical selection.
 *
 * The browser cannot safely export dataset-wide Infinite/SSRM selections itself because many selected
 * rows may have no loaded RowNode. This endpoint receives the same selection + filter target used by
 * server-side business actions and returns the authoritative eligible rows as CSV.
 */
export function exportTransactionsBySelection(
  request: TransactionSelectionTargetRequest,
  signal?: AbortSignal,
) {
  return postBlob<TransactionSelectionTargetRequest>(
    '/transactions/selection/export/',
    request,
    signal,
  );
}
