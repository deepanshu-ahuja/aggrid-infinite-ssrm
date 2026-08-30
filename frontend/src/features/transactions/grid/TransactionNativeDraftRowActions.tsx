// GRIDCAP-EDIT-SAVE-ROW | GRIDCAP-EDIT-DISCARD
import { Button, Stack } from '@mui/material';
import type { CustomCellRendererProps } from 'ag-grid-react';
import type { Transaction } from '../api/transactions.contracts';
import type { TransactionEditableField } from './transactionEditing';
import { isTransactionRowReadOnly } from './transactionRowInteraction';

export interface TransactionNativeDraftContext {
  isRowDirty: (rowId: string) => boolean;
  isCellDirty: (rowId: string, field: TransactionEditableField) => boolean;
  isSaving: boolean;
  onSaveRow: (rowId: string) => void;
  onDiscardRow: (rowId: string) => void;
}

/** Row-local Save/Discard for the lightweight draft experiment. */
export function TransactionNativeDraftRowActions({
  data,
  context,
}: CustomCellRendererProps<Transaction, unknown, TransactionNativeDraftContext>) {
  if (!data || isTransactionRowReadOnly(data) || !context?.isRowDirty(data.id)) return null;

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" height="100%">
      <Button size="small" disabled={context.isSaving} onClick={() => context.onSaveRow(data.id)}>
        Save
      </Button>
      <Button size="small" disabled={context.isSaving} onClick={() => context.onDiscardRow(data.id)}>
        Discard
      </Button>
    </Stack>
  );
}
