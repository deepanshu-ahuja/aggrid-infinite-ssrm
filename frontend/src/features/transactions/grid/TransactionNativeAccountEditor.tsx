// GRIDCAP-EDIT-VALIDATION
import { useRef } from 'react';
import { Box, TextField } from '@mui/material';
import { type CustomCellEditorProps, useGridCellEditor } from 'ag-grid-react';
import type { Transaction } from '../api/transactions.contracts';
import { validateTransactionField } from './transactionValidation';

/** Custom MUI editor that delegates validation feedback back to AG Grid. */
export function TransactionNativeAccountEditor({
  value,
  onValueChange,
  stopEditing,
  onKeyDown: onGridKeyDown,
}: CustomCellEditorProps<Transaction, string | null>) {
  const editorRootRef = useRef<HTMLDivElement>(null);
  const currentValue = typeof value === 'string' ? value : '';

  useGridCellEditor({
    getValidationErrors: () => {
      const errors = validateTransactionField('account', currentValue);
      return errors.length > 0 ? errors.map((error) => error.message) : null;
    },
    getValidationElement: () => {
      const element = editorRootRef.current;
      if (!element) throw new Error('Account editor validation element is not mounted.');
      return element;
    },
  });

  return (
    <Box ref={editorRootRef} sx={{ width: 320, p: 1, bgcolor: 'background.paper' }}>
      <TextField
        autoFocus
        fullWidth
        size="small"
        label="Account"
        value={currentValue}
        slotProps={{ htmlInput: { 'data-testid': 'transaction-native-account-editor-input' } }}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          if (event.ctrlKey || event.metaKey) {
            onGridKeyDown(event.nativeEvent);
            return;
          }
          stopEditing();
        }}
      />
    </Box>
  );
}
