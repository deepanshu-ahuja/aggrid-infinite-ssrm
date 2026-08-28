// GRIDCAP-EXPORT-PAGE | GRIDCAP-PAGINATION
import type { GridApi, IRowNode } from 'ag-grid-community';
import { getCurrentPageNodes } from '@/shared/grid/pagination/getCurrentPageNodes';

/**
 * Export exactly AG Grid's current pagination page with the grid's native CSV exporter.
 *
 * The helper does not build CSV itself. AG Grid already owns column order, value formatting and CSV
 * escaping, so custom serialization here would duplicate native behavior and drift from the visible
 * grid. We only supply the product-specific page boundary that server-backed row models do not expose
 * as a one-click export option.
 */
export function exportCurrentPageCsv<TData>(
  api: GridApi<TData>,
  fileName: string,
): { ok: true } | { ok: false; error: string } {
  const pageNodes = getCurrentPageNodes(api);

  if (!pageNodes) {
    return {
      ok: false,
      error: 'The current page is still loading. Export it again after all page rows are visible.',
    };
  }

  // Keep node identity, not row indexes, as the membership test. Server-backed model/cache activity can
  // replace/reindex RowNodes; these are the exact concrete nodes returned for the current page snapshot.
  const pageNodeSet = new Set<IRowNode<TData>>(pageNodes);

  api.exportDataAsCsv({
    fileName,
    // Native CSV export may walk other currently loaded/cached RowNodes. Skip everything outside the
    // page snapshot instead of hand-serialising `node.data`, preserving AG Grid export semantics.
    shouldRowBeSkipped: ({ node }) => !pageNodeSet.has(node),
  });

  return { ok: true };
}
