import type { GridApi, IRowNode } from 'ag-grid-community';

/**
 * Returns exactly the RowNodes on AG Grid's current pagination page.
 *
 * WHY THIS IS SHARED
 * ------------------
 * Infinite, SSRM and feature-level editing all need the same pagination boundary. Keeping separate
 * copies risks one caller accidentally treating a cache block as a user-visible page.
 *
 * IMPORTANT
 * ---------
 * A page is a UI/business scope. It is not the same thing as an Infinite/SSRM cache block.
 *
 * Server-backed row models can temporarily expose unresolved stubs while a page is loading. In that
 * case this helper returns `undefined` instead of a partial list so callers never silently operate on
 * only the rows that happened to arrive first.
 */
export function getCurrentPageNodes<TData>(
  api: GridApi<TData>,
): IRowNode<TData>[] | undefined {
  const pageSize = api.paginationGetPageSize();
  const currentPage = api.paginationGetCurrentPage();
  const rowCount = api.paginationGetRowCount();
  const startIndex = currentPage * pageSize;
  const endIndex = Math.min(startIndex + pageSize, rowCount);
  const nodes: IRowNode<TData>[] = [];

  for (let rowIndex = startIndex; rowIndex < endIndex; rowIndex += 1) {
    const node = api.getDisplayedRowAtIndex(rowIndex);

    if (!node?.data) return undefined;
    nodes.push(node);
  }

  return nodes;
}
