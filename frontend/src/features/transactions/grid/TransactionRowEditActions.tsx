// GRIDCAP-EDIT-SAVE-ROW | GRIDCAP-EDIT-VALIDATION | GRIDCAP-EDIT-CONFLICT
import { Button, Stack, Tooltip } from '@mui/material';
import type { CustomCellRendererProps } from 'ag-grid-react';
import type { Transaction } from '../api/transactions.contracts';
import type { TransactionEditableField, TransactionEditableValue } from './transactionEditing';
import { isTransactionRowReadOnly } from './transactionRowInteraction';

/**
 * Feature context consumed by Transactions cell renderers and conflict/validation-aware column callbacks.
 * Durable dirty/conflict/validation state remains outside AG Grid; renderers only query it and invoke
 * feature/root callbacks so presentation never becomes a second state store.
 */
export interface TransactionRowEditActionsContext {
  isRowDirty: (rowId: string) => boolean;
  isRowConflicted: (rowId: string) => boolean;
  isRowInvalid: (rowId: string) => boolean;
  isCellConflicted: (rowId: string, field: TransactionEditableField) => boolean;
  isCellInvalid: (rowId: string, field: TransactionEditableField) => boolean;
  getCellValidationMessages: (rowId: string, field: TransactionEditableField) => readonly string[];
  getCellConflict: (
    rowId: string,
    field: TransactionEditableField,
  ) => { localValue: TransactionEditableValue; remoteValue: TransactionEditableValue } | undefined;
  isSaving: boolean;
  onSaveRow: (rowId: string) => void;
  onDiscardRow: (rowId: string) => void;
}

/** Single-row persistence belongs beside the row the user edited. */
export function TransactionRowEditActions({
  data,
  context,
}: CustomCellRendererProps<Transaction, unknown, TransactionRowEditActionsContext>) {
  if (!data || isTransactionRowReadOnly(data) || !context?.isRowDirty(data.id)) return null;

  const hasConflict = context.isRowConflicted(data.id);
  const hasValidationError = context.isRowInvalid(data.id);
  const blocked = hasConflict || hasValidationError;
  const saveButton = (
    <Button
      size="small"
      disabled={context.isSaving || blocked}
      onClick={() => context.onSaveRow(data.id)}
    >
      Save
    </Button>
  );

  const blockedReason = hasConflict
    ? 'Resolve the highlighted field conflict before saving this row.'
    : hasValidationError
      ? 'Correct the highlighted validation errors before saving this row.'
      : undefined;

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" height="100%">
      {blockedReason ? (
        <Tooltip title={blockedReason}>
          <span>{saveButton}</span>
        </Tooltip>
      ) : (
        saveButton
      )}
      <Button
        size="small"
        disabled={context.isSaving}
        onClick={() => context.onDiscardRow(data.id)}
      >
        Discard
      </Button>
    </Stack>
  );
}
