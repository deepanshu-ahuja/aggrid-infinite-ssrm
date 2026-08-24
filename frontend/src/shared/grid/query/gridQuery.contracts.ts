
/**
 * Shared backend contract for server-backed data grids.
 *
 * IMPORTANT ARCHITECTURE BOUNDARY
 * --------------------------------
 * This file does NOT describe AG Grid's request model.
 *
 * AG Grid produces its own row-model-specific structures such as:
 * - `startRow` / `endRow`;
 * - `sortModel`;
 * - `filterModel`.
 *
 * Feature mappers translate those AG Grid structures into the application/backend contract defined
 * here:
 *
 * AG Grid request
 *      ↓
 * feature mapper (for example `transactionRequest.mapper.ts`)
 *      ↓
 * GridListRequest<TField>
 *      ↓
 * backend API
 *
 * Keeping this contract independent from AG Grid gives the backend one stable payload shape across
 * Transactions, Payments, Customers, Audit Logs, and other future server-backed tables.
 *
 * Feature code must still define which fields are legal. Do NOT replace `TField` with plain
 * `string`; a feature-specific field union prevents arbitrary column/property names from leaking
 * into backend queries.
 */

/**
 * Sort direction understood by the shared backend grid-query contract.
 *
 * These values currently align with AG Grid's simple sort directions, but this type belongs to our
 * API contract rather than to AG Grid. The feature mapper is responsible for translating from the
 * grid library into this representation.
 */
export type GridSortDirection = 'asc' | 'desc';

/**
 * Filter operators currently supported end-to-end by our server-backed grid contract.
 *
 * The presence of an operator here means the shared API payload CAN represent it. It does not mean
 * every column should expose it.
 *
 * A column's AG Grid filter configuration may deliberately expose a smaller subset. For example, a
 * categorical field such as Currency may eventually allow only `equals` / `notEqual`.
 *
 * When adding a new operator, review the complete dependency chain:
 *
 * 1. shared server filter presets / feature column configuration;
 * 2. feature AG Grid request mapper;
 * 3. this shared backend contract;
 * 4. backend query implementation;
 * 5. mapper/API tests.
 *
 * Do not enable an AG Grid operator before the backend can execute the same semantics.
 */
export type GridFilterOperator =
  | 'contains'
  | 'equals'
  | 'notEqual'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual';

/**
 * Primitive filter values supported by the current backend grid-query contract.
 *
 * Dates are currently transported as strings (normally an ISO date such as `2026-08-24`) rather
 * than as JavaScript `Date` objects. Feature mappers are responsible for normalising library-specific
 * filter values before they reach this contract.
 *
 * Extend this type only when the backend contract gains a real new capability. For example,
 * multi-select / Set Filter support may eventually require an array-valued filter representation
 * rather than forcing arrays into this primitive shape.
 */
export type GridFilterValue = string | number;

/**
 * One backend sort instruction.
 *
 * `TField` is supplied by the feature, for example `TransactionField`. This preserves a common
 * backend payload while still preventing a Transactions request from sorting by a field that
 * Transactions does not expose.
 */
export interface GridQuerySort<TField extends string> {
  field: TField;
  direction: GridSortDirection;
}

/**
 * One backend filter instruction.
 *
 * This intentionally represents ONE condition. AG Grid can create richer models containing
 * multiple conditions joined with AND / OR, but our current backend contract cannot represent
 * those semantics yet. The server filter UI is therefore restricted to one condition per column.
 *
 * If AND / OR support is introduced later, redesign this contract explicitly rather than silently
 * flattening AG Grid's condition tree into multiple filters and changing its meaning.
 */
export interface GridQueryFilter<
  TField extends string,
  TValue extends GridFilterValue = GridFilterValue,
> {
  field: TField;
  operator: GridFilterOperator;
  value: TValue;
}

/**
 * Standard request payload for flat server-backed tables.
 *
 * `offset` and `limit` deliberately describe backend paging rather than AG Grid's `startRow` /
 * `endRow` representation:
 *
 * - `offset`: zero-based position of the first requested record;
 * - `limit`: maximum number of records requested.
 *
 * A feature mapper performs the conversion:
 *
 * `offset = startRow`
 * `limit = endRow - startRow`
 *
 * This keeps the API contract stable even if a different frontend table implementation is used in
 * the future.
 */
export interface GridListRequest<
  TField extends string,
  TValue extends GridFilterValue = GridFilterValue,
> {
  offset: number;
  limit: number;
  sort: GridQuerySort<TField>[];
  filters: GridQueryFilter<TField, TValue>[];
}

/**
 * Standard response payload returned by flat server-backed table endpoints.
 *
 * `rows` contains only the requested block/page of data.
 *
 * `totalCount` is the total number of records matching the current server query, NOT simply
 * `rows.length`. AG Grid uses the total to understand the size of a dataset that may be much larger
 * than the records currently loaded in the browser.
 */
export interface GridListResponse<TData> {
  rows: TData[];
  totalCount: number;
}
