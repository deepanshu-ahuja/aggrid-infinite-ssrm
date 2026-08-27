import { Alert, Button, Popover, Stack, Typography } from '@mui/material';
import type { TransactionEditableField, TransactionEditableValue } from './transactionEditing';

interface TransactionEditConflictPopoverProps {
  anchorEl: HTMLElement | null;
  field?: TransactionEditableField;
  localValue?: TransactionEditableValue;
  remoteValue?: TransactionEditableValue;
  onClose: () => void;
  onUseServer: () => void;
  onKeepLocal: () => void;
}

/**
 * Transactions owns the visual language for a generic tracked-edit conflict.
 *
 * The shared editing engine knows only BASE/LOCAL/REMOTE state transitions. Keeping this popover in the
 * feature prevents MUI wording and Transaction field labels from leaking into reusable grid mechanics.
 */
export function TransactionEditConflictPopover({
  anchorEl,
  field,
  localValue,
  remoteValue,
  onClose,
  onUseServer,
  onKeepLocal,
}: TransactionEditConflictPopoverProps) {
  const open = Boolean(anchorEl && field);

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { width: 340, p: 2 } } }}
    >
      <Stack spacing={1.5}>
        <Alert severity="warning" sx={{ py: 0.5 }}>
          This field changed on the server while you had an unsaved edit.
        </Alert>

        <Stack spacing={0.5}>
          <Typography variant="subtitle2">Resolve {field ?? 'field'} conflict</Typography>
          <Typography variant="body2" color="text.secondary">
            Your edit: <strong>{String(localValue ?? '')}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Server value: <strong>{String(remoteValue ?? '')}</strong>
          </Typography>
        </Stack>

        <Typography variant="caption" color="text.secondary">
          Choose which value should become authoritative before this field can be saved.
        </Typography>

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" variant="outlined" onClick={onUseServer}>
            Use server
          </Button>
          <Button size="small" variant="contained" onClick={onKeepLocal}>
            Keep my edit
          </Button>
        </Stack>
      </Stack>
    </Popover>
  );
}
