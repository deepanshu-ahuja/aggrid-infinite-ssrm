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
 * Transactions owns the meaning/source of its backend-provided interaction mode.
 * Shared grid code only understands the generic enabled / selection-disabled / read-only effects.
 */
export function isTransactionRowSelectable(
  node: Parameters<IsRowSelectable<Transaction>>[0],
): boolean {
  return node.data ? isGridRowSelectable(node.data.interactionMode) : false;
}

/** Editable columns use the same backend-provided row policy without duplicating field conditions. */
export function isTransactionCellEditable(
  params: EditableCallbackParams<Transaction>,
): boolean {
  return params.data ? isGridRowEditable(params.data.interactionMode) : false;
}

/** Row-level modifying controls are unavailable only for the stronger read-only mode. */
export function isTransactionRowReadOnly(row: Transaction): boolean {
  return isGridRowReadOnly(row.interactionMode);
}

/**
 * Interaction presentation is separate from enforcement. `selectionDisabled` remains editable, so it
 * gets a lighter visual treatment than `readOnly`; native AG Grid callbacks and backend validation
 * still own the actual selection/edit restrictions.
 */
export function getTransactionRowClass(
  params: RowClassParams<Transaction>,
): string | undefined {
  if (!params.data) return undefined;
  if (params.data.interactionMode === 'readOnly') return 'grid-row--read-only';
  if (params.data.interactionMode === 'selectionDisabled') {
    return 'grid-row--selection-disabled';
  }
  return undefined;
}
