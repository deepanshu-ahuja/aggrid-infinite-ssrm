import { useTrackedGridEditing } from '@/shared/grid/editing/useTrackedGridEditing';
import {
  buildSelectedTrackedGridUpdatePayload,
  buildTrackedGridUpdatePayload,
  createEmptyTrackedGridEditingState,
  recordTrackedGridCellChange,
  type TrackedGridChanges,
  type TrackedGridEditingState,
  type TrackedGridLastEdit,
  type TrackedGridUpdatePayload,
} from '@/shared/grid/editing/trackedGridEditing';
import type { CurrentPageEditTarget } from '@/shared/grid/editing/useCurrentPageEditTarget';
import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';
import type { Transaction } from '../api/transactions.contracts';

/**
 * Transactions chooses WHICH fields are editable; the shared grid engine owns HOW edits are tracked.
 */
export const TRANSACTION_EDITABLE_FIELDS = [
  'account',
  'amount',
  'currency',
  'status',
] as const;

export type TransactionEditableField =
  (typeof TRANSACTION_EDITABLE_FIELDS)[number];

export type TransactionEditableValue = Transaction[TransactionEditableField];

/** Feature aliases keep the Transactions API readable while implementation lives in shared/grid. */
export type TransactionChanges = TrackedGridChanges<
  TransactionEditableField,
  TransactionEditableValue
>;

export type TransactionLastEdit = TrackedGridLastEdit<
  TransactionEditableField,
  TransactionEditableValue
>;

export type TransactionUpdatePayload = TrackedGridUpdatePayload<
  TransactionEditableField,
  TransactionEditableValue
>;

export type TransactionEditingState = TrackedGridEditingState<
  TransactionEditableField,
  TransactionEditableValue
>;

/** Current prototype target semantics are generic current-page editing semantics. */
export type TransactionEditTarget = CurrentPageEditTarget;

export function createEmptyTransactionEditingState(): TransactionEditingState {
  return createEmptyTrackedGridEditingState<
    TransactionEditableField,
    TransactionEditableValue
  >();
}

export function isTransactionEditableField(
  field: string | undefined,
): field is TransactionEditableField {
  return TRANSACTION_EDITABLE_FIELDS.includes(
    field as TransactionEditableField,
  );
}

/** Feature-facing alias around the generic edit-state transition helper. */
export function recordTransactionCellChange(
  state: TransactionEditingState,
  rowId: string,
  field: TransactionEditableField,
  oldValue: TransactionEditableValue,
  newValue: TransactionEditableValue,
): TransactionEditingState {
  return recordTrackedGridCellChange(
    state,
    rowId,
    field,
    oldValue,
    newValue,
  );
}

/** All local Transactions edits, independent of selection. */
export function buildTransactionUpdatePayload(
  state: TransactionEditingState,
): TransactionUpdatePayload {
  return buildTrackedGridUpdatePayload(state);
}

/**
 * Production-capable selected-edit intersection.
 *
 * This is intentionally not a Dev Tools algorithm. A future real Save/Bulk Update action can use the
 * same helper; Transactions merely exposes its feature-shaped alias here.
 */
export function buildSelectedTransactionUpdatePayload(
  state: TransactionEditingState,
  selection: ServerSelectionIntent<string>,
): TransactionUpdatePayload {
  return buildSelectedTrackedGridUpdatePayload(state, selection);
}

/**
 * Transactions adapter for the generic tracked-editing engine.
 *
 * The feature supplies only row identity and editable-field semantics. Cache-surviving edit state,
 * original-value tracking, programmatic/direct edit distinction and RowNode restoration are shared.
 */
export function useTransactionEditing() {
  return useTrackedGridEditing<
    Transaction,
    TransactionEditableField,
    TransactionEditableValue
  >({
    getRowId: (row) => row.id,
    editableFields: TRANSACTION_EDITABLE_FIELDS,
    isEditableField: isTransactionEditableField,
    getFieldValue: (row, field) => row[field],
  });
}
