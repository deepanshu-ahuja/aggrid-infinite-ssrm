// GRIDCAP-EXPORT-SELECTED | GRIDCAP-ROWMODEL-CLIENT
import type { GridApi } from 'ag-grid-community';

/**
 * Export every currently selected Client-Side row with AG Grid's native CSV exporter.
 *
 * Client-Side Row Model already has the complete working set in browser memory, so calling the backend
 * to resolve selected rows would add a network round trip without solving an unloaded-row problem.
 * `onlySelectedAllPages` is important when pagination is enabled: selected rows on other Client pages
 * remain part of the exact native selection and must not disappear from the file.
 *
 * The helper is named after the native operation rather than the first row model that uses it. In this
 * foundation, however, Client-Side is the valid caller for the product's complete Selected export because
 * Infinite/SSRM logical selections can contain unloaded rows and therefore use backend resolution.
 */
export function exportSelectedRowsCsv<TData>(
  api: GridApi<TData>,
  fileName: string,
): { ok: true } | { ok: false; error: string } {
  if (api.getSelectedRows().length === 0) {
    return { ok: false, error: 'Select at least one row before exporting selected rows.' };
  }

  api.exportDataAsCsv({
    fileName,
    onlySelected: true,
    onlySelectedAllPages: true,
  });

  return { ok: true };
}
