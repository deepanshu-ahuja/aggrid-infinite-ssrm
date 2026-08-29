import type {
  TrackedGridChanges,
  TrackedGridEditingState,
  TrackedGridLastEdit,
  TrackedGridUpdatePayload,
} from '@/shared/grid/editing/trackedGridEditing';
import type { UseTrackedGridEditingOptions } from '@/shared/grid/editing/useTrackedGridEditing';
import type { CurrentPageRowTarget } from '@/shared/grid/pagination/useCurrentPageRowTarget';
import type { Transaction } from '../api/transactions.contracts';
import { isTransactionRowReadOnly } from './transactionRowInteraction';
import { validateTransactionField } from './transactionValidation';

/** Transactions chooses WHICH fields are editable; shared/grid owns HOW edits are tracked. */
export const TRANSACTION_EDITABLE_FIELDS = ['account', 'amount', 'currency', 'status'] as const;

export type TransactionEditableField = (typeof TRANSACTION_EDITABLE_FIELDS)[number];
export type TransactionEditableValue = Transaction[TransactionEditableField];
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

/** Feature UI currently offers the two generic current-page row targets. */
export type TransactionEditTarget = CurrentPageRowTarget;

export function isTransactionEditableField(
  field: string | undefined,
): field is TransactionEditableField {
  return TRANSACTION_EDITABLE_FIELDS.includes(field as TransactionEditableField);
}

/**
 * Feature-owned configuration passed directly to the shared tracked-editing engine.
 * No transaction wrapper hook is needed because this object is the only Transaction-specific input.
 */
export const transactionEditingConfig: UseTrackedGridEditingOptions<
  Transaction,
  TransactionEditableField,
  TransactionEditableValue
> = {
  getRowId: (row) => row.id,
  editableFields: TRANSACTION_EDITABLE_FIELDS,
  isEditableField: isTransactionEditableField,
  getFieldValue: (row, field) => row[field],
  // Column editability and programmatic current-page edits must enforce the same backend row policy.
  isRowEditable: (row) => !isTransactionRowReadOnly(row),
  // GRIDCAP-EDIT-VALIDATION: Transactions owns the business rule selection/messages; shared editing
  // coordinates when effective LOCAL values must be validated across every edit lifecycle.
  validateField: validateTransactionField,
};
