import { Box, TextField } from '@mui/material';
import type { CustomCellEditorProps } from 'ag-grid-react';
import type { Transaction } from '../api/transactions.contracts';
import { validateTransactionField } from './transactionValidation';

/**
 * MUI date-input cell editor for the persisted Transaction date field.
 *
 * `type="date"` uses the browser's native date picker while keeping MUI styling/integration. Clearing
 * the picker produces a null LOCAL draft so the normal validation lifecycle can keep it visible,
 * explain the exact error, and block Save until the user corrects or discards it.
 */
export function TransactionDateEditor({
  value,
  onValueChange,
  stopEditing,
}: CustomCellEditorProps<Transaction, string | null>) {
  const currentValue = typeof value === 'string' ? value : '';
  const message = validateTransactionField(
    'transactionDate',
    currentValue === '' ? null : currentValue,
  )[0]?.message;

  return (
    <Box sx={{ width: 280, p: 1, bgcolor: 'background.paper' }}>
      <TextField
        autoFocus
        fullWidth
        size="small"
        type="date"
        label="Transaction date"
        value={currentValue}
        error={Boolean(message)}
        helperText={message ?? ' '}
        slotProps={{ inputLabel: { shrink: true } }}
        onChange={(event) => onValueChange(event.target.value === '' ? null : event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') stopEditing();
        }}
      />
    </Box>
  );
}
