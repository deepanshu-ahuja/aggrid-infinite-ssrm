import type { AgGridReactProps } from 'ag-grid-react';

/**
 * Native AG Grid options commonly used by Client-Side application tables.
 *
 * Client-Side Row Model has the complete working set in browser memory, so server cache/block options
 * deliberately do not belong here. Keep the property names native so a developer can look up the
 * behavior directly in AG Grid documentation.
 */
export type ClientSideGridOptions<TData> = Pick<
  AgGridReactProps<TData>,
  'pagination' | 'paginationPageSize' | 'paginationPageSizeSelector'
>;

/**
 * Conservative pagination defaults for Client-Side tables.
 *
 * These intentionally resemble the visible pagination defaults of the server-backed grids while
 * remaining a separate configuration object: sharing a page size does not make block-cache settings
 * meaningful for Client-Side Row Model.
 */
export const clientSideGridDefaults = {
  pagination: true,
  paginationPageSize: 25,
  paginationPageSizeSelector: [10, 25, 50],
} satisfies ClientSideGridOptions<unknown>;
