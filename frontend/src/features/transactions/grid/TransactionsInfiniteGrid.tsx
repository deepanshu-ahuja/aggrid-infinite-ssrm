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
   *
   * - `page`: add/remove IDs on the current pagination page;
   * - `filtered`: Select All represents every backend row matching the active filter;
   * - `all`: Select All represents every backend row in the complete dataset.
   */
  selectionScope: InfiniteSelectionMode;

  /** Native AG Grid options for this Transactions Infinite grid. */
  gridOptions: TransactionsInfiniteGridOptions;

  /**
   * Accumulated local edits are supplied only so this row-model owner can combine them with its
   * logical selection for the DEVELOPMENT bulk-edit preview.
   *
   * The editing engine itself remains outside the Infinite grid; this component does not mutate or
   * own those edits.
   */
  editingState?: TransactionEditingState;

  /** Emits the current logical selection when another feature consumer needs it. */
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
}

/** include + [] = no explicitly selected IDs. */
const EMPTY_SELECTION: ServerSelectionIntent<string> = {
  mode: 'include',
  ids: [],
};

/**
 * Chooses the appropriate Infinite selection composition and owns development previews that require
 * knowledge of Infinite's logical include/exclude selection.
 *
 * NATIVE-FIRST STATE RULE
 * -----------------------
 * This component must not create React state merely because AG Grid exposes a value. In particular,
 * the applied filter model remains AG Grid-owned. We keep only a ref to the latest model published
 * by the table because the development action builder needs to read it later; changing that ref does
 * not cause a render and therefore does not create a second UI state machine for filters.
 *
 * React state below is limited to application meaning AG Grid cannot represent (logical dataset-wide
 * Infinite selection) and development preview UI that AG Grid does not own.
 *
 * TWO DIFFERENT PREVIEWS
 * ----------------------
 * `Preview selection payload`
 *     validates a future generic selection-based backend action such as Export/Delete/Approve.
 *
 * `Preview selected edit payload`
 *     validates a future Bulk Update API. It intersects accumulated concrete edits with the current
 *     logical selection, so selection by itself never manufactures row updates.
 */
export function TransactionsInfiniteGrid({
  selectionScope,
  gridOptions,
  editingState,
  onSelectionChange,
}: TransactionsInfiniteGridProps) {
  /**
   * Application-owned logical Infinite selection.
   *
   * Infinite Row Model has native per-row selection but no native Select All across unloaded rows.
   * This logical snapshot is therefore needed while the custom Infinite selection strategies are
   * active. A later native-selection cleanup can reduce include-mode duplication further without
   * changing the backend `mode + ids` contract.
   */
  const [selectionIntent, setSelectionIntent] =
    useState<ServerSelectionIntent<string>>(EMPTY_SELECTION);

  /**
   * NOT React state: AG Grid owns filtering.
   *
   * The child table publishes `api.getFilterModel()` after AG Grid applies a filter. We retain only
   * the latest value for the explicit preview/action builder. A ref is enough because no UI renders
   * directly from this model.
   */
  const filterModelRef = useRef<FilterModel>({});

  /** Generic selection-action preview. This is our development UI, not AG Grid state. */
  const [selectionPreview, setSelectionPreview] =
    useState<TransactionBulkSelection>();
  const [selectionPreviewError, setSelectionPreviewError] = useState<string>();

  /** Future Bulk Update preview: edited rows ∩ current logical selection. */
  const [selectedEditPreview, setSelectedEditPreview] =
    useState<TransactionUpdatePayload>();

  const handleSelectionChange = useCallback(
    (nextSelection: ServerSelectionIntent<string>) => {
      setSelectionIntent(nextSelection);
      setSelectionPreview(undefined);
      setSelectionPreviewError(undefined);
      setSelectedEditPreview(undefined);
      onSelectionChange?.(nextSelection);
    },
    [onSelectionChange],
  );

  const handleFilterModelChange = useCallback((nextFilterModel: FilterModel) => {
    /**
     * Do not mirror AG Grid filter state with `useState`. The model is needed only when a user later
     * asks us to construct a filtered backend action payload.
     */
    filterModelRef.current = nextFilterModel;
    setSelectionPreview(undefined);
    setSelectionPreviewError(undefined);
  }, []);

  /**
   * Existing generic selection preview. This answers "what logical rows are selected?" and is NOT
   * the same contract as backend editing.
   */
  const handlePreviewSelectionPayload = useCallback(() => {
    try {
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
  }, [selectionIntent, selectionScope]);

  /**
   * Future BACKEND BULK-EDIT preview.
   *
   * Examples:
   * - selected row, never edited -> omitted;
   * - edited row, not selected -> omitted;
   * - row edited on Page 5 and still logically selected -> included even after leaving Page 5;
   * - exclude selection -> every edited ID is tested against the exception list.
   */
  const handlePreviewSelectedEdits = useCallback(() => {
    if (!editingState) return;

    setSelectedEditPreview(
      buildSelectedTransactionUpdatePayload(editingState, selectionIntent),
    );
  }, [editingState, selectionIntent]);

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
