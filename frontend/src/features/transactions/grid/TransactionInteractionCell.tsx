import { Chip, SvgIcon, Tooltip } from '@mui/material';
import type { CustomCellRendererProps } from 'ag-grid-react';
import type { Transaction } from '../api/transactions.contracts';

function LockIcon() {
  return (
    <SvgIcon fontSize="small" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2Zm-7-2a2 2 0 0 1 4 0v2h-4V6Zm7 13H7v-9h10v9Z" />
    </SvgIcon>
  );
}

/**
 * Visible explanation for backend-provided row restrictions.
 *
 * This renderer does not enforce selection/editability. Native AG Grid callbacks and backend
 * validation own enforcement; the cell only makes the otherwise subtle restriction discoverable.
 */
export function TransactionInteractionCell({ data }: CustomCellRendererProps<Transaction>) {
  if (!data || data.interactionMode === 'enabled') return null;

  const isReadOnly = data.interactionMode === 'readOnly';
  const label = isReadOnly ? 'Read only' : 'Selection disabled';
  const reason =
    data.interactionReason ??
    (isReadOnly
      ? 'This row is read-only.'
      : 'This row is not eligible for selection-based bulk actions.');

  return (
    <Tooltip title={reason} arrow>
      <Chip
        icon={isReadOnly ? <LockIcon /> : undefined}
        label={label}
        size="small"
        color={isReadOnly ? 'default' : 'warning'}
        variant={isReadOnly ? 'filled' : 'outlined'}
        aria-label={`${label}: ${reason}`}
        sx={{ cursor: 'help' }}
      />
    </Tooltip>
  );
}
