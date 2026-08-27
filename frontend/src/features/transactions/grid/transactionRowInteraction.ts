import type {
  EditableCallbackParams,
  GetRowClassParams,
  IsRowSelectable,
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
 * Read-only presentation is deliberately separate from selection eligibility. A selection-disabled
 * row keeps its normal appearance/interactions apart from its disabled checkbox; only the stronger
 * read-only state receives the generic muted row class.
 */
export function getTransactionRowClass(
  params: GetRowClassParams<Transaction>,
): string | undefined {
  return params.data && isTransactionRowReadOnly(params.data) ? 'grid-row--read-only' : undefined;
}
