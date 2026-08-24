import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Stack } from '@mui/material';
import type {
  FilterModel,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  RowSelectedEvent,
  SelectionColumnDef,
} from 'ag-grid-community';
import { AppGrid } from '@/shared/grid/AppGrid';
import { createInfiniteDatasource } from '@/shared/grid/data/infinite/createInfiniteDatasource';
import { GridErrorOverlay } from '@/shared/grid/overlays/GridErrorOverlay';
import type { InfiniteSelectionController } from '@/shared/grid/selection/infinite/infiniteSelection.types';
import { SelectionHeaderCheckbox } from '@/shared/grid/selection/SelectionHeaderCheckbox';
import { listTransactions } from '../api/transactions.api';
import type { Transaction } from '../api/transactions.contracts';
import type { TransactionsInfiniteGridOptions } from '../transactionsGrid.config';
import { mapTransactionGridRequest } from './transactionRequest.mapper';
import { transactionColumns } from './transactionColumns';

/**
 * Supplies AG Grid with a stable identity for every Transaction row.
 *
 * Infinite Row Model only keeps part of the server dataset in browser memory. When blocks are
 * reloaded because of pagination, sorting, filtering, or cache eviction, AG Grid needs a stable ID
 * to recognise the same logical row again.
 *
 * The backend Transaction `id` is therefore the correct identity. Do not use `rowIndex`: row
 * positions can change when the server query changes.
 */
const getRowId = ({ data }: GetRowIdParams<Transaction>) => data.id;

interface TransactionsInfiniteTableProps {
  /** Native AG Grid options selected by the Transactions feature configuration. */
  gridOptions: TransactionsInfiniteGridOptions;

  /**
   * Shared Infinite-selection strategy composed by the parent.
   *
   * This table does not decide whether Select All represents the current page, the filtered
   * dataset, or the complete dataset. It only connects the strategy to AG Grid's row/event APIs.
   */
  selection: InfiniteSelectionController;

  /**
   * Error produced by selection-specific supporting data rather than by the grid datasource.
   *
   * Example: "select all records" may need a separate unfiltered total-count request. If that
   * request fails, the table rows themselves may still be usable, so this must NOT be presented as
   * a grid-load failure.
   */
  selectionError?: string;

  /**
   * Receives the IDs currently available on the visible pagination page.
   *
   * Used only by current-page selection. Infinite Row Model does not keep the full server dataset
   * in browser memory.
   */
  onCurrentPageIdsChange?: (ids: readonly string[]) => void;

  /**
   * Receives the backend total for the current grid query.
   *
   * Filtered-dataset selection uses this total to calculate header checkbox state even though most
   * matching rows may not be loaded in the browser.
   */
  onFilteredTotalChange?: (total: number) => void;

  /**
   * Publishes AG Grid's CURRENT APPLIED column-filter model.
   *
   * This callback exists for a later user action such as Export/Delete/Approve that needs to build
   * a backend payload for "Select All Filtered".
   *
   * Important:
   * - changing a filter does NOT execute a bulk backend action;
   * - AG Grid remains the owner of the filter model;
   * - this table only exposes the applied model upward so feature code can use it at action time.
   */
  onFilterModelChange?: (filterModel: FilterModel) => void;
}

/**
 * Reads the IDs of loaded rows that belong to AG Grid's currently visible pagination page.
 *
 * Important Infinite Row Model detail:
 * `api.forEachNode()` can only visit rows AG Grid currently has in its browser-side cache. It does
 * not materialise every server record. This helper therefore deliberately works with *loaded*
 * rows and should not be interpreted as "all server IDs on this page" independently of the cache.
 *
 * We keep this helper local for now because current-page selection semantics are still under review.
 * Once those semantics are confirmed, we can decide whether this is genuinely a reusable grid
 * primitive.
 */
function getCurrentPageIds(api: GridApi<Transaction> | null) {
  if (!api) return [];

  const pageSize = api.paginationGetPageSize();
  const firstRow = api.paginationGetCurrentPage() * pageSize;
  const rowAfterPage = firstRow + pageSize;
  const rows: Array<{ index: number; id: string }> = [];

  api.forEachNode((node) => {
    if (
      node.data &&
      node.rowIndex !== null &&
      node.rowIndex >= firstRow &&
      node.rowIndex < rowAfterPage
    ) {
      rows.push({ index: node.rowIndex, id: node.data.id });
    }
  });

  return rows.sort((left, right) => left.index - right.index).map(({ id }) => id);
}

