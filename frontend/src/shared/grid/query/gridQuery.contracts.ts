
/**
 * Shared backend contract for server-backed data grids.
 *
 * IMPORTANT ARCHITECTURE BOUNDARY
 * --------------------------------
 * This file does NOT describe AG Grid's request model.
 *
 * Feature mappers translate AG Grid row-model requests into the application/backend contract defined
 * here so the backend shape remains stable even if the frontend table implementation changes.
 */
export type GridSortDirection = 'asc' | 'desc';

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

export type GridFilterValue = string | number;

export interface GridQuerySort<TField extends string> {
  field: TField;
  direction: GridSortDirection;
}

export interface GridQueryFilter<
  TField extends string,
  TValue extends GridFilterValue = GridFilterValue,
> {
  field: TField;
  operator: GridFilterOperator;
  value: TValue;
}

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
 * Standard response payload for flat server-backed tables.
 *
 * `rows` contains only the requested page/block.
 * `totalCount` is the complete dataset size, independent of the current filters.
 * `filteredCount` is the number of records matching the current query and is the count AG Grid must
 * use to size its current row model.
 *
 * Returning both counts with the normal page response avoids a second count-only request for features
 * such as Infinite "Select All Records" while still preserving correct filtered pagination sizing.
 */
export interface GridListResponse<TData> {
  rows: TData[];
  totalCount: number;
  filteredCount: number;
}
