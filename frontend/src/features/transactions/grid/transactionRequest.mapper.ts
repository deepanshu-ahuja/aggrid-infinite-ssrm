import type { FlatGridBlockRequest } from '@/shared/grid/data/gridData.types';
import type {
  TransactionField,
  TransactionFilter,
  TransactionFilterOperator,
  TransactionListRequest,
} from '../api/transactions.contracts';

/**
 * Maps AG Grid column ids to backend-supported Transaction fields.
 *
 * WHY THIS MAP EXISTS
 * -------------------
 * AG Grid works with column ids (`colId`) and filter-model keys. The backend must not receive those
 * values blindly as arbitrary query fields.
 *
 * This explicit allow-list is the boundary between:
 *
 * AG Grid column id
 *      ↓
 * FIELD_MAP
 *      ↓
 * TransactionField
 *      ↓
 * shared GridListRequest<TransactionField>
 *      ↓
 * backend
 *
 * If a Transactions column becomes sortable/filterable, adding the column definition alone is NOT
 * enough. Review all of these together:
 *
 * 1. `transactionColumns.tsx`;
 * 2. this `FIELD_MAP`;
 * 3. `TransactionField` in `transactions.contracts.ts`;
 * 4. backend support for that field;
 * 5. mapper tests.
 *
 * Keeping this explicit prevents accidental exposure of frontend-only or unsupported properties as
 * backend query fields.
 */
const FIELD_MAP: Record<string, TransactionField> = {
  reference: 'reference',
  account: 'account',
  amount: 'amount',
  currency: 'currency',
  status: 'status',
  transactionDate: 'transactionDate',
};

/**
 * AG Grid filter operators that this mapper currently knows how to translate into the shared
 * backend grid-query contract.
 *
 * This set MUST stay aligned with:
 *
 * - shared presets in `shared/grid/config/serverFilterParams.ts`;
 * - any per-column filter overrides in `transactionColumns.tsx`;
 * - `GridFilterOperator` in `shared/grid/query/gridQuery.contracts.ts`;
 * - backend query implementation.
 *
 * AG Grid supports more operators than these. Do not add one here merely because AG Grid can emit
 * it; it is only safe to expose when the complete frontend → API → backend path supports the same
 * semantics.
 */
const FILTER_OPERATORS = new Set<TransactionFilterOperator>([
  'contains',
  'equals',
  'notEqual',
  'startsWith',
  'endsWith',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
]);

/**
 * Small structural view of the AG Grid Simple Filter model fields used by this mapper.
 *
 * We intentionally do not make the backend contract depend directly on AG Grid's filter model
 * types. The Transactions mapper is the translation boundary between AG Grid and our company API
 * shape.
 *
 * `conditions` is included only so we can detect and reject AG Grid's multi-condition AND/OR model.
 * The shared backend contract currently represents one condition per field.
 */
interface SimpleAgFilterModel {
  type?: unknown;
  filter?: unknown;
  dateFrom?: unknown;
  conditions?: unknown;
}

/**
 * Converts one AG Grid filter-model entry into one backend Transaction filter.
 *
 * @param fieldId AG Grid column id / filter-model key.
 * @param rawModel Raw AG Grid filter model for that column.
 * @returns A backend-safe filter restricted to `TransactionField` and the shared operator contract.
 *
 * @throws When the field, operator, filter shape, or value cannot be represented by the current API
 * contract.
 *
 * WHY THIS FUNCTION IS STRICT
 * ---------------------------
 * Silently ignoring unsupported AG Grid filter shapes would be dangerous: the UI could tell the
 * user that a filter is active while the backend executes a different query. Failing explicitly is
 * preferable until the end-to-end contract has been extended.
 *
 * FUTURE EXTENSIONS
 * -----------------
 * If we add AND/OR conditions, Set Filters, blank/notBlank, ranges, or another AG Grid filter type,
 * update the shared filter presets, shared API contract, backend, and tests together. Do not encode
 * a Transactions-only private payload here.
 */
