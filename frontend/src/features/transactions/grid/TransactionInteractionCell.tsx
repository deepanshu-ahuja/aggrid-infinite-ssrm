import { Chip, Tooltip } from '@mui/material';
import type { CustomCellRendererProps } from 'ag-grid-react';
import type { Transaction } from '../api/transactions.contracts';

/**
 * Visible explanation for backend-provided row restrictions.
 *
 * This renderer does not enforce selection/editability. Native AG Grid callbacks and backend
 * validation own enforcement; the cell only makes the otherwise subtle restriction discoverable.
 */
export function TransactionInteractionCell({ data }: CustomCellRendererProps<Transaction>) {
  if (!data || data.interactionMode === 'enabled') return null;

  const isReadOnly = data.interactionMode === 'readOnly';
  const label = isReadOnly ? '🔒 Read only' : 'Selection disabled';
  const reason =
    data.interactionReason ??
    (isReadOnly
      ? 'This row is read-only.'
      : 'This row is not eligible for selection-based bulk actions.');

  return (
    <Tooltip title={reason} arrow>
      <Chip
        label={label}
        size="small"
        variant={isReadOnly ? 'filled' : 'outlined'}
        aria-label={`${label}: ${reason}`}
        sx={{ cursor: 'help' }}
      />
    </Tooltip>
  );
}
