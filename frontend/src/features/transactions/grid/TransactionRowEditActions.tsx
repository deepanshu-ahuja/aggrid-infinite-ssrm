import { Button, Stack } from '@mui/material';
import type { CustomCellRendererProps } from 'ag-grid-react';
import type { Transaction } from '../api/transactions.contracts';
import { isTransactionRowReadOnly } from './transactionRowInteraction';

/**
 * Feature context consumed only by the Transactions Actions cell.
 *
 * Dirty state remains owned by `useTrackedGridEditing`; the renderer asks the root whether this row
 * currently has a real draft instead of maintaining another edited-row list of its own.
 */
export interface TransactionRowEditActionsContext {
  isRowDirty: (rowId: string) => boolean;
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

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" height="100%">
      <Button size="small" disabled={context.isSaving} onClick={() => context.onSaveRow(data.id)}>
        Save
      </Button>
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
