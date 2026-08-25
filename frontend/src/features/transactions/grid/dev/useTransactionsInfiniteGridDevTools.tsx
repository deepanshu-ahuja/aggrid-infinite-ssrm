import { useCallback, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type { TransactionBulkSelection } from '../transactionBulkSelection';
import type { TransactionUpdatePayload } from '../transactionEditing';

interface UseTransactionsInfiniteGridDevToolsOptions {
  /**
   * Production-capable action logic supplied by the grid/feature layer.
   *
   * Dev Tools deliberately do not know how selection is read, how AG Grid filters are obtained, or
   * how backend-facing payloads are built. A future real UI can call these same functions directly.
   */
  buildSelectionPayload: () => TransactionBulkSelection;
  buildSelectedEditPayload: () => TransactionUpdatePayload;

  /** Already-built all-local-edit view owned by the production editing engine. */
  editPayload: TransactionUpdatePayload;
}

/**
 * Development-only Transactions Infinite presentation.
 *
 * OWNERSHIP RULE
 * --------------
 * This hook owns only developer-facing visibility, snapshots and buttons. It must not own reusable
 * algorithms for row selection, edited-row intersection, GridApi reads or bulk-action payloads.
 * Those behaviors belong to production-capable helpers/hooks so the real product UI can reuse them.
 */
export function useTransactionsInfiniteGridDevTools({
  buildSelectionPayload,
  buildSelectedEditPayload,
  editPayload,
}: UseTransactionsInfiniteGridDevToolsOptions) {
  /** Snapshot from the last explicit developer preview action. */
  const [selectionPreview, setSelectionPreview] =
    useState<TransactionBulkSelection>();

  /** Visible payload-building failure; debug presentation only. */
  const [selectionPreviewError, setSelectionPreviewError] = useState<string>();

  /** Snapshot of accumulated edits intersected with current logical selection. */
  const [selectedEditPreview, setSelectedEditPreview] =
    useState<TransactionUpdatePayload>();

  /** Controls developer visibility of the already-owned all-local-edit payload. */
  const [showAllLocalEdits, setShowAllLocalEdits] = useState(false);

  /** Remove stale snapshots when real grid/edit state changes. */
  const clearPreviews = useCallback(() => {
    setSelectionPreview(undefined);
    setSelectionPreviewError(undefined);
    setSelectedEditPreview(undefined);
  }, []);

  const hideAllLocalEdits = useCallback(() => {
    setShowAllLocalEdits(false);
  }, []);

  const showAllLocalEditsPreview = useCallback(() => {
    setShowAllLocalEdits(true);
  }, []);

  const handlePreviewSelectionPayload = useCallback(() => {
    try {
      setSelectionPreview(buildSelectionPayload());
      setSelectionPreviewError(undefined);
    } catch (error) {
      setSelectionPreview(undefined);
      setSelectionPreviewError(
        error instanceof Error
          ? error.message
          : 'The selection payload could not be built.',
      );
    }
  }, [buildSelectionPayload]);

  const handlePreviewSelectedEdits = useCallback(() => {
    setSelectedEditPreview(buildSelectedEditPayload());
  }, [buildSelectedEditPayload]);

  const devToolsUi = import.meta.env.DEV ? (
    <Stack spacing={1.5}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ sm: 'center' }}
      >
        <Button
          variant="outlined"
          size="small"
          onClick={handlePreviewSelectionPayload}
        >
          Preview selection payload
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={handlePreviewSelectedEdits}
        >
          Preview selected edit payload
        </Button>
        <Typography variant="caption" color="text.secondary">
          Development validation only — no backend action is called.
        </Typography>
      </Stack>

      {showAllLocalEdits ? (
        <Box
          component="pre"
          data-testid="all-local-edits-preview"
          sx={{
            m: 0,
            p: 1.5,
            overflowX: 'auto',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.default',
            fontSize: '0.75rem',
          }}
        >
          {JSON.stringify(editPayload, null, 2)}
        </Box>
      ) : null}

      {selectionPreviewError ? (
        <Alert severity="error">{selectionPreviewError}</Alert>
      ) : null}

      {selectionPreview ? (
        <Box
          component="pre"
          data-testid="selection-payload-preview"
          sx={{
            m: 0,
            p: 1.5,
            overflowX: 'auto',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.default',
            fontSize: '0.75rem',
          }}
        >
          {JSON.stringify(selectionPreview, null, 2)}
        </Box>
      ) : null}

      {selectedEditPreview ? (
        <Box
          component="pre"
          data-testid="selected-edit-payload-preview"
          sx={{
            m: 0,
            p: 1.5,
            overflowX: 'auto',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.default',
            fontSize: '0.75rem',
          }}
        >
          {JSON.stringify(selectedEditPreview, null, 2)}
        </Box>
      ) : null}
    </Stack>
  ) : null;

  return {
    clearPreviews,
    hideAllLocalEdits,
    showAllLocalEditsPreview,
    devToolsUi,
  };
}
