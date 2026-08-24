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
 * Chooses the appropriate Infinite selection composition and temporarily exposes a payload-preview
 * action used to validate our selection contract in the browser.
 *
 * WHY THE PREVIEW EXISTS
 * ----------------------
 * We have unit-tested the individual pieces:
 *
 * - include/exclude selection rules;
 * - AG Grid row lifecycle wiring;
 * - backend filter mapping;
 * - generic bulk-selection builder;
 * - Transactions bulk-selection builder.
 *
 * This temporary control validates that those pieces are connected correctly in a real AG Grid
 * interaction before any destructive/real backend bulk endpoint is introduced.
 *
 * Clicking "Preview bulk payload":
 *
 * 1. does NOT call the backend;
 * 2. does NOT change selection;
 * 3. builds exactly the selection/query payload a future action would use;
 * 4. displays it as JSON for manual verification.
 *
 * Once page/filtered/all scenarios have been verified in the browser, this development preview can
 * be removed and the same builder can be called from real actions such as Export/Delete/Approve.
 */
export function TransactionsInfiniteGrid({
  selectionScope,
  gridOptions,
  onSelectionChange,
}: TransactionsInfiniteGridProps) {
  /**
   * Latest logical selection emitted by whichever Infinite strategy is active.
   *
   * This remains only mode + IDs. UI scope is kept separately in `selectionScope`.
   */
  const [selectionIntent, setSelectionIntent] =
    useState<ServerSelectionIntent<string>>(EMPTY_SELECTION);

  /**
   * Latest APPLIED AG Grid column-filter model.
   *
   * `TransactionsInfiniteTable` publishes this from GridApi on grid ready and after applied filter
   * changes. It remains AG Grid state until an action is requested.
   */
  const [filterModel, setFilterModel] = useState<FilterModel>({});

  /** Last payload explicitly requested through the temporary validation button. */
  const [preview, setPreview] = useState<TransactionBulkSelection>();

  /** Readable error if an impossible/inconsistent selection state reaches the preview builder. */
  const [previewError, setPreviewError] = useState<string>();

  /**
   * Captures logical selection and forwards it to any feature consumer.
   *
   * A previously displayed preview is cleared because it describes the selection as it existed at
   * the moment the button was clicked; leaving it visible after selection changes would look like
   * live state when it is actually a snapshot.
   */
  const handleSelectionChange = useCallback(
    (nextSelection: ServerSelectionIntent<string>) => {
      setSelectionIntent(nextSelection);
      setPreview(undefined);
      setPreviewError(undefined);
      onSelectionChange?.(nextSelection);
    },
    [onSelectionChange],
  );

  /**
   * Captures AG Grid's current APPLIED filter model.
   *
   * Again, clear an old preview so the displayed JSON can never be mistaken for the current query
   * after the user changes filters.
   */
  const handleFilterModelChange = useCallback((nextFilterModel: FilterModel) => {
    setFilterModel(nextFilterModel);
    setPreview(undefined);
    setPreviewError(undefined);
  }, []);

  /**
   * Builds the backend-ready selection payload only when the user explicitly clicks the validation
   * button.
   *
   * This mirrors how a real bulk action will work later.
   */
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
      /**
       * `page + exclude` should be impossible. Displaying the error in this temporary validation
       * panel makes an inconsistent state obvious during manual testing instead of silently treating
       * it as an all-record action.
       */
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
      {/*
       * TEMPORARY DEVELOPMENT VALIDATION CONTROL
       * ----------------------------------------
       * This is intentionally visible while Infinite selection is being verified end-to-end.
       * Remove this panel after all documented page/filtered/all scenarios have been checked.
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
          Validation only — this does not call a backend bulk-action endpoint.
        </Typography>
      </Stack>

      {previewError ? (
        <Alert severity="error">{previewError}</Alert>
      ) : null}

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

      {grid}
    </Stack>
  );
}