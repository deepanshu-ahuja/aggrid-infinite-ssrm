// GRIDCAP-ROWMODEL-SSRM | GRIDCAP-DATA-LOAD | GRIDCAP-ROW-ID | GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-VALIDATION | GRIDCAP-COLUMNS
import { useCallback, useMemo, useRef } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { GridApi, GridReadyEvent } from 'ag-grid-community';
import { CellSelectionModule, ClipboardModule } from 'ag-grid-enterprise';
import { AgGridReact } from 'ag-grid-react';
import { compileConfigurableSsrmEntity } from './configuration.compiler';
import type { EntityDefinition } from './configuration.types';
import type { ConfigurableGridRegistries } from './configuration.registries';
import type { GridRowsLoader } from '../data/gridData.types';
import { useServerSideRowLoading } from '../data/server-side/useServerSideRowLoading';
import { useGridDraftEditing } from '../editing/useGridDraftEditing';
import { GridErrorOverlay } from '../overlays/GridErrorOverlay';

export interface ConfigurableSsrmEntityGridProps<TData extends object> {
  entity: EntityDefinition;
  rowsLoader: GridRowsLoader<TData>;
  registries: ConfigurableGridRegistries<TData>;
  resolveLabel: (labelKey: string) => string;
}

/**
 * Reusable SSRM composition root for one already-resolved configurable entity.
 *
 * This component has no knowledge of Loan, Finance, Transaction, roles, or localStorage. Its caller
 * supplies the resolved entity definition plus the entity-specific data/runtime adapters. SSRM
 * lifecycle remains visible here rather than being hidden behind a universal grid wrapper.
 */
export function ConfigurableSsrmEntityGrid<TData extends object>({
  entity,
  rowsLoader,
  registries,
  resolveLabel,
}: ConfigurableSsrmEntityGridProps<TData>) {
  const gridApi = useRef<GridApi<TData> | null>(null);

  const compiled = useMemo(
    () =>
      compileConfigurableSsrmEntity<TData>({
        entity,
        registries,
        resolveLabel,
        runtimePolicy: {
          // Current-user field access has already narrowed `editable` before this component receives
          // the entity. Future row-level policy can be composed here without teaching access profiles
          // or base feature metadata about AG Grid callback params.
          isCellEditable: () => true,
          isRowSelectable: () => true,
        },
      }),
    [entity, registries, resolveLabel],
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
    datasource,
    error: loadError,
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

  const handleGridReady = useCallback((event: GridReadyEvent<TData>) => {
    gridApi.current = event.api;
  }, []);

  const handleModelUpdated = useCallback(() => {
    const api = gridApi.current;
    if (api) restoreDrafts(api);
  }, [restoreDrafts]);

  return (
    <Stack spacing={2}>
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
          }}
          onModelUpdated={handleModelUpdated}
          onFilterChanged={clearLoadError}
          onCellValueChanged={handleCellValueChanged}
        />
      </Box>
    </Stack>
  );
}
