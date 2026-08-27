import { Alert, Button, Stack, Typography } from '@mui/material';
import type { TransactionStatus } from '../api/transactions.contracts';

interface TransactionSelectionActionsProps {
  hasSelection: boolean;
  isApplying: boolean;
  error?: string;
  onSetStatus: (status: TransactionStatus) => void;
}

/** Simple feature action bar for backend operations against the current logical grid selection. */
export function TransactionSelectionActions({
  hasSelection,
  isApplying,
  error,
  onSetStatus,
}: TransactionSelectionActionsProps) {
  const disabled = !hasSelection || isApplying;

  return (
    <Stack spacing={1}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
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

      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
