import type { GridApi, IRowNode } from 'ag-grid-community';

/**
 * Returns exactly the concrete RowNodes on AG Grid's CURRENT pagination page.
 *
 * WHY THIS IS SHARED
 * ------------------
 * Infinite, SSRM and feature-level editing all need the same page boundary. If each caller calculates
 * page indexes separately, one implementation can easily confuse a user-visible page with a server
 * cache block. Those are different things.
 *
 * IMPORTANT AG GRID DETAIL
 * ------------------------
 * `paginationGetCurrentPage()` is zero-based. If the UI says "page 1", AG Grid returns `0`.
 * `paginationGetPageSize()` is the visible page size, not Infinite/SSRM `cacheBlockSize`.
 *
 * Server-backed row models can temporarily expose a page before every row on that page has finished
 * loading. In that case `getDisplayedRowAtIndex()` may return an empty/stub node. We return
 * `undefined` instead of a partial list so callers never silently edit/select only the rows that
 * happened to arrive first.
 */
export function getCurrentPageNodes<TData>(api: GridApi<TData>): IRowNode<TData>[] | undefined {
  // These values come directly from AG Grid's pagination model. We intentionally do not keep a
  // parallel React copy of page number/page size because AG Grid is already the source of truth.
  const pageSize = api.paginationGetPageSize();
  const currentPage = api.paginationGetCurrentPage();
  const rowCount = api.paginationGetRowCount();

  // Example: pageSize=25 and currentPage=1 means displayed row indexes 25..49.
  const startIndex = currentPage * pageSize;
  const endIndex = Math.min(startIndex + pageSize, rowCount);
  const nodes: IRowNode<TData>[] = [];

  for (let rowIndex = startIndex; rowIndex < endIndex; rowIndex += 1) {
    // `getDisplayedRowAtIndex` is the correct API here because pagination is based on AG Grid's
    // displayed row model after its current sort/filter/server response has been accepted.
    const node = api.getDisplayedRowAtIndex(rowIndex);

    // Never return a half-loaded page. A Current Page action must be all-or-nothing for the visible
    // page boundary; otherwise a user can click once and unknowingly affect only some loaded rows.
    if (!node?.data) return undefined;

    nodes.push(node);
  }

  return nodes;
}
