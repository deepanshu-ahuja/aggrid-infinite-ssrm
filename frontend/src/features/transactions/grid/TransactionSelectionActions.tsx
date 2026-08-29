// GRIDCAP-ACTION-SELECTED
import { Alert, Button, Stack, Typography } from '@mui/material';
import type { TransactionStatus } from '../api/transactions.contracts';

interface TransactionSelectionActionsProps {
  hasSelection: boolean;
  /** Renderable logical row count; server dataset-wide modes may include unloaded rows, Client is exact. */
  selectedRowCount: number;
  isApplying: boolean;
  /** Status actions may not decide a still-unresolved LOCAL-vs-REMOTE status conflict implicitly. */
  statusActionBlockedByConflict: boolean;
  error?: string;
  onSetStatus: (status: TransactionStatus) => void;
}

interface StatusSelectionAction {
  status: TransactionStatus;
  label: string;
}

/**
 * These buttons are values of one business action family: Change Status.
 *
 * The selected-status mutation always clears selection after a successful backend update because the
 * changed status can move rows into or out of the current filter universe. Do not carry a configurable
 * clear/preserve value through these button definitions when the behavior is not actually variable.
 */
const STATUS_SELECTION_ACTIONS: readonly StatusSelectionAction[] = [
  { status: 'Completed', label: 'Mark Completed' },
  { status: 'Pending', label: 'Mark Pending' },
  { status: 'Failed', label: 'Mark Failed' },
];

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
        {STATUS_SELECTION_ACTIONS.map((action) => (
          <Button
            key={action.status}
            size="small"
            variant="outlined"
            disabled={disabled}
            onClick={() => onSetStatus(action.status)}
          >
            {action.label}
          </Button>
        ))}
      </Stack>

      {statusActionBlockedByConflict ? (
        <Typography variant="caption" color="warning.main">
          Resolve selected status conflicts before applying a backend status action.
        </Typography>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
