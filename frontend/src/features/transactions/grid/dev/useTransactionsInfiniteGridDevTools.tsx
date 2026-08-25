import { useCallback, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type { GridApi } from 'ag-grid-community';
import type { Transaction } from '../../api/transactions.contracts';
import type {
  InfiniteSelectionMode,
  ServerSelectionIntent,
} from '@/shared/grid/selection/serverSelection';
import {
  buildTransactionBulkSelection,
  type TransactionBulkSelection,
} from '../transactionBulkSelection';
import {
  buildSelectedTransactionUpdatePayload,
  type TransactionEditState,
  type TransactionUpdatePayload,
} from '../transactionEditing';

interface UseTransactionsInfiniteGridDevToolsOptions {
  /** Current Infinite selection semantics used to build the preview payload. */
  selectionScope: InfiniteSelectionMode;

  /**
   * Returns the grid's one authoritative API instance.
   *
   * The hook intentionally reads native filter state only when the developer clicks Preview rather
   * than mirroring AG Grid state into React solely for debugging.
   */
  getGridApi: () => GridApi<Transaction> | null;

  /** Reads the application's current logical selection at action time. */
  readLogicalSelection: () => ServerSelectionIntent<string>;

  /** Current accumulated edit state used by the selected-edit preview. */
  editState: TransactionEditState;

  /** Current accumulated backend-ready edit payload used by the all-edits preview. */
  editPayload: TransactionUpdatePayload;
}

/**
 * Development-only Transactions Infinite diagnostics.
 *
 * WHY THIS IS A HOOK
 * ------------------
 * These previews are runtime developer instrumentation, not production grid behavior. Keeping their
 * state, payload-building callbacks and UI behind one integration point means they can be removed
 * without touching AG Grid lifecycle, selection or editing logic.
 *
 * Production behavior must never depend on any state owned here. The caller may notify this hook
 * that a real selection/filter/edit action happened so stale previews can be cleared, but the hook
 * never drives those actions itself.
 */
export function useTransactionsInfiniteGridDevTools({
  selectionScope,
  getGridApi,
  readLogicalSelection,
  editState,
  editPayload,
}: UseTransactionsInfiniteGridDevToolsOptions) {
  /**
   * Snapshot produced by the last explicit "Preview selection payload" click.
   *
   * React state is appropriate because rendering/removing the JSON preview must update the UI. It is
   * deliberately not kept live with selection changes; `clearPreviews` removes stale snapshots.
   */
  const [selectionPreview, setSelectionPreview] =
    useState<TransactionBulkSelection>();

  /** Visible validation failure from building the selection preview. */
  const [selectionPreviewError, setSelectionPreviewError] = useState<string>();

  /** Visible snapshot of edits restricted to the current logical selection. */
  const [selectedEditPreview, setSelectedEditPreview] =
    useState<TransactionUpdatePayload>();

  /**
   * Controls whether the already-owned edit payload is rendered for developer inspection.
   *
   * This stores only presentation visibility; the edit data itself remains owned by the production
   * editing hook.
   */
  const [showAllLocalEdits, setShowAllLocalEdits] = useState(false);

  /** Remove snapshots whenever real grid/edit state changes so debug JSON cannot look authoritative. */
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
    const api = getGridApi();
    if (!api) return;

    try {
      const selection = readLogicalSelection();
      const nextPreview =
        selectionScope === 'filtered'
          ? buildTransactionBulkSelection(selection, {
              selectionScope: 'filtered',
              filterModel: api.getFilterModel(),
            })
          : buildTransactionBulkSelection(selection, {
              selectionScope,
            });

      setSelectionPreview(nextPreview);
      setSelectionPreviewError(undefined);
    } catch (error) {
      setSelectionPreview(undefined);
      setSelectionPreviewError(
        error instanceof Error
          ? error.message
          : 'The selection payload could not be built.',
      );
    }
  }, [getGridApi, readLogicalSelection, selectionScope]);

  const handlePreviewSelectedEdits = useCallback(() => {
    setSelectedEditPreview(
      buildSelectedTransactionUpdatePayload(editState, readLogicalSelection()),
    );
  }, [editState, readLogicalSelection]);

  /**
   * Vite removes this branch from the production experience. All debug presentation stays here so
   * the main grid component has one obvious dev-only integration point.
   */
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
