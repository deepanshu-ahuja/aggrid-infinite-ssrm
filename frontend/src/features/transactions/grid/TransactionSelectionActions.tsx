import { Alert, Button, Stack, Typography } from '@mui/material';
import type { TransactionStatus } from '../api/transactions.contracts';

interface TransactionSelectionActionsProps {
  hasSelection: boolean;
  /** Logical row count, including unloaded rows when dataset-wide Select All is active. */
  selectedRowCount: number;
  isApplying: boolean;
  /** Status actions may not decide a still-unresolved LOCAL-vs-REMOTE status conflict implicitly. */
  statusActionBlockedByConflict: boolean;
  error?: string;
  onSetStatus: (status: TransactionStatus) => void;
}

/** Simple feature action bar for backend operations against the current logical grid selection. */
export function TransactionSelectionActions({
  hasSelection,
  selectedRowCount,
  isApplying,
  statusActionBlockedByConflict,
  error,
  onSetStatus,
}: TransactionSelectionActionsProps) {
  const disabled = !hasSelection || isApplying || statusActionBlockedByConflict;

  return (
    <Stack spacing={1}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <Typography variant="body2" sx={{ mr: 1 }}>
          {selectedRowCount} selected
        </Typography>
        <Typography variant="body2" sx={{ mr: 1 }}>
          Update selected status
        </Typography>
        <Button size="small" variant="outlined" disabled={disabled} onClick={() => onSetStatus('Completed')}>
          Mark Completed
        </Button>
        <Button size="small" variant="outlined" disabled={disabled} onClick={() => onSetStatus('Pending')}>
          Mark Pending
        </Button>
        <Button size="small" variant="outlined" disabled={disabled} onClick={() => onSetStatus('Failed')}>
          Mark Failed
        </Button>
      </Stack>

      {statusActionBlockedByConflict ? (
        <Typography variant="caption" color="warning.main">
          Resolve selected status conflicts before applying a server-side status action.
        </Typography>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
