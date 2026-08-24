import { useCallback, useState } from 'react';
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
import { TransactionsInfiniteDatasetGrid } from './TransactionsInfiniteDatasetGrid';
import { TransactionsInfinitePageGrid } from './TransactionsInfinitePageGrid';

export interface TransactionsInfiniteGridProps {
  /**
   * Chooses what the custom Infinite header checkbox means:
   *
   * - `page`: add/remove IDs on the current pagination page;
   * - `filtered`: Select All represents every backend row matching the active filter;
   * - `all`: Select All represents every backend row in the complete dataset.
   *
   * IMPORTANT:
   * This is UI/lifecycle configuration only.
   *
   * It is intentionally NOT copied into the emitted logical selection.
   */
  selectionScope: InfiniteSelectionMode;

  /** Native AG Grid options for this Transactions Infinite grid. */
  gridOptions: TransactionsInfiniteGridOptions;

  /**
   * Receives the current logical selection in JSON-safe form:
   *
   *     { mode: 'include' | 'exclude', ids: [...] }
   *
   * There is deliberately no `scope` property.
   *
   * This callback still does NOT perform a backend bulk action.
   */
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
}

/**
 * Initial logical selection before the user checks any row.
 *
 * Keeping this as a module constant makes the "nothing selected" state explicit:
 *
 *     include + [] = select no exact IDs
 */
const EMPTY_SELECTION: ServerSelectionIntent<string> = {
  mode: 'include',
  ids: [],
};

/**
 * Chooses the appropriate Infinite selection composition and keeps a development-only payload
 * preview available for debugging the backend-facing selection contract.
 *
 * The preview is intentionally guarded by `import.meta.env.DEV`: production builds must not expose
 * internal validation controls, while developers can still inspect the exact payload until real
 * bulk actions such as Export/Delete/Approve provide their own network request to inspect.
 */
export function TransactionsInfiniteGrid({
  selectionScope,
  gridOptions,
  onSelectionChange,
}: TransactionsInfiniteGridProps) {
  /** Latest logical selection emitted by whichever Infinite strategy is active. */
  const [selectionIntent, setSelectionIntent] =
    useState<ServerSelectionIntent<string>>(EMPTY_SELECTION);

  /** Latest APPLIED AG Grid column-filter model, needed for filtered bulk-selection context. */
  const [filterModel, setFilterModel] = useState<FilterModel>({});

  /** Development-only validation snapshot. */
  const [preview, setPreview] = useState<TransactionBulkSelection>();
  const [previewError, setPreviewError] = useState<string>();

  const handleSelectionChange = useCallback(
    (nextSelection: ServerSelectionIntent<string>) => {
      setSelectionIntent(nextSelection);
      setPreview(undefined);
      setPreviewError(undefined);
      onSelectionChange?.(nextSelection);
    },
    [onSelectionChange],
  );

  const handleFilterModelChange = useCallback((nextFilterModel: FilterModel) => {
    setFilterModel(nextFilterModel);
    setPreview(undefined);
    setPreviewError(undefined);
  }, []);

  /** Builds the same backend-facing selection/query payload a future explicit bulk action will use. */
  const handlePreviewPayload = useCallback(() => {
    try {
      const nextPreview =
        selectionScope === 'filtered'
          ? buildTransactionBulkSelection(selectionIntent, {
              selectionScope: 'filtered',
              filterModel,
            })
          : buildTransactionBulkSelection(selectionIntent, {
              selectionScope,
            });

      setPreview(nextPreview);
      setPreviewError(undefined);
    } catch (error) {
      setPreview(undefined);
      setPreviewError(
        error instanceof Error
          ? error.message
          : 'The selection payload could not be built.',
      );
    }
  }, [filterModel, selectionIntent, selectionScope]);

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
          {/*
           * DEVELOPMENT-ONLY VALIDATION CONTROL
           * -----------------------------------
           * Vite replaces `import.meta.env.DEV` at build time, so this block is excluded from the
           * production user experience while remaining available during local development.
           */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <Button variant="outlined" size="small" onClick={handlePreviewPayload}>
              Preview bulk payload
            </Button>

            <Typography variant="caption" color="text.secondary">
              Development validation only — no bulk backend endpoint is called.
            </Typography>
          </Stack>

          {previewError ? <Alert severity="error">{previewError}</Alert> : null}

          {preview ? (
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
              {JSON.stringify(preview, null, 2)}
            </Box>
          ) : null}
        </>
      ) : null}

      {grid}
    </Stack>
  );
}
