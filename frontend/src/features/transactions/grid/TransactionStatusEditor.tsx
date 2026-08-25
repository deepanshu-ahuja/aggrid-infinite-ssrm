import { MenuItem, Select } from '@mui/material';
import type { CustomCellEditorProps } from 'ag-grid-react';
import type { Transaction, TransactionStatus } from '../api/transactions.contracts';

const TRANSACTION_STATUSES: readonly TransactionStatus[] = [
  'Completed',
  'Pending',
  'Failed',
];

/**
 * Example of a custom application cell editor built with MUI rather than AG Grid's provided editors.
 *
 * This deliberately uses AG Grid's controlled React editor contract (`value` + `onValueChange`).
 * The surrounding edit tracking listens to AG Grid's normal cell-value lifecycle, so it does not
 * care whether a value came from this MUI component or from a built-in text/number editor.
 */
export function TransactionStatusEditor({
  value,
  onValueChange,
}: CustomCellEditorProps<Transaction, TransactionStatus>) {
  return (
    <Select<TransactionStatus>
      value={value}
      onChange={(event) => onValueChange(event.target.value as TransactionStatus)}
      size="small"
      autoFocus
      fullWidth
      sx={{ height: '100%' }}
    >
      {TRANSACTION_STATUSES.map((status) => (
        <MenuItem key={status} value={status}>
          {status}
        </MenuItem>
      ))}
    </Select>
  );
}
