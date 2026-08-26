import { MenuItem, Select } from '@mui/material';
import type { CustomCellEditorProps } from 'ag-grid-react';
import type { Transaction, TransactionStatus } from '../api/transactions.contracts';

const TRANSACTION_STATUSES: readonly TransactionStatus[] = ['Completed', 'Pending', 'Failed'];

/**
 * Example custom application editor built with MUI rather than AG Grid's provided editors.
 *
 * MUI renders the Select menu in a document-level portal by default. That is desirable here because
 * AG Grid cells/viewports use overflow clipping, so forcing the menu inside the cell can make the
 * opened options appear missing.
 *
 * AG Grid asks third-party popups rendered outside the editor DOM to carry
 * `ag-custom-component-popup`. This tells the grid that clicks inside MUI's portalled menu still
 * belong to the active editor instead of being interpreted as a click outside that should end edit
 * mode.
 */
export function TransactionStatusEditor({
  value,
  onValueChange,
  stopEditing,
}: CustomCellEditorProps<Transaction, TransactionStatus>) {
  return (
    <Select<TransactionStatus>
      value={value ?? 'Pending'}
      onChange={(event) => {
        const nextValue = event.target.value as TransactionStatus;

        onValueChange(nextValue);

        /**
         * A select choice is a complete edit. Stop on the next task so AG Grid first receives the
         * controlled value update and then commits that value through its normal editing lifecycle.
         */
        window.setTimeout(() => stopEditing(), 0);
      }}
      MenuProps={{
        slotProps: {
          paper: {
            className: 'ag-custom-component-popup',
          },
        },
      }}
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
