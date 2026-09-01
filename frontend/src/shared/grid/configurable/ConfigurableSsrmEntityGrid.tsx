// GRIDCAP-ROWMODEL-SSRM | GRIDCAP-DATA-LOAD | GRIDCAP-ROW-ID | GRIDCAP-SEL-MANUAL | GRIDCAP-SEL-PAGE | GRIDCAP-SEL-FILTERED | GRIDCAP-SEL-ALL | GRIDCAP-COUNT-SELECTED | GRIDCAP-SEL-TARGET | GRIDCAP-ACTION-SELECTED | GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-VALIDATION | GRIDCAP-COLUMNS
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type {
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { CellSelectionModule, ClipboardModule } from 'ag-grid-enterprise';
import { AgGridReact } from 'ag-grid-react';
import {
  compileConfigurableSsrmEntity,
  type ConfigurableGridRuntimePolicy,
} from './configuration.compiler';
import type { EntityDefinition } from './configuration.types';
import type { ConfigurableGridRegistries } from './configuration.registries';
import type { GridRowsLoader } from '../data/gridData.types';
import { useServerSideRowLoading } from '../data/server-side/useServerSideRowLoading';
import { useGridDraftEditing } from '../editing/useGridDraftEditing';
import { GridErrorOverlay } from '../overlays/GridErrorOverlay';
import { getLogicalSelectedRowCount } from '../selection/selectionCount';
import { useSsrmSelectionController } from '../selection/server-side/useSsrmSelectionController';
import type { ServerSelectionIntent } from '../selection/serverSelection';

const EMPTY_SELECTION: ServerSelectionIntent<string> = { mode: 'include', ids: [] };

export interface ConfigurableSsrmActionContext {
  selection: ServerSelectionIntent<string>;
  /** Complete applied AG Grid filter model; the feature adapter owns backend translation. */
  filterModel: object;
}

/**
 * One common feature action rendered by the configurable SSRM root.
 *
 * The grid owns selection and refresh lifecycle. The caller owns the mutation implementation and can
 * use TanStack Query or another application-level mutation primitive without putting HTTP in shared
 * grid code.
 */
export interface ConfigurableSsrmPrimaryAction {
  label: string;
  isPending?: boolean;
  error?: string;
  successMessage?: string;
  onExecute: (context: ConfigurableSsrmActionContext) => Promise<unknown>;
}

export interface ConfigurableSsrmEntityGridProps<TData extends object> {
  entity: EntityDefinition;
  rowsLoader: GridRowsLoader<TData>;
  registries: ConfigurableGridRegistries<TData>;
  resolveLabel: (labelKey: string) => string;
  /** Optional row-level/runtime policy derived from authoritative row data, not static access roles. */
  runtimePolicy?: ConfigurableGridRuntimePolicy<TData>;
  /** Optional common action; entity-specific endpoint/payload mapping stays in the caller/runtime. */
  primaryAction?: ConfigurableSsrmPrimaryAction;
}

/**
 * Reusable SSRM composition root for one already-resolved configurable entity.
 *
 * This component has no knowledge of Loan, Finance, Transaction, roles, localStorage or HTTP payload
 * shapes. Its caller supplies resolved metadata plus executable entity adapters. The component keeps
 * real SSRM lifecycle visible: GridApi, datasource, selection, retry, refresh, draft restoration and
 * native AG Grid events remain here rather than disappearing behind a universal row-model wrapper.
 */
export function ConfigurableSsrmEntityGrid<TData extends object>({
  entity,
  rowsLoader,
  registries,
  resolveLabel,
  runtimePolicy,
  primaryAction,
}: ConfigurableSsrmEntityGridProps<TData>) {
  const gridApi = useRef<GridApi<TData> | null>(null);
  const [isGridReady, setIsGridReady] = useState(false);
  const [, setSelectionRevision] = useState(0);

  const compiled = useMemo(
    () =>
      compileConfigurableSsrmEntity<TData>({
        entity,
        registries,
        resolveLabel,
        runtimePolicy,
      }),
    [entity, registries, resolveLabel, runtimePolicy],
  );

  const editableFields = useMemo(
    () =>
      new Set(
        entity.fields
          .filter((field) => field.editable === true)
          .map((field) => String(field.field)),
      ),
    [entity],
  );

  const {
    error: selectionError,
    isFilteredSelectAllActive,
    readSelectionIntent,
    selectCurrentPage,
    selectAllFiltered,
    clearSelection,
    onModelUpdated: syncSelectionAfterRowsChange,
    onRowSelected,
    onSelectionChanged,
    resetFilterDependentSelection,
  } = useSsrmSelectionController({
    gridApi,
    getRowId: compiled.getRowIdFromData,
  });

  const {
    datasource,
    error: loadError,
    totalCount,
    filteredCount,
    retry: retryLoad,
    clearError: clearLoadError,
  } = useServerSideRowLoading({
    gridApi,
    loadRows: rowsLoader,
    defaultBlockSize: compiled.gridOptions.cacheBlockSize ?? 100,
  });

  const {
    editedRowCount,
    editedCellCount,
    handleCellValueChanged,
    restoreDrafts,
  } = useGridDraftEditing<TData, string, unknown>({
    getRowId: compiled.getRowIdFromData,
    isEditableField: (field): field is string => Boolean(field && editableFields.has(field)),
  });

  const selectionIntent = isGridReady ? readSelectionIntent() : EMPTY_SELECTION;
  const selectionScopeTotal = isFilteredSelectAllActive ? filteredCount : totalCount;
  const selectedRowCount = getLogicalSelectedRowCount(selectionIntent, selectionScopeTotal);
  const hasSelection = selectedRowCount > 0;

  const handleGridReady = useCallback((event: GridReadyEvent<TData>) => {
    gridApi.current = event.api;
    setIsGridReady(true);
  }, []);

  const handleModelUpdated = useCallback(() => {
    syncSelectionAfterRowsChange();
    const api = gridApi.current;
    if (api) restoreDrafts(api);
  }, [restoreDrafts, syncSelectionAfterRowsChange]);

  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent<TData>) => {
      onSelectionChanged(event);
      // Native SSRM selection lives inside AG Grid, so bump a tiny render revision for selected-count
      // and action enabled-state presentation without copying the native selection model into React.
      setSelectionRevision((revision) => revision + 1);
    },
    [onSelectionChanged],
  );

  const handleFilterChanged = useCallback(() => {
    clearLoadError();
    resetFilterDependentSelection();
  }, [clearLoadError, resetFilterDependentSelection]);

  const handlePrimaryAction = useCallback(async () => {
    const api = gridApi.current;
    if (!api || !primaryAction) return;

    const currentSelection = readSelectionIntent();
    const currentScopeTotal = isFilteredSelectAllActive ? filteredCount : totalCount;
    if (getLogicalSelectedRowCount(currentSelection, currentScopeTotal) <= 0) return;

    try {
      await primaryAction.onExecute({
        selection: currentSelection,
        filterModel: api.getFilterModel(),
      });

      // Review's current primary action contract has one shared successful lifecycle: the operation is
      // complete against backend-authoritative data, so clear the old selection and ask SSRM for fresh
      // rows. Failed Promises intentionally skip both operations so the user's target remains usable.
      clearSelection();
      api.refreshServerSide();
    } catch {
      // The caller owns mutation error state/presentation. Swallow the re-thrown mutateAsync rejection
      // here so a handled UI error does not become an unhandled Promise rejection in the click event.
    }
  }, [
    clearSelection,
    filteredCount,
    isFilteredSelectAllActive,
    primaryAction,
    readSelectionIntent,
    totalCount,
  ]);

  return (
    <Stack spacing={2}>
      {primaryAction ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Button
            variant="contained"
            size="small"
            disabled={!hasSelection || primaryAction.isPending}
            onClick={() => void handlePrimaryAction()}
          >
            {primaryAction.isPending ? `${primaryAction.label}…` : primaryAction.label}
          </Button>
          <Typography variant="body2" color="text.secondary">
            {selectedRowCount} {selectedRowCount === 1 ? 'row' : 'rows'} selected
          </Typography>
        </Stack>
      ) : null}

      {primaryAction?.error ? <Alert severity="error">{primaryAction.error}</Alert> : null}
      {primaryAction?.successMessage ? (
        <Alert severity="success">{primaryAction.successMessage}</Alert>
      ) : null}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', sm: 'center' }}
      >
        <Button variant="outlined" size="small" onClick={selectCurrentPage}>
          Select current page
        </Button>
        <Button variant="outlined" size="small" onClick={selectAllFiltered}>
          Select all filtered
        </Button>
        <Button variant="outlined" size="small" onClick={clearSelection}>
          Clear selection
        </Button>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        SSRM's header checkbox selects all records. Current Page and All Filtered are explicit controls
        because those meanings are not both represented by native SSRM Select All.
      </Typography>

      {selectionError ? <Alert severity="warning">{selectionError}</Alert> : null}

      <Typography variant="body2">
        {editedRowCount} {editedRowCount === 1 ? 'row' : 'rows'} edited; {editedCellCount}{' '}
        {editedCellCount === 1 ? 'cell' : 'cells'} changed locally.
      </Typography>

      <Box sx={{ height: 560, width: '100%' }}>
        <AgGridReact<TData>
          {...compiled.gridOptions}
          modules={[CellSelectionModule, ClipboardModule]}
          rowModelType="serverSide"
          serverSideDatasource={datasource}
          columnDefs={compiled.columnDefs}
          components={compiled.components}
          getRowId={compiled.getRowId}
          activeOverlay={loadError ? GridErrorOverlay : undefined}
          activeOverlayParams={loadError ? { message: loadError, onRetry: retryLoad } : undefined}
          onGridReady={handleGridReady}
          onGridPreDestroyed={() => {
            gridApi.current = null;
            setIsGridReady(false);
          }}
          onModelUpdated={handleModelUpdated}
          onRowSelected={onRowSelected}
          onSelectionChanged={handleSelectionChanged}
          onFilterChanged={handleFilterChanged}
          onCellValueChanged={handleCellValueChanged}
        />
      </Box>
    </Stack>
  );
}
