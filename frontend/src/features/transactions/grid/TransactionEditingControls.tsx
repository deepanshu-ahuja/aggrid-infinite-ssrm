import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { TransactionStatus } from '../api/transactions.contracts';
import type {
  TransactionChanges,
  TransactionEditTarget,
  TransactionLastEdit,
  TransactionUpdatePayload,
} from './transactionEditing';

interface TransactionEditingControlsProps {
  editedRowCount: number;
  lastEdit?: TransactionLastEdit;
  updates: TransactionUpdatePayload['updates'];
  isSaving: boolean;
  saveError?: string;
  onApplyLastEdit: (target: TransactionEditTarget) => void;
  onApplyBulkEdit: (
    target: TransactionEditTarget,
    changes: TransactionChanges,
  ) => void;
  onSaveRow: (rowId: string) => void;
  onDiscardRow: (rowId: string) => void;
  onSaveAll: () => void;
  onDiscardAll: () => void;
}

const STATUSES: readonly TransactionStatus[] = ['Completed', 'Pending', 'Failed'];

/**
 * Transactions editing presentation.
 *
 * This component owns only UI/form choices. AG Grid owns cell editing, the shared edit engine owns
 * local draft mechanics, and TanStack Query/domain persistence live outside this component.
 */
export function TransactionEditingControls({
  editedRowCount,
  lastEdit,
  updates,
  isSaving,
  saveError,
  onApplyLastEdit,
  onApplyBulkEdit,
  onSaveRow,
  onDiscardRow,
  onSaveAll,
  onDiscardAll,
}: TransactionEditingControlsProps) {
  const [target, setTarget] = useState<TransactionEditTarget>('page');
  const [useAccount, setUseAccount] = useState(false);
  const [account, setAccount] = useState('');
  const [useAmount, setUseAmount] = useState(false);
  const [amount, setAmount] = useState('');
  const [useCurrency, setUseCurrency] = useState(false);
  const [currency, setCurrency] = useState('');
  const [useStatus, setUseStatus] = useState(false);
  const [status, setStatus] = useState<TransactionStatus>('Pending');

  const bulkChanges = useMemo<TransactionChanges>(() => {
    const changes: TransactionChanges = {};

    if (useAccount) changes.account = account;
    if (useAmount && amount !== '') changes.amount = Number(amount);
    if (useCurrency) changes.currency = currency;
    if (useStatus) changes.status = status;

    return changes;
  }, [
    account,
    amount,
    currency,
    status,
    useAccount,
    useAmount,
    useCurrency,
    useStatus,
  ]);

  const hasBulkChanges = Object.keys(bulkChanges).length > 0;
  const hasTrackedEdits = updates.length > 0;

  return (
    <Stack spacing={1.5}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        alignItems={{ md: 'center' }}
      >
        <Typography variant="subtitle2">Edit target</Typography>
        <Select<TransactionEditTarget>
          value={target}
          onChange={(event) =>
            setTarget(event.target.value as TransactionEditTarget)
          }
          size="small"
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="page">Entire current page</MenuItem>
          <MenuItem value="selected">Selected rows on current page</MenuItem>
        </Select>
        <Typography variant="caption" color="text.secondary">
          {editedRowCount} row{editedRowCount === 1 ? '' : 's'} currently edited
        </Typography>
      </Stack>

      <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">
            Flow 1 — apply the last cell edit
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {lastEdit
              ? `Last edit: ${lastEdit.field} = ${String(lastEdit.value)}`
              : 'Edit an editable cell first.'}
          </Typography>
          <div>
            <Button
              size="small"
              variant="outlined"
              disabled={!lastEdit || isSaving}
              onClick={() => onApplyLastEdit(target)}
            >
              Apply last edit
            </Button>
          </div>
        </Stack>
      </Box>

      <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">
            Flow 2 — bulk edit current page
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Only checked fields are changed; unchecked fields remain untouched.
          </Typography>

          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={1}
            useFlexGap
            flexWrap="wrap"
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={useAccount}
                  onChange={(event) => setUseAccount(event.target.checked)}
                />
              }
              label="Account"
            />
            <TextField
              size="small"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              disabled={!useAccount || isSaving}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={useAmount}
                  onChange={(event) => setUseAmount(event.target.checked)}
                />
              }
              label="Amount"
            />
            <TextField
              size="small"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={!useAmount || isSaving}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={useCurrency}
                  onChange={(event) => setUseCurrency(event.target.checked)}
                />
              }
              label="Currency"
            />
            <TextField
              size="small"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              disabled={!useCurrency || isSaving}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={useStatus}
                  onChange={(event) => setUseStatus(event.target.checked)}
                />
              }
              label="Status"
            />
            <Select<TransactionStatus>
              size="small"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as TransactionStatus)
              }
              disabled={!useStatus || isSaving}
              sx={{ minWidth: 140 }}
            >
              {STATUSES.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </Stack>

          <div>
            <Button
              size="small"
              variant="outlined"
              disabled={!hasBulkChanges || isSaving}
              onClick={() => onApplyBulkEdit(target, bulkChanges)}
            >
              Apply bulk edit
            </Button>
          </div>
        </Stack>
      </Box>

      <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Stack spacing={1}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ sm: 'center' }}
          >
            <Typography variant="subtitle2">Unsaved changes</Typography>
            <Button
              size="small"
              variant="contained"
              disabled={!hasTrackedEdits || isSaving}
              onClick={onSaveAll}
            >
              {isSaving ? 'Saving…' : 'Save all'}
            </Button>
            <Button
              size="small"
              variant="outlined"
              disabled={!hasTrackedEdits || isSaving}
              onClick={onDiscardAll}
            >
              Discard all
            </Button>
          </Stack>

          {saveError ? <Alert severity="error">{saveError}</Alert> : null}

          {updates.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No unsaved changes.
            </Typography>
          ) : (
            updates.map((update) => (
              <Stack
                key={update.id}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ sm: 'center' }}
              >
                <Typography variant="body2" sx={{ minWidth: 140 }}>
                  {update.id}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ flex: 1 }}
                >
                  {Object.keys(update.changes).join(', ')}
                </Typography>
                <Button
                  size="small"
                  disabled={isSaving}
                  onClick={() => onSaveRow(update.id)}
                >
                  Save row
                </Button>
                <Button
                  size="small"
                  disabled={isSaving}
                  onClick={() => onDiscardRow(update.id)}
                >
                  Discard row
                </Button>
              </Stack>
            ))
          )}
        </Stack>
      </Box>
    </Stack>
  );
}
