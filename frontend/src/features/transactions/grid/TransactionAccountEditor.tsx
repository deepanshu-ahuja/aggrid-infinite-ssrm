import { Box, TextField } from '@mui/material';
import type { CustomCellEditorProps } from 'ag-grid-react';
import type { Transaction } from '../api/transactions.contracts';
import { validateTransactionField } from './transactionValidation';

/**
 * One concrete MUI text-input cell editor used to prove third-party input integration with AG Grid.
 *
 * The editor validates its current draft locally so the user sees the exact reason beside the input
 * while correcting it. Committed validation still goes through `useTrackedGridEditing`; this local
 * message is presentation, not a second validation source of truth.
 */
export function TransactionAccountEditor({
  value,
  onValueChange,
  stopEditing,
}: CustomCellEditorProps<Transaction, string | null>) {
  const currentValue = typeof value === 'string' ? value : '';
  const message = validateTransactionField('account', currentValue)[0]?.message;

  return (
    <Box sx={{ width: 320, p: 1, bgcolor: 'background.paper' }}>
      <TextField
        autoFocus
        fullWidth
        size="small"
        label="Account"
        value={currentValue}
        error={Boolean(message)}
        helperText={message ?? ' '}
        slotProps={{
          htmlInput: { 'data-testid': 'transaction-account-editor-input' },
        }}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') stopEditing();
        }}
      />
    </Box>
  );
}
