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

export interface GridBlockResult<TData> {
  rows: TData[];
  totalCount: number;
}

export interface GridLoadContext {
  signal: AbortSignal;
}

export type GridRowsLoader<TData> = (
  request: FlatGridBlockRequest,
  context: GridLoadContext,
) => Promise<GridBlockResult<TData>>;

export type GridLoadErrorHandler = (error: unknown) => void;
