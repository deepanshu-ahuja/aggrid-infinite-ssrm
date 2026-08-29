import type {
  GridFilterOperator,
  GridListRequest,
  GridListResponse,
  GridQueryFilter,
  GridQuerySort,
} from '@/shared/grid/query/gridQuery.contracts';
import type { GridRowInteractionMode } from '@/shared/grid/rows/gridRowInteraction';
import type { GridSelectionActionTarget } from '@/shared/grid/selection/gridSelectionActionTarget';

/**
 * Transaction statuses returned by the Transactions backend.
 *
 * This is domain data, so it belongs in the Transactions feature rather than in shared grid code.
 * If the backend adds or renames a status, update this union together with any status-specific UI
 * such as `TransactionStatusCell`.
 */
export type TransactionStatus = 'Completed' | 'Pending' | 'Failed';

/**
 * One Transaction row as returned by the Transactions API.
 *
 * `interactionMode` is backend-provided row policy, not AG Grid state. `interactionReason` is optional
 * explanatory text for restricted rows. Shared grid code understands only the generic mode effects;
 * the Transactions feature/backend owns why a specific row has that policy and what reason is shown.
 */
export interface Transaction {
  id: string;
  reference: string;
  account: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  /** ISO calendar date (`YYYY-MM-DD`) returned by DRF. */
  transactionDate: string;
  interactionMode: GridRowInteractionMode;
  interactionReason?: string | null;
}

/**
 * Backend-writable Transaction fields. Identity/reference/interaction policy remain read-only.
 *
 * The backend validates the same editable surface. The grid's editing configuration remains free to
 * choose how these fields are presented/edited without leaking AG Grid concepts into this contract.
 */
export type TransactionUpdateChanges = Partial<
  Pick<Transaction, 'account' | 'amount' | 'currency' | 'status' | 'transactionDate'>
>;

/** One explicit row patch used by the bulk update endpoint. */
export interface TransactionBulkUpdateItem {
  id: Transaction['id'];
  changes: TransactionUpdateChanges;
}

export interface TransactionBulkUpdateRequest {
  updates: TransactionBulkUpdateItem[];
}

/** Single-row save returns the backend-authoritative row after validation/persistence. */
export interface TransactionUpdateResponse {
  row: Transaction;
}

/** Bulk save returns every authoritative updated row in request order. */
export interface TransactionBulkUpdateResponse {
  rows: Transaction[];
  updatedCount: number;
}

/** Fields that the Transactions backend explicitly allows for server-side sorting/filtering. */
export type TransactionField =
  'reference' | 'account' | 'amount' | 'currency' | 'status' | 'transactionDate';

/** Transaction-facing alias for the shared backend filter operators. */
export type TransactionFilterOperator = GridFilterOperator;

/** One server-side sort instruction restricted to valid Transaction fields. */
export type TransactionSort = GridQuerySort<TransactionField>;

/** One server-side filter instruction restricted to valid Transaction fields. */
export type TransactionFilter = GridQueryFilter<TransactionField>;

/** Operation-neutral target for backend actions against a logical server-backed selection. */
export type TransactionSelectionTargetRequest = GridSelectionActionTarget<
  Transaction['id'],
  TransactionFilter
>;

/** Transactions adds only its domain mutation payload to the operation-neutral selection target. */
export type TransactionSelectionActionRequest = TransactionSelectionTargetRequest & {
  changes: TransactionUpdateChanges;
};

export interface TransactionSelectionActionResponse {
  updatedCount: number;
}

/** Backend request for a flat Transactions grid query. */
export type TransactionListRequest = GridListRequest<TransactionField>;

/** Backend response for a Transactions grid query. */
export type TransactionListResponse = GridListResponse<Transaction>;
