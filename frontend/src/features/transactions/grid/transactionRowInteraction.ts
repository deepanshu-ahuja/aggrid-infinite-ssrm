import type {
  EditableCallbackParams,
  IsRowSelectable,
  RowClassParams,
} from 'ag-grid-community';
import {
  isGridRowEditable,
  isGridRowReadOnly,
  isGridRowSelectable,
} from '@/shared/grid/rows/gridRowInteraction';
import type { Transaction } from '../api/transactions.contracts';

/**
 * This file is the FEATURE ADAPTER between Transaction data and generic/shared grid behaviour.
 *
 * The backend already decided the Transaction-specific business rule and returned `interactionMode`.
 * We do NOT repeat checks such as `status === ...` or `account === ...` in the browser. Repeating the
 * business rule here would create two sources of truth and would make another table harder to reuse.
 */

/**
 * AG Grid calls this function for each loaded RowNode to decide whether that row may be selected.
 */
export function isTransactionRowSelectable(
  node: Parameters<IsRowSelectable<Transaction>>[0],
): boolean {
  // Server-backed row models can temporarily create RowNodes before row data has arrived. Such a node
  // must not be selectable yet because there is no backend row/policy to evaluate.
  if (!node.data) return false;

  // Delegate the generic meaning of `enabled | selectionDisabled | readOnly` to shared code.
  // The returned boolean becomes AG Grid's native `RowNode.selectable` value. Our page/filter/all
  // selection helpers then read THAT native flag rather than re-running Transaction conditions.
  return isGridRowSelectable(node.data.interactionMode);
}

/**
 * AG Grid calls this for editable columns when it needs to know whether the current row may open an
 * editor. `selectionDisabled` is still editable; only `readOnly` returns false.
 */
export function isTransactionCellEditable(
  params: EditableCallbackParams<Transaction>,
): boolean {
  // No row data = no safe edit target. This is especially relevant while server-backed rows are
  // loading/recycling.
  if (!params.data) return false;

  return isGridRowEditable(params.data.interactionMode);
}

/**
 * Row-level modifying controls (Save/Discard/etc.) use the stronger read-only predicate.
 */
export function isTransactionRowReadOnly(row: Transaction): boolean {
  // Do NOT use `!isTransactionRowSelectable(...)` here. `selectionDisabled` is intentionally not
  // selectable but must still allow individual editing/row actions.
  return isGridRowReadOnly(row.interactionMode);
}

/**
 * Return CSS classes only for PRESENTATION.
 *
 * `getRowClass` is an AG Grid styling hook: AG Grid calls it while rendering rows and adds the returned
 * class to that row element. It does not prevent selection or editing. Native `isRowSelectable`,
 * column `editable`, shared programmatic-edit guards, and backend validation remain the enforcement.
 */
export function getTransactionRowClass(
  params: RowClassParams<Transaction>,
): string | undefined {
  // A loading/stub RowNode has no Transaction state to style yet.
  if (!params.data) return undefined;

  // Stronger grey/locked treatment: no selection, no editing, no modifying row actions.
  if (params.data.interactionMode === 'readOnly') return 'grid-row--read-only';

  // Lighter warning/review treatment: selection/bulk is disabled, but individual editing remains
  // available. Keeping a separate class is what lets the two restricted states look different.
  if (params.data.interactionMode === 'selectionDisabled') {
    return 'grid-row--selection-disabled';
  }

  // Enabled rows need no extra class; the normal AG Grid theme (including blue selection styling)
  // remains untouched.
  return undefined;
}