function mapFilter(fieldId: string, rawModel: unknown): TransactionFilter {
  const field = FIELD_MAP[fieldId];

  if (!field) {
    throw new Error(`Unsupported transaction filter field: ${fieldId}`);
  }

  if (!rawModel || typeof rawModel !== 'object') {
    throw new Error(`Invalid filter model for ${fieldId}.`);
  }

  const model = rawModel as SimpleAgFilterModel;

  /**
   * AG Grid Simple Filters can contain multiple conditions combined with AND / OR.
   *
   * Our current `GridQueryFilter` contract represents one condition only, and the shared server
   * filter presets therefore set `maxNumConditions: 1`. This guard remains important because filter
   * models can also be restored programmatically or supplied from persisted state.
   */
  if (model.conditions) {
    throw new Error(
      'Combined AG Grid filter conditions are not supported by this API contract yet.',
    );
  }

  /**
   * Do not trust the filter's `type` just because it came from AG Grid.
   *
   * Column configuration should prevent unsupported operators from being selected in normal UI,
   * but this mapper is the final runtime contract boundary and validates the model again.
   */
  if (
    typeof model.type !== 'string' ||
    !FILTER_OPERATORS.has(model.type as TransactionFilterOperator)
  ) {
    throw new Error(`Unsupported filter operator for ${fieldId}.`);
  }

  /**
   * Text/Number filters normally place their value in `filter`.
   * Date Filter models place their primary date value in `dateFrom`.
   *
   * The current shared backend contract accepts only primitive string/number values. Richer values
   * such as arrays for Set Filters require an intentional contract extension.
   */
  const rawValue = model.filter ?? model.dateFrom;

  if (typeof rawValue !== 'string' && typeof rawValue !== 'number') {
    throw new Error(`Filter ${fieldId} requires a string or numeric value.`);
  }

  return {
    field,
    operator: model.type as TransactionFilterOperator,

    /**
     * AG Grid date filter values may include a time portion. The Transactions backend currently
     * treats `transactionDate` as a date-only query field, so normalise it to YYYY-MM-DD.
     *
     * If the backend later supports time-zone-aware date/time filtering, this conversion must be
     * revisited rather than silently keeping the date-only behaviour.
     */
    value:
      field === 'transactionDate' && typeof rawValue === 'string'
        ? rawValue.slice(0, 10)
        : rawValue,
  };
}

/**
 * Translates AG Grid's COMPLETE applied column-filter model into the Transactions backend filter
 * array.
 *
 * WHY THIS IS EXPORTED
 * --------------------
 * The exact same translation is needed in two places:
 *
 * 1. normal Infinite/SSRM row loading;
 * 2. future "Select All Filtered" bulk actions.
 *
 * Example:
 *
 * ```text
 * AG Grid active filters
 *     Status = Completed
 *     Amount > 5000
 *
 *              ↓ this function
 *
 * backend filters
 *     [
 *       { field: 'status', operator: 'equals', value: 'Completed' },
 *       { field: 'amount', operator: 'greaterThan', value: 5000 }
 *     ]
 * ```
 *
 * Reusing this function is important. We must NOT create a separate bulk-selection filter mapper,
 * because the table could then load one dataset while the bulk action operates on a differently
 * interpreted dataset.
 *
 * AG Grid remains the owner of the UI filter model. This function is only the Transactions-domain
 * translation boundary from that library model into our backend contract.
 *
 * @param filterModel The applied AG Grid column-filter model, normally from a datasource request or
 * `api.getFilterModel()`.
 * @returns Backend-safe Transaction filters.
 */
export function mapTransactionFilterModel(filterModel: object): TransactionFilter[] {
  return Object.entries(filterModel).map(([fieldId, model]) => mapFilter(fieldId, model));
}

/**
 * Translates an AG Grid flat block request into the shared backend grid-query contract specialised
 * for Transactions.
 *
 * AG Grid supplies row-model-oriented values:
 *
 * - `startRow` / `endRow`;
 * - `sortModel`;
 * - `filterModel`.
 *
 * Our backend expects:
 *
 * - `offset`;
 * - `limit`;
 * - `sort`;
 * - `filters`.
 *
 * This mapper intentionally lives in the Transactions feature because the field allow-list and any
 * domain-specific value conversion (currently `transactionDate`) belong to Transactions. The shape
 * it produces is generic and comes from `GridListRequest<TransactionField>`.
 *
 * FILTER REUSE RULE
 * -----------------
 * Do not duplicate filter translation inside this function. `mapTransactionFilterModel()` is the
 * single Transactions filter translator and is also reused by filtered bulk-selection logic.
 *
 * That guarantees:
 *
 * ```text
 * rows displayed by the grid
 *          and
 * rows targeted by "Select All Filtered"
 * ```
 *
 * are based on the same backend filter semantics.
 *
 * @param request Normalised flat request produced by our shared AG Grid datasource adapter.
 * @returns Backend request accepted by the Transactions list endpoint.
 *
 * @throws When AG Grid asks to sort/filter by a field or operator not supported by the Transactions
 * API contract.
 */
export function mapTransactionGridRequest(request: FlatGridBlockRequest): TransactionListRequest {
  return {
    /**
     * AG Grid's `startRow` is already the zero-based first requested row, which maps directly to our
     * backend `offset`.
     */
    offset: request.startRow,

    /**
     * AG Grid's `endRow` is exclusive. Therefore the requested backend page/block size is
     * `endRow - startRow`, not `endRow`.
     */
    limit: request.endRow - request.startRow,

    /**
     * Sort instructions are validated against the same field allow-list used for filters. This
     * prevents an AG Grid-only column id from becoming an arbitrary backend sort field.
     */
    sort: request.sortModel.map(({ colId, sort }) => {
      const field = FIELD_MAP[colId];

      if (!field) {
        throw new Error(`Unsupported transaction sort field: ${colId}`);
      }

      return {
        field,
        direction: sort,
      };
    }),

    /**
     * Use the SAME filter mapper that filtered bulk-selection will use. Keeping one translation
     * path prevents row loading and bulk actions from disagreeing about what an AG Grid filter means.
     */
    filters: mapTransactionFilterModel(request.filterModel),
  };
}
