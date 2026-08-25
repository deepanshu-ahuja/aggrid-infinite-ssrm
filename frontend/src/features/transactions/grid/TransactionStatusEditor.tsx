import { MenuItem, Select } from '@mui/material';
import type { CustomCellEditorProps } from 'ag-grid-react';
import type { Transaction, TransactionStatus } from '../api/transactions.contracts';

const TRANSACTION_STATUSES: readonly TransactionStatus[] = [
  'Completed',
  'Pending',
  'Failed',
];

/**
 * Example custom application editor built with MUI rather than AG Grid's provided editors.
 *
 * AG Grid's current React editor contract is controlled (`value` + `onValueChange`). Keeping the MUI
 * menu out of a document-level portal also prevents a menu click from looking like focus left the
 * grid editor before the chosen value is committed.
 */
export function TransactionStatusEditor({
  value,
  onValueChange,
}: CustomCellEditorProps<Transaction, TransactionStatus>) {
  return (
    <Select<TransactionStatus>
      value={value ?? 'Pending'}
      onChange={(event) =>
        onValueChange(event.target.value as TransactionStatus)
      }
      MenuProps={{ disablePortal: true }}
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
