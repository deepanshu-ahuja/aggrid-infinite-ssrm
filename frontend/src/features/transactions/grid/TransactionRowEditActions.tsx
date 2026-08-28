import { Button, Stack, Tooltip } from '@mui/material';
import type { CustomCellRendererProps } from 'ag-grid-react';
import type { Transaction } from '../api/transactions.contracts';
import type { TransactionEditableField, TransactionEditableValue } from './transactionEditing';
import { isTransactionRowReadOnly } from './transactionRowInteraction';

/**
 * Feature context consumed by Transactions cell renderers and conflict-aware column callbacks.
 *
 * Durable dirty/conflict state remains owned by `useTrackedGridEditing`; renderers only ask questions
 * and invoke feature/root callbacks. This keeps AG Grid presentation from becoming a second state store.
 */
export interface TransactionRowEditActionsContext {
  isRowDirty: (rowId: string) => boolean;
  isRowConflicted: (rowId: string) => boolean;
  isCellConflicted: (rowId: string, field: TransactionEditableField) => boolean;
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
  const saveButton = (
    <Button
      size="small"
      disabled={context.isSaving || hasConflict}
      onClick={() => context.onSaveRow(data.id)}
    >
      Save
    </Button>
  );

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" height="100%">
      {hasConflict ? (
        <Tooltip title="Resolve the highlighted field conflict before saving this row.">
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
