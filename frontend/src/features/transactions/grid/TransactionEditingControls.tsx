// GRIDCAP-EDIT-SAVE-SELECTED | GRIDCAP-EDIT-VALIDATION | GRIDCAP-EDIT-CONFLICT
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
} from './transactionEditing';

interface TransactionEditingControlsProps {
  editedRowCount: number;
  conflictCount: number;
  validationErrorCount: number;
  selectedEditedRowCount: number;
  selectedEditsHaveConflict: boolean;
  selectedEditsHaveValidationError: boolean;
  lastEdit?: TransactionLastEdit;
  isSaving: boolean;
  saveError?: string;
  onApplyLastEdit: (target: TransactionEditTarget) => void;
  onApplyBulkEdit: (target: TransactionEditTarget, changes: TransactionChanges) => void;
  onSaveSelected: () => void;
  onDiscardSelected: () => void;
}

const STATUSES: readonly TransactionStatus[] = ['Completed', 'Pending', 'Failed'];

/** Transactions editing presentation for current-page edit helpers and explicit draft persistence. */
export function TransactionEditingControls({
  editedRowCount,
  conflictCount,
  validationErrorCount,
  selectedEditedRowCount,
  selectedEditsHaveConflict,
  selectedEditsHaveValidationError,
  lastEdit,
  isSaving,
  saveError,
  onApplyLastEdit,
  onApplyBulkEdit,
  onSaveSelected,
  onDiscardSelected,
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
  const hasSelectedEdits = selectedEditedRowCount > 0;
  const selectedSaveBlocked = selectedEditsHaveConflict || selectedEditsHaveValidationError;

  return (
    <Stack spacing={1.5}>
      {conflictCount > 0 ? (
        <Alert severity="warning">
          {conflictCount} field conflict{conflictCount === 1 ? '' : 's'} need review. Click a highlighted
          cell and choose <strong>Use server</strong> or <strong>Keep my edit</strong> before saving that row.
        </Alert>
      ) : null}

      {validationErrorCount > 0 ? (
        <Alert severity="error">
          {validationErrorCount} validation error{validationErrorCount === 1 ? '' : 's'} need correction.
          Invalid local edits stay visible and dirty until corrected or discarded.
        </Alert>
      ) : null}

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
          {editedRowCount} row{editedRowCount === 1 ? '' : 's'} edited total;{' '}
          {selectedEditedRowCount} selected
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
          <Typography variant="subtitle2">Flow 2 — bulk edit current page</Typography>
          <Typography variant="body2" color="text.secondary">
            Only checked fields are changed; unchecked fields remain untouched. Invalid values are applied
            as local drafts and highlighted so they can be corrected before Save.
          </Typography>

          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
            <FormControlLabel control={<Checkbox checked={useAccount} onChange={(event) => setUseAccount(event.target.checked)} />} label="Account" />
            <TextField size="small" value={account} onChange={(event) => setAccount(event.target.value)} disabled={!useAccount || isSaving} />

            <FormControlLabel control={<Checkbox checked={useAmount} onChange={(event) => setUseAmount(event.target.checked)} />} label="Amount" />
            <TextField size="small" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={!useAmount || isSaving} />

            <FormControlLabel control={<Checkbox checked={useCurrency} onChange={(event) => setUseCurrency(event.target.checked)} />} label="Currency" />
            <TextField size="small" value={currency} onChange={(event) => setCurrency(event.target.value)} disabled={!useCurrency || isSaving} />

            <FormControlLabel control={<Checkbox checked={useStatus} onChange={(event) => setUseStatus(event.target.checked)} />} label="Status" />
            <Select<TransactionStatus> size="small" value={status} onChange={(event) => setStatus(event.target.value as TransactionStatus)} disabled={!useStatus || isSaving} sx={{ minWidth: 140 }}>
              {STATUSES.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
            </Select>
          </Stack>

          <div>
            <Button size="small" variant="outlined" disabled={!hasBulkChanges || isSaving} onClick={() => onApplyBulkEdit(target, bulkChanges)}>
              Apply bulk edit
            </Button>
          </div>
        </Stack>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
        <Button
          size="small"
          variant="contained"
          disabled={!hasSelectedEdits || isSaving || selectedSaveBlocked}
          onClick={onSaveSelected}
        >
          {isSaving ? 'Saving…' : `Save selected edits (${selectedEditedRowCount})`}
        </Button>
        <Button size="small" variant="outlined" disabled={!hasSelectedEdits || isSaving} onClick={onDiscardSelected}>
          Discard selected edits
        </Button>
      </Stack>

      {selectedEditsHaveConflict ? (
        <Typography variant="caption" color="warning.main">
          Selected edits include unresolved conflicts. Resolve the highlighted cells before saving the selection.
        </Typography>
      ) : null}
      {selectedEditsHaveValidationError ? (
        <Typography variant="caption" color="error.main">
          Selected edits include invalid fields. Correct or discard the highlighted values before saving the selection.
        </Typography>
      ) : null}
      {saveError ? <Alert severity="error">{saveError}</Alert> : null}
    </Stack>
  );
}
