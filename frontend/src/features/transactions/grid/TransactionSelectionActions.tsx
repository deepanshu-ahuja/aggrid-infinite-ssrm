// GRIDCAP-ACTION-SELECTED
import { Alert, Button, Stack, Typography } from '@mui/material';
import type { TransactionStatus } from '../api/transactions.contracts';
import type { SelectionAfterSuccessPolicy } from './transactionSelectionAction';

interface TransactionSelectionActionsProps {
  hasSelection: boolean;
  /** Renderable logical row count; server dataset-wide modes may include unloaded rows, Client is exact. */
  selectedRowCount: number;
  isApplying: boolean;
  /** Status actions may not decide a still-unresolved LOCAL-vs-REMOTE status conflict implicitly. */
  statusActionBlockedByConflict: boolean;
  error?: string;
  onSetStatus: (status: TransactionStatus, selectionAfterSuccess: SelectionAfterSuccessPolicy) => void;
}

interface StatusSelectionAction {
  status: TransactionStatus;
  label: string;
  selectionAfterSuccess: SelectionAfterSuccessPolicy;
}

/**
 * Business-action policy belongs with the feature action, not in shared grid selection.
 *
 * These status mutations can change the selected/filter universe (for example Pending -> Completed),
 * so they deliberately clear selection after a successful backend mutation. A future non-mutating or
 * workflow-specific action can explicitly choose `preserve` without changing the shared grid default.
 */
const STATUS_SELECTION_ACTIONS: readonly StatusSelectionAction[] = [
  { status: 'Completed', label: 'Mark Completed', selectionAfterSuccess: 'clear' },
  { status: 'Pending', label: 'Mark Pending', selectionAfterSuccess: 'clear' },
  { status: 'Failed', label: 'Mark Failed', selectionAfterSuccess: 'clear' },
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
            onClick={() => onSetStatus(action.status, action.selectionAfterSuccess)}
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