/**
 * Renders the Transactions implementation backed by AG Grid's Infinite Row Model.
 *
 * RESPONSIBILITIES
 * ----------------
 * This component owns:
 * - connecting AG Grid's Infinite datasource to the Transactions API;
 * - translating AG Grid lifecycle/events into the shared Infinite-selection strategy;
 * - synchronising loaded AG Grid RowNodes with application selection state;
 * - presenting datasource failures inside the grid surface;
 * - forwarding page IDs / filtered totals required by the selected selection strategy.
 *
 * It deliberately does NOT own:
 * - the meaning of page / filtered / all selection;
 * - the generic Infinite datasource implementation;
 * - backend query syntax;
 * - shared grid defaults;
 * - Transaction column definitions.
 *
 * Keeping those boundaries visible is important: a developer should still be able to follow AG
 * Grid's native lifecycle rather than having it hidden behind a large application wrapper.
 */
export function TransactionsInfiniteTable({
  gridOptions,
  selection,
  selectionError,
  onCurrentPageIdsChange,
  onFilteredTotalChange,
  onFilterModelChange,
}: TransactionsInfiniteTableProps) {
  /**
   * AG Grid exposes its imperative API after `onGridReady`.
   *
   * A ref is appropriate because changing the API reference should not itself cause a React render.
   * We use the API for grid-owned operations such as iterating loaded nodes, refreshing the
   * selection header, reading pagination state, and retrying Infinite cache loads.
   */
  const gridApi = useRef<GridApi<Transaction> | null>(null);

  /**
   * Datasource/network failure shown through AG Grid's Active Overlay.
   *
   * This is intentionally separate from `selectionError`. A datasource error means row loading
   * failed; a selection supporting request can fail while the grid rows remain usable.
   */
  const [loadError, setLoadError] = useState<string>();

  const {
    headerState,
    headerLabel,
    isRowSelected,
    setRowSelected,
    setHeaderSelected,
    onFilterChanged,
  } = selection;

  /**
   * Feature-specific row loader passed to the shared Infinite datasource adapter.
   *
   * The shared datasource speaks in a small AG-Grid-like block request. This function is the
   * feature boundary that:
   *
   * 1. maps that request into our backend query contract;
   * 2. calls the Transactions endpoint;
   * 3. returns `{ rows, totalCount }` to the shared datasource.
   *
   * The shared datasource gives `totalCount` to AG Grid as Infinite Row Model's last-row value.
   * Filtered-selection totals are then read from AG Grid's accepted CURRENT model rather than being
   * written directly from this asynchronous request.
   *
   * The AbortSignal is created/owned by the shared datasource so obsolete requests can be cancelled
   * when the datasource is destroyed.
   */
  const loadRows = useCallback(
    async (
      request: Parameters<typeof mapTransactionGridRequest>[0],
      context: { signal: AbortSignal },
    ) => {
      const result = await listTransactions(
        mapTransactionGridRequest(request),
        context.signal,
      );

      /**
       * A successful datasource response clears a previous datasource error.
       *
       * We clear on success rather than treating "a new request started" as success. That prevents
       * the error state from disappearing before the retry has actually recovered.
       *
       * Notice that we intentionally do NOT update `filteredTotal` from this async callback.
       * Multiple Infinite block requests can overlap. Publishing application state directly from
       * whichever request finishes last can make an older request overwrite newer filter state.
       *
       * Instead, `updateAfterRowsChange()` reads the row count from AG Grid's CURRENT Infinite model
       * after AG Grid has accepted the datasource result.
       */
      setLoadError(undefined);

      return result;
    },
    [],
  );

  /**
   * AG Grid Infinite datasource.
   *
   * `useMemo` is important. Recreating the datasource on an ordinary React render would give AG
   * Grid a new datasource identity, which can reset/discard its browser-side block cache and cause
   * unnecessary backend requests.
   *
   * The datasource itself calls AG Grid's `successCallback` / `failCallback`. `onError` is only the
   * application-facing notification used to present a readable failure message.
   */
  const datasource = useMemo(
    () =>
      createInfiniteDatasource<Transaction>({
        loadRows,
        onError: () => {
          setLoadError('Rows could not be loaded. Please retry.');
        },
      }),
    [loadRows],
  );

  /**
   * Synchronises AG Grid's checkboxes for rows currently loaded in browser memory with the
   * application selection controller.
   *
   * This is necessary because dataset-level selection can represent unloaded rows. React selection
   * state may therefore change independently from AG Grid's currently materialised RowNodes.
   */
  const syncLoadedCheckboxes = useCallback(() => {
    gridApi.current?.forEachNode((node) => {
      if (!node.data) return;

      const shouldBeChecked = isRowSelected(node.data.id);

      if (node.isSelected() !== shouldBeChecked) {
        /**
         * Mark the selection change as API-driven.
         *
         * `handleRowSelected` ignores events whose source is `api`. Without this distinction we
         * could create a feedback loop:
         *
         * application selection
         *   → update AG Grid checkbox
         *   → AG Grid fires rowSelected
         *   → write the same change back into application selection.
         */
        node.setSelected(shouldBeChecked, false, 'api');
      }
    });
  }, [isRowSelected]);

  /**
   * Runs after AG Grid's loaded/displayed rows may have changed.
   *
   * Two consumers need to be refreshed:
   * - current-page selection needs the IDs on the visible page;
   * - loaded checkboxes need to reflect application selection state.
   */
  const updateAfterRowsChange = useCallback(() => {
    const api = gridApi.current;

    if (!api) return;

    onCurrentPageIdsChange?.(getCurrentPageIds(api));

    /**
     * Publish the total from AG Grid's CURRENT Infinite row model rather than directly from an
     * asynchronous backend request.
     *
     * The datasource passes the backend `totalCount` to AG Grid as Infinite Row Model's `lastRow`.
     * Once AG Grid knows the last row index, `getDisplayedRowCount()` represents the current
     * server-query dataset size.
     *
     * Why this is safer than updating React state inside `loadRows()`:
     *
     * - several block requests can overlap;
     * - a request for an older filter can finish after a newer request;
     * - AG Grid owns which datasource result belongs to its current cache/model;
     * - `onModelUpdated` runs against that current accepted model.
     *
     * `isLastRowIndexKnown()` prevents us from treating AG Grid's temporary/estimated Infinite row
     * count as an authoritative backend total before the datasource has supplied the real count.
     */
    if (onFilteredTotalChange && api.isLastRowIndexKnown()) {
      onFilteredTotalChange(api.getDisplayedRowCount());
    }

    syncLoadedCheckboxes();
  }, [onCurrentPageIdsChange, onFilteredTotalChange, syncLoadedCheckboxes]);

  /**
   * Customises AG Grid's dedicated selection column.
   *
   * Infinite Row Model cannot use AG Grid's normal header Select-All checkbox to represent
   * application concepts such as all filtered/unloaded server rows, so the standard header
   * checkbox is disabled below and our shared Infinite selection strategy supplies this header.
   */
  const selectionColumnDef = useMemo<SelectionColumnDef>(
    () => ({
      width: 52,
      minWidth: 52,
      maxWidth: 52,
      resizable: false,
      sortable: false,
      headerComponent: SelectionHeaderCheckbox,
      headerComponentParams: {
        ...headerState,
        label: headerLabel,
        onChange: setHeaderSelected,
      },
    }),
    [headerLabel, headerState, setHeaderSelected],
  );

  useEffect(() => {
    /**
     * Selection state can change without AG Grid creating/replacing RowNodes.
     *
     * Update already-loaded checkboxes and force AG Grid to recreate/refresh the custom selection
     * header so it receives the latest `headerState` / `headerLabel` parameters.
     */
    syncLoadedCheckboxes();
    gridApi.current?.refreshHeader();
  }, [selectionColumnDef, syncLoadedCheckboxes]);

  /**
   * AG Grid lifecycle callback fired after the grid has been initialised and its `GridApi` exists.
   *
   * We store the API for later imperative grid operations. The zero-delay task gives AG Grid an
   * opportunity to create its initial RowNodes before page IDs / checkbox state are inspected.
   */
  const handleGridReady = useCallback(
    (event: GridReadyEvent<Transaction>) => {
      gridApi.current = event.api;

      /**
       * Publish the initial applied filter model as soon as GridApi exists.
       *
       * Today the grid normally starts with no filters, but using `getFilterModel()` here also keeps
       * this correct if initial/persisted AG Grid filter state is introduced later.
       */
      onFilterModelChange?.(event.api.getFilterModel());

      window.setTimeout(updateAfterRowsChange, 0);
    },
    [onFilterModelChange, updateAfterRowsChange],
  );

  /**
   * Handles a user-originated AG Grid row selection event.
   *
   * Events produced by `syncLoadedCheckboxes()` use source `api` and are deliberately ignored so
   * automatic visual synchronisation is not mistaken for a new user decision.
   */
  const handleRowSelected = useCallback(
    (event: RowSelectedEvent<Transaction>) => {
      if (event.source === 'api' || !event.data) return;

      setRowSelected(event.data.id, event.node.isSelected() === true);
    },
    [setRowSelected],
  );

  /**
   * Handles an AG Grid FILTER change.
   *
   * The table deliberately does not decide whether filtering invalidates selection. That semantic
   * belongs to the selected strategy:
   *
   * - page: no handler → preserve explicit selected IDs;
   * - all: no handler → "all records" is independent of the visible filter;
   * - filtered: the strategy itself decides from include/exclude state:
   *     - include  → preserve explicit selected IDs;
   *     - exclude  → clear because Select All Filtered belonged to the old query.
   *
   * We also clear a previous datasource error because applying a new filter causes AG Grid to issue
   * a new server query. If that query fails, the datasource will restore the error overlay.
   */
  const handleFilterChanged = useCallback(() => {
    /**
     * The previous filtered total describes the OLD query. Clear it immediately while AG Grid
     * resets/reloads its Infinite cache for the new filter.
     *
     * The authoritative new total will be published from `updateAfterRowsChange()` after AG Grid has
     * accepted a datasource result and knows the new last-row index.
     */
    onFilteredTotalChange?.(0);

    setLoadError(undefined);

    /**
     * Capture AG Grid's APPLIED filter model for a future action button.
     *
     * AG Grid documents `getFilterModel()` as the API for reading the current state of all column
     * filters. We read it only after the filter-changed lifecycle fires, so the feature receives
     * the model that AG Grid has actually applied.
     */
    onFilterModelChange?.(gridApi.current?.getFilterModel() ?? {});

    /**
     * Selection semantics remain strategy-owned:
     * - explicit/current-page selection: no handler, preserve selected IDs;
     * - all-records selection: no handler, preserve the all-records intent;
     * - filtered selection: the strategy preserves include and clears only exclude.
     */
    onFilterChanged?.();
  }, [onFilterChanged, onFilterModelChange, onFilteredTotalChange]);

  /**
   * There is intentionally NO `onSortChanged` selection handler.
   *
   * Sorting changes row order, not row identity or dataset membership. With a stable `getRowId`,
   * selection should survive a sort. Clearing selection here would throw away valid user state and
   * fight AG Grid's stable-row-ID behaviour.
   */

  /**
   * Retries an Infinite Row Model datasource failure using AG Grid's own cache API.
   *
   * Unlike SSRM, Infinite Row Model does not expose `retryServerSideLoads()`. Its native recovery
   * mechanism is cache refresh/purge. `refreshInfiniteCache()` marks cached blocks for reload while
   * keeping existing successful rows visible until replacements arrive, so it is less destructive
   * than purging the entire cache.
   *
   * The overlay is cleared before retry so AG Grid can render the rows/loading state while the
   * request is in flight. If the request fails again, the datasource's `onError` callback restores
   * the error overlay.
   */
  const handleRetryLoad = useCallback(() => {
    setLoadError(undefined);
    gridApi.current?.refreshInfiniteCache();
  }, []);

  return (
    <Stack spacing={1.5}>
      {/*
       * This is intentionally NOT the datasource error.
       *
       * `selectionError` belongs to supporting selection logic (for example an unfiltered total
       * count request). The table data may still be fully usable, so blocking the grid with an
       * Active Overlay would misrepresent the failure.
       */}
      {selectionError && <Alert severity="error">{selectionError}</Alert>}

      <Box sx={{ height: 620, width: '100%' }}>
        <AppGrid<Transaction>
          rowModelType="infinite"
          datasource={datasource}
          columnDefs={transactionColumns}
          {...gridOptions}
          getRowId={getRowId}
          rowSelection={{
            mode: 'multiRow',

            /**
             * Infinite Row Model does not provide native Select All across unloaded rows, so our
             * shared Infinite selection strategy owns the header interaction.
             */
            headerCheckbox: false,

            /**
             * Keep ordinary row clicks free for navigation/interaction. Users select rows through
             * the checkbox rather than toggling selection by clicking anywhere in the row.
             */
            enableClickSelection: false,
          }}
          selectionColumnDef={selectionColumnDef}
          /**
           * Active Overlay is application-controlled and takes precedence over AG Grid's provided
           * overlays while it is set.
           *
           * We use it only for a datasource error. Normal no-data/no-match behaviour remains owned
           * by AG Grid and is not reimplemented here.
           */
          activeOverlay={loadError ? GridErrorOverlay : undefined}
          activeOverlayParams={
            loadError
              ? {
                  message: loadError,
                  onRetry: handleRetryLoad,
                }
              : undefined
          }
          onGridReady={handleGridReady}
          onModelUpdated={updateAfterRowsChange}
          onPaginationChanged={updateAfterRowsChange}
          onRowSelected={handleRowSelected}
          onFilterChanged={handleFilterChanged}
        />
      </Box>
    </Stack>
  );
}
