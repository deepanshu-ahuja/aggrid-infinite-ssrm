// GRIDCAP-IMPORT
import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { ApiError } from '@/shared/api/apiError';
import { applyTransactionImport, previewTransactionImport } from '../api/transactions.api';
import type {
  TransactionImportError,
  TransactionImportPreviewResponse,
  TransactionImportRequest,
} from '../api/transactions.contracts';

const TEMPLATE = 'id,account,amount,currency,status,transactionDate\n';

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'transactions-import-template.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 400) {
    return 'Import validation failed. Preview the current file again and fix the reported errors.';
  }
  return error instanceof Error ? error.message : 'Transaction import failed.';
}

function ImportErrors({ errors }: { errors: TransactionImportError[] }) {
  if (errors.length === 0) return null;

  return (
    <Stack spacing={0.75} data-testid="transaction-import-errors">
      {errors.map((error, index) => (
        <Alert severity="error" key={`${error.row ?? 'file'}-${error.id ?? ''}-${index}`}>
          <strong>{error.row ? `CSV row ${error.row}` : 'File'}</strong>
          {error.id ? ` (${error.id})` : ''}:{' '}
          {Object.entries(error.fields)
            .flatMap(([field, messages]) => messages.map((message) => `${field}: ${message}`))
            .join(' ')}
        </Alert>
      ))}
    </Stack>
  );
}

interface TransactionImportActionProps {
  /** Concrete row-model root owns the authoritative refresh after a successful Import apply. */
  onImported: () => void;
}

/** Feature-owned CSV Import UI. Import never creates tracked LOCAL edits. */
export function TransactionImportAction({ onImported }: TransactionImportActionProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File>();
  const [request, setRequest] = useState<TransactionImportRequest>();
  const [preview, setPreview] = useState<TransactionImportPreviewResponse>();
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const resetFileState = () => {
    setRequest(undefined);
    setPreview(undefined);
    setError(undefined);
    setSuccess(undefined);
  };

  const handlePreview = async () => {
    if (!file || isPreviewing || isApplying) return;
    setIsPreviewing(true);
    setError(undefined);
    setSuccess(undefined);
    try {
      const nextRequest = { filename: file.name, content: await file.text() };
      const result = await previewTransactionImport(nextRequest);
      setRequest(nextRequest);
      setPreview(result);
    } catch (previewError) {
      setRequest(undefined);
      setPreview(undefined);
      setError(errorMessage(previewError));
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleApply = async () => {
    if (!request || !preview?.valid || isApplying || isPreviewing) return;
    setIsApplying(true);
    setError(undefined);
    try {
      const result = await applyTransactionImport(request);
      setSuccess(`Imported ${result.updatedCount} transaction${result.updatedCount === 1 ? '' : 's'}.`);
      onImported();
    } catch (applyError) {
      setSuccess(undefined);
      setError(errorMessage(applyError));
      if (applyError instanceof ApiError && applyError.status === 400) {
        const details = applyError.details as TransactionImportPreviewResponse | undefined;
        if (details && typeof details === 'object' && 'valid' in details) setPreview(details);
      }
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <>
      <Button variant="outlined" size="small" onClick={() => setOpen(true)}>
        Import CSV
      </Button>

      <Dialog open={open} onClose={() => !isApplying && setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Import transactions</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Update existing Transactions by stable id. Supported editable columns are account,
              amount, currency, status and transactionDate. Preview validates the complete file without
              changing data; Apply revalidates and applies the file atomically.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
              <Button component="label" variant="contained" size="small">
                Choose CSV
                <input
                  hidden
                  type="file"
                  accept=".csv,text/csv"
                  data-testid="transaction-import-file"
                  onChange={(event) => {
                    setFile(event.target.files?.[0]);
                    resetFileState();
                  }}
                />
              </Button>
              <Button variant="text" size="small" onClick={downloadTemplate}>
                Download template
              </Button>
              {file ? <Typography variant="body2">{file.name}</Typography> : null}
            </Stack>

            {error ? <Alert severity="error">{error}</Alert> : null}
            {success ? <Alert severity="success">{success}</Alert> : null}

            {preview ? (
              <Box>
                <Alert severity={preview.valid ? 'success' : 'warning'} sx={{ mb: 1 }}>
                  {preview.valid
                    ? `${preview.rowCount} row${preview.rowCount === 1 ? '' : 's'} ready to apply.`
                    : `Preview found ${preview.errors.length} error${preview.errors.length === 1 ? '' : 's'}. Nothing has been changed.`}
                </Alert>
                <ImportErrors errors={preview.errors} />
              </Box>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={isApplying}>
            Close
          </Button>
          <Button onClick={() => void handlePreview()} disabled={!file || isPreviewing || isApplying}>
            {isPreviewing ? 'Previewing…' : 'Preview'}
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleApply()}
            disabled={!preview?.valid || !request || isPreviewing || isApplying || Boolean(success)}
          >
            {isApplying ? 'Applying…' : 'Apply import'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
