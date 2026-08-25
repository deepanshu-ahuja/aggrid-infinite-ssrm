export interface GridSort {
  colId: string;
  sort: 'asc' | 'desc';
}

export interface FlatGridBlockRequest {
  startRow: number;
  endRow: number;
  sortModel: readonly GridSort[];
  // The feature mapper owns interpretation of filter shapes. Keeping this as `object` lets the
  // two AG Grid row models share flat loading without leaking either model into the API contract.
  filterModel: object;
}

/**
 * Generic result returned by a flat server-backed grid loader.
 *
 * `totalCount` describes the complete dataset independent of the current filters.
 * `filteredCount` describes the current query result and is therefore the value datasource adapters
 * must report to AG Grid as the row-model size.
 */
export interface GridBlockResult<TData> {
  rows: TData[];
  totalCount: number;
  filteredCount: number;
}

export interface GridLoadContext {
  signal: AbortSignal;
}

export type GridRowsLoader<TData> = (
  request: FlatGridBlockRequest,
  context: GridLoadContext,
) => Promise<GridBlockResult<TData>>;

export type GridLoadErrorHandler = (error: unknown) => void;
