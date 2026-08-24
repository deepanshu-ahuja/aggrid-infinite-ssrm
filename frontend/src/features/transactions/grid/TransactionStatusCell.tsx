import { Chip } from '@mui/material';
import type { CustomCellRendererProps } from 'ag-grid-react';
import type { Transaction, TransactionStatus } from '../api/transactions.contracts';

const statusColors: Record<TransactionStatus, 'success' | 'warning' | 'error'> = {
  Completed: 'success',
  Pending: 'warning',
  Failed: 'error',
};

export function TransactionStatusCell({
  value,
}: CustomCellRendererProps<Transaction, TransactionStatus>) {
  if (!value) {
    return null;
  }

  return <Chip label={value} color={statusColors[value]} size="small" variant="outlined" />;
}
