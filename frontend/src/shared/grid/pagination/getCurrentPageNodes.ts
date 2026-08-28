import type { GridApi, IRowNode } from 'ag-grid-community';

/**
 * Returns exactly the concrete RowNodes on AG Grid's CURRENT pagination page.
 *
 * WHY THIS IS SHARED
 * ------------------
 * Client-Side, Infinite, SSRM and feature-level editing all need the same user-facing page boundary.
 * If each caller calculates page indexes separately, a server-backed implementation can easily confuse
 * a user-visible page with a server cache block. Those are different things, while Client-Side has no
 * server cache block at all.
 *
 * IMPORTANT AG GRID DETAIL
 * ------------------------
 * `paginationGetCurrentPage()` is zero-based. If the UI says "page 1", AG Grid returns `0`.
 * `paginationGetPageSize()` is the visible page size, not Infinite/SSRM `cacheBlockSize`.
 *
 * Server-backed row models can temporarily expose a page before every row on that page has finished
 * loading. Client-Side normally has concrete row data immediately after its collection load, but the
 * same all-or-nothing contract keeps every Current Page caller consistent. If an expected RowNode has
 * no data, return `undefined` instead of a partial list.
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
    // `getDisplayedRowAtIndex` is the correct API here because pagination follows AG Grid's displayed
    // row model after the current sort/filter/data-loading result has been accepted.
    const node = api.getDisplayedRowAtIndex(rowIndex);

    // Never return a half-resolved page. A Current Page action must be all-or-nothing for the visible
    // page boundary; otherwise a user can click once and unknowingly affect only some available rows.
    if (!node?.data) return undefined;

    nodes.push(node);
  }

  return nodes;
}
