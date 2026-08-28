import { Alert, Button, Stack, Typography } from '@mui/material';

interface TransactionExportActionsProps {
  hasSelection: boolean;
  isExportingSelected: boolean;
  error?: string;
  onExportCurrentPage: () => void;
  onExportSelected: () => void;
}

/** Transactions export presentation; row-model roots own the actual GridApi/selection semantics. */
export function TransactionExportActions({
  hasSelection,
  isExportingSelected,
  error,
  onExportCurrentPage,
  onExportSelected,
}: TransactionExportActionsProps) {
  return (
    <Stack spacing={1}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
        <Typography variant="body2">Export</Typography>
        <Button size="small" variant="outlined" onClick={onExportCurrentPage}>
          Export current page
        </Button>
        <Button
          size="small"
          variant="outlined"
          disabled={!hasSelection || isExportingSelected}
          onClick={onExportSelected}
        >
          {isExportingSelected ? 'Exporting…' : 'Export selected'}
        </Button>
      </Stack>
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
