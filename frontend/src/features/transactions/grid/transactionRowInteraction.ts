// GRIDCAP-ROW-ELIGIBILITY | GRIDCAP-COLUMNS
import type { EditableCallbackParams, GridApi, IsRowSelectable } from 'ag-grid-community';
import { createGridRowInteractionClassRules } from '@/shared/grid/rows/gridRowInteractionClass';
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

/** AG Grid callback for each loaded RowNode's native selection eligibility. */
export function isTransactionRowSelectable(
  node: Parameters<IsRowSelectable<Transaction>>[0],
): boolean {
  if (!node.data) return false;
  return isGridRowSelectable(node.data.interactionMode);
}

/**
 * Re-evaluate native RowNode selectability after authoritative Transaction data changes.
 *
 * AG Grid evaluates `rowSelection.isRowSelectable` when a RowNode is created, but a stable RowNode can
 * survive while its backend-owned `interactionMode` changes. In that case the callback's latest answer
 * and `RowNode.selectable` can diverge. Use the native `setRowSelectable` API to bring the surviving
 * RowNode back in sync; this also lets AG Grid update its checkbox/selection services normally.
 *
 * Keep this at the Transaction feature boundary for now because the predicate itself is feature-owned.
 * If another feature needs the same lifecycle, extract the iteration mechanic without moving its
 * business eligibility rule into shared grid code.
 */
export function refreshTransactionRowSelectability(api: GridApi<Transaction>): void {
  api.forEachNode((node) => {
    if (!node.data) return;

    const nextSelectable = isTransactionRowSelectable(node);
    if (node.selectable !== nextSelectable) {
      node.setRowSelectable(nextSelectable);
    }
  });
}

/** Editable columns allow `enabled` and `selectionDisabled`; only `readOnly` blocks editing. */
export function isTransactionCellEditable(
  params: EditableCallbackParams<Transaction>,
): boolean {
  if (!params.data) return false;
  return isGridRowEditable(params.data.interactionMode);
}

/** Row-level modifying controls use the stronger read-only predicate. */
export function isTransactionRowReadOnly(row: Transaction): boolean {
  return isGridRowReadOnly(row.interactionMode);
}

/**
 * Mutable interaction presentation uses `rowClassRules`, not `getRowClass`.
 *
 * This is important because backend-authoritative writes can change `interactionMode` while AG Grid
 * keeps the same RowNode alive. Rule-owned classes are removed when their predicate becomes false;
 * additive `getRowClass` classes are not and previously left rows looking selection-disabled after
 * they had become enabled.
 */
export const transactionRowClassRules = createGridRowInteractionClassRules<Transaction>();

/**
 * Concrete roots still expose a normal feature row-class callback boundary for unrelated additive
 * Transaction classes. There are no such classes today, so this deliberately returns no class.
 * Interaction-mode styling belongs exclusively to `transactionRowClassRules` above.
 */
export const getTransactionRowClass = () => undefined;
