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
  transactionDate: string;
  interactionMode: GridRowInteractionMode;
  interactionReason?: string | null;
}

/**
 * Backend-writable Transaction fields. Identity/reference/date/interaction policy remain read-only
 * even though they are present on the row returned by the API.
 *
 * The backend validates the same editable surface. The grid's editing configuration remains free to
 * choose how these fields are presented/edited without leaking AG Grid concepts into this contract.
 */
export type TransactionUpdateChanges = Partial<
  Pick<Transaction, 'account' | 'amount' | 'currency' | 'status'>
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

/**
 * Fields that the Transactions backend explicitly allows for server-side sorting/filtering.
 *
 * Do NOT replace this with plain `string`.
 *
 * The AG Grid column id is translated through `transactionRequest.mapper.ts` into one of these
 * values before a request reaches the backend. Keeping a closed union prevents arbitrary frontend
 * column/property names from becoming backend query fields.
 *
 * When adding a new sortable/filterable Transactions column, review all of these together:
 *
 * 1. the AG Grid column definition;
 * 2. `FIELD_MAP` in `transactionRequest.mapper.ts`;
 * 3. this `TransactionField` union;
 * 4. backend support for sorting/filtering that field;
 * 5. mapper/API tests.
 */
export type TransactionField =
  'reference' | 'account' | 'amount' | 'currency' | 'status' | 'transactionDate';

/** Transactions-facing alias for the shared backend filter operators. */
export type TransactionFilterOperator = GridFilterOperator;

/** One server-side sort instruction restricted to valid Transaction fields. */
export type TransactionSort = GridQuerySort<TransactionField>;

/** One server-side filter instruction restricted to valid Transaction fields. */
export type TransactionFilter = GridQueryFilter<TransactionField>;

/**
 * Operation-neutral target for any backend action against a logical server-backed selection.
 *
 * Export and status mutation intentionally share this exact `selection + filters` contract so the
 * backend cannot resolve different row sets merely because the requested operation is different.
 */
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

/**
 * Backend response for a Transactions grid query.
 *
 * - `totalCount`: complete Transactions dataset before applying the request filters;
 * - `filteredCount`: number of Transactions matching the current request filters.
 *
 * Infinite/SSRM use `filteredCount` to size the current AG Grid row model. Dataset-wide selected-count
 * presentation currently uses these normal totals as well. A future backend may add eligibility-aware
 * totals when the product requires the displayed Select-All count to exclude every disabled/unselectable
 * server row, including rows that were never loaded in the browser.
 */
export type TransactionListResponse = GridListResponse<Transaction>;
