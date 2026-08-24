import type {
  GridFilterOperator,
  GridListRequest,
  GridListResponse,
  GridQueryFilter,
  GridQuerySort,
} from '@/shared/grid/query/gridQuery.contracts';

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
 * Keep this interface focused on the domain record itself. Paging, sorting, filtering, AG Grid
 * callbacks, cache settings, and selection state do not belong on the row model.
 */
export interface Transaction {
  id: string;
  reference: string;
  account: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  transactionDate: string;
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
  | 'reference'
  | 'account'
  | 'amount'
  | 'currency'
  | 'status'
  | 'transactionDate';

/**
 * Transaction-facing alias for the shared backend filter operators.
 *
 * The operator vocabulary is currently standard across server-backed tables, so its source of truth
 * lives in `gridQuery.contracts.ts`.
 *
 * This alias is intentionally retained because Transactions mapper code speaks in domain terms and
 * already imports `TransactionFilterOperator`. It can be removed later if a second feature proves
 * that importing the shared name directly is clearer.
 */
export type TransactionFilterOperator = GridFilterOperator;

/**
 * One server-side sort instruction restricted to valid Transaction fields.
 *
 * Payload shape remains:
 *
 * `{ field: TransactionField, direction: 'asc' | 'desc' }`
 */
export type TransactionSort = GridQuerySort<TransactionField>;

/**
 * One server-side filter instruction restricted to valid Transaction fields.
 *
 * The shared contract currently supports a single primitive condition per field. AG Grid can model
 * richer conditions (for example AND/OR or Set Filter arrays), but the Transactions column UI must
 * not expose those shapes until the mapper + shared contract + backend support them end-to-end.
 */
export type TransactionFilter = GridQueryFilter<TransactionField>;

/**
 * Backend request for a flat Transactions grid query.
 *
 * The structure is shared across server-backed tables:
 *
 * - `offset`
 * - `limit`
 * - `sort`
 * - `filters`
 *
 * Only the allowed field union is Transactions-specific.
 *
 * AG Grid does NOT create this object directly. `transactionRequest.mapper.ts` translates AG Grid's
 * `startRow`, `endRow`, `sortModel`, and `filterModel` into this backend-owned representation.
 */
export type TransactionListRequest = GridListRequest<TransactionField>;

/**
 * Backend response for a Transactions grid query.
 *
 * This reuses the company-wide `{ rows, totalCount }` response shape while preserving the concrete
 * `Transaction[]` row type.
 *
 * `totalCount` means the total number of backend records matching the current query, not the number
 * of rows returned in the current block.
 */
export type TransactionListResponse = GridListResponse<Transaction>;
