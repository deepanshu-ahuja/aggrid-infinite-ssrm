// GRIDCAP-ROW-ELIGIBILITY | GRIDCAP-COLUMNS
import type { EditableCallbackParams, IsRowSelectable } from 'ag-grid-community';
import { createGridRowInteractionClassGetter } from '@/shared/grid/rows/gridRowInteractionClass';
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
  // Do NOT derive this from "not selectable". `selectionDisabled` is intentionally non-selectable but
  // must still allow individual editing and row-level modifying actions.
  return isGridRowReadOnly(row.interactionMode);
}

/**
 * Shared AG Grid row-class adapter.
 *
 * Transactions follows the recommended common API contract and exposes `interactionMode` directly,
 * so there is NO Transaction-specific `if (readOnly) ... if (selectionDisabled) ...` class mapping.
 * The shared helper owns that reusable AG Grid mechanic and supplies the default classes.
 *
 * If Transactions later needs an unrelated feature-only row class, add it without copying the common
 * interaction logic:
 *
 * createGridRowInteractionClassGetter<Transaction>({
 *   getAdditionalClass: (row) => row.someFeatureCondition ? 'transaction-row--special' : undefined,
 * });
 *
 * If another table uses different class names, it can override `classNames`. If its backend stores the
 * mode under another property, it can pass `getMode`. In all cases AG Grid's `getRowClass` callback
 * shape remains hidden inside the shared helper.
 */
export const getTransactionRowClass = createGridRowInteractionClassGetter<Transaction>();
