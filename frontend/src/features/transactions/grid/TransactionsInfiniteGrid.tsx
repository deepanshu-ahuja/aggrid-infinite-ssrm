import { useCallback, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type { FilterModel } from 'ag-grid-community';
import type {
  InfiniteSelectionMode,
  ServerSelectionIntent,
} from '@/shared/grid/selection/serverSelection';
import type { TransactionsInfiniteGridOptions } from '../transactionsGrid.config';
import {
  buildTransactionBulkSelection,
  type TransactionBulkSelection,
} from './transactionBulkSelection';
import {
  buildSelectedTransactionUpdatePayload,
  type TransactionEditingState,
  type TransactionUpdatePayload,
} from './transactionEditing';
import { TransactionsInfiniteDatasetGrid } from './TransactionsInfiniteDatasetGrid';
import { TransactionsInfinitePageGrid } from './TransactionsInfinitePageGrid';

export interface TransactionsInfiniteGridProps {
  /**
   * Chooses what the custom Infinite header checkbox means:
   * - `page`: native row selection; header acts on current-page RowNodes;
   * - `filtered`: custom dataset Select All represents active backend filter;
   * - `all`: custom dataset Select All represents the complete backend dataset.
   */
  selectionScope: InfiniteSelectionMode;

  /** Native AG Grid options for this Transactions Infinite grid. */
  gridOptions: TransactionsInfiniteGridOptions;

  /** Accumulated local edits used only by the development selected-edit payload preview. */
  editingState?: TransactionEditingState;

  /** Emits the current logical selection when another feature consumer needs it. */
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
}

const EMPTY_SELECTION: ServerSelectionIntent<string> = {
  mode: 'include',
  ids: [],
};

/**
 * Routes to the appropriate Infinite selection composition and owns development action previews.
 *
 * NATIVE-FIRST STATE RULE
 * -----------------------
 * This router does NOT own grid selection or filtering:
 *
 * - page/manual selected IDs are AG Grid-owned;
 * - dataset-wide Infinite Select All is owned by the dedicated dataset strategy because AG Grid
 *   cannot represent unloaded all/filtered selection;
 * - the filter model is AG Grid-owned.
 *
 * `selectionIntentRef` and `filterModelRef` are action-time snapshots only. They are refs, not React
 * state, because rendering this router does not depend on their values. The only React state here is
 * development preview/error UI that AG Grid has no concept of.
 */
export function TransactionsInfiniteGrid({
  selectionScope,
  gridOptions,
  editingState,
  onSelectionChange,
}: TransactionsInfiniteGridProps) {
  const selectionIntentRef =
    useRef<ServerSelectionIntent<string>>(EMPTY_SELECTION);
  const filterModelRef = useRef<FilterModel>({});

  /** Generic selection-action preview. This is development UI, not grid state. */
  const [selectionPreview, setSelectionPreview] =
    useState<TransactionBulkSelection>();
  const [selectionPreviewError, setSelectionPreviewError] = useState<string>();

  /** Future Bulk Update preview: accumulated edited rows ∩ current logical selection. */
  const [selectedEditPreview, setSelectedEditPreview] =
    useState<TransactionUpdatePayload>();

  const handleSelectionChange = useCallback(
    (nextSelection: ServerSelectionIntent<string>) => {
      /**
       * Do not mirror selection into React render state. The concrete Infinite strategy remains its
       * source of truth; this ref is only the latest JSON-safe snapshot for explicit actions.
       */
      selectionIntentRef.current = nextSelection;

      /** Any displayed preview is now stale, so only the preview UI needs a React update. */
      setSelectionPreview(undefined);
      setSelectionPreviewError(undefined);
      setSelectedEditPreview(undefined);
      onSelectionChange?.(nextSelection);
    },
    [onSelectionChange],
  );

  const handleFilterModelChange = useCallback((nextFilterModel: FilterModel) => {
    /** AG Grid owns filtering; retain only the latest action-time snapshot. */
    filterModelRef.current = nextFilterModel;
    setSelectionPreview(undefined);
    setSelectionPreviewError(undefined);
  }, []);

  /**
   * Development generic selection preview: answers "what logical rows would a selection-based
   * backend action target?". This is different from editing.
   */
  const handlePreviewSelectionPayload = useCallback(() => {
    try {
      const selectionIntent = selectionIntentRef.current;
      const nextPreview =
        selectionScope === 'filtered'
          ? buildTransactionBulkSelection(selectionIntent, {
              selectionScope: 'filtered',
              filterModel: filterModelRef.current,
            })
          : buildTransactionBulkSelection(selectionIntent, {
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
  }, [selectionScope]);

  /**
   * Development BACKEND BULK-EDIT preview.
   *
   * selected but never edited -> omitted
   * edited but not selected   -> omitted
   * edited + selected         -> included
   *
   * An edited+selected row remains eligible after navigating away because both contracts use stable
   * backend IDs rather than current RowNodes.
   */
  const handlePreviewSelectedEdits = useCallback(() => {
    if (!editingState) return;

    setSelectedEditPreview(
      buildSelectedTransactionUpdatePayload(
        editingState,
        selectionIntentRef.current,
      ),
    );
  }, [editingState]);

  const grid =
    selectionScope === 'page' ? (
      <TransactionsInfinitePageGrid
        gridOptions={gridOptions}
        onSelectionChange={handleSelectionChange}
        onFilterModelChange={handleFilterModelChange}
      />
    ) : (
      <TransactionsInfiniteDatasetGrid
        selectionScope={selectionScope}
        gridOptions={gridOptions}
        onSelectionChange={handleSelectionChange}
        onFilterModelChange={handleFilterModelChange}
      />
    );

  return (
    <Stack spacing={1.5}>
      {import.meta.env.DEV ? (
        <>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', sm: 'center' }}
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
              disabled={!editingState}
              onClick={handlePreviewSelectedEdits}
            >
              Preview selected edit payload
            </Button>

            <Typography variant="caption" color="text.secondary">
              Development validation only — no backend action is called.
            </Typography>
          </Stack>

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
        </>
      ) : null}

      {grid}
    </Stack>
  );
}
