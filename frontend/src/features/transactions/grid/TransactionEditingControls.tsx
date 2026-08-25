import { useMemo, useState } from 'react';
import {
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
} from './transactionEditing';

interface TransactionEditingControlsProps {
  editedRowCount: number;
  lastEdit?: TransactionLastEdit;
  onApplyLastEdit: (target: TransactionEditTarget) => void;
  onApplyBulkEdit: (
    target: TransactionEditTarget,
    changes: TransactionChanges,
  ) => void;
  onPreviewPayload: () => void;
}

const STATUSES: readonly TransactionStatus[] = ['Completed', 'Pending', 'Failed'];

/**
 * Prototype UI for the two current-page editing flows we discussed.
 *
 * This component deliberately knows nothing about Infinite vs SSRM. The host grid resolves
 * "current page" and "selected on current page" into concrete RowNodes before applying changes.
 */
export function TransactionEditingControls({
  editedRowCount,
  lastEdit,
  onApplyLastEdit,
  onApplyBulkEdit,
  onPreviewPayload,
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
  }, [account, amount, currency, status, useAccount, useAmount, useCurrency, useStatus]);

  const hasBulkChanges = Object.keys(bulkChanges).length > 0;

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
        <Typography variant="subtitle2">Edit target</Typography>
        <Select<TransactionEditTarget>
          value={target}
          onChange={(event) => setTarget(event.target.value as TransactionEditTarget)}
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
          <Typography variant="subtitle2">Flow 1 — apply the last cell edit</Typography>
          <Typography variant="body2" color="text.secondary">
            {lastEdit
              ? `Last edit: ${lastEdit.field} = ${String(lastEdit.value)}`
              : 'Edit an editable cell first.'}
          </Typography>
          <div>
            <Button
              size="small"
              variant="outlined"
              disabled={!lastEdit}
              onClick={() => onApplyLastEdit(target)}
            >
              Apply last edit
            </Button>
          </div>
        </Stack>
      </Box>

      <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">Flow 2 — bulk edit current page</Typography>
          <Typography variant="body2" color="text.secondary">
            Only checked fields are changed; unchecked fields remain untouched.
          </Typography>

          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
            <FormControlLabel
              control={<Checkbox checked={useAccount} onChange={(e) => setUseAccount(e.target.checked)} />}
              label="Account"
            />
            <TextField size="small" value={account} onChange={(e) => setAccount(e.target.value)} disabled={!useAccount} />

            <FormControlLabel
              control={<Checkbox checked={useAmount} onChange={(e) => setUseAmount(e.target.checked)} />}
              label="Amount"
            />
            <TextField
              size="small"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!useAmount}
            />

            <FormControlLabel
              control={<Checkbox checked={useCurrency} onChange={(e) => setUseCurrency(e.target.checked)} />}
              label="Currency"
            />
            <TextField size="small" value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={!useCurrency} />

            <FormControlLabel
              control={<Checkbox checked={useStatus} onChange={(e) => setUseStatus(e.target.checked)} />}
              label="Status"
            />
            <Select<TransactionStatus>
              size="small"
              value={status}
              onChange={(e) => setStatus(e.target.value as TransactionStatus)}
              disabled={!useStatus}
              sx={{ minWidth: 140 }}
            >
              {STATUSES.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </Select>
          </Stack>

          <div>
            <Button
              size="small"
              variant="outlined"
              disabled={!hasBulkChanges}
              onClick={() => onApplyBulkEdit(target, bulkChanges)}
            >
              Apply bulk edit
            </Button>
          </div>
        </Stack>
      </Box>

      {import.meta.env.DEV ? (
        <div>
          <Button size="small" variant="contained" onClick={onPreviewPayload}>
            Preview edited payload
          </Button>
        </div>
      ) : null}
    </Stack>
  );
}
