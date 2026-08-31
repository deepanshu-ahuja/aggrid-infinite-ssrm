// GRIDCAP-EDIT-VALIDATION
import { useRef } from 'react';
import { Box, TextField } from '@mui/material';
import { type CustomCellEditorProps, useGridCellEditor } from 'ag-grid-react';
import type { Transaction } from '../api/transactions.contracts';
import { validateTransactionField } from './transactionValidation';

/** MUI date editor using AG Grid's custom-editor validation callbacks instead of local helper text. */
export function TransactionNativeDateEditor({
  value,
  onValueChange,
  stopEditing,
  onKeyDown: onGridKeyDown,
}: CustomCellEditorProps<Transaction, string | null>) {
  const editorRootRef = useRef<HTMLDivElement>(null);
  const currentValue = typeof value === 'string' ? value : '';

  useGridCellEditor({
    getValidationErrors: () => {
      const candidate = currentValue === '' ? null : currentValue;
      const errors = validateTransactionField('transactionDate', candidate);
      return errors.length > 0 ? errors.map((error) => error.message) : null;
    },
    getValidationElement: () => {
      const element = editorRootRef.current;
      if (!element) throw new Error('Date editor validation element is not mounted.');
      return element;
    },
  });

  return (
    <Box ref={editorRootRef} sx={{ width: 280, p: 1, bgcolor: 'background.paper' }}>
      <TextField
        autoFocus
        fullWidth
        size="small"
        type="date"
        label="Transaction date"
        value={currentValue}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: { 'data-testid': 'transaction-native-date-editor-input' },
        }}
        onChange={(event) => onValueChange(event.target.value === '' ? null : event.target.value)}
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
