// GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-DISCARD | GRIDCAP-COUNT-EDITED
import { useCallback, useMemo, useRef, useState } from 'react';
import type { CellValueChangedEvent, GridApi } from 'ag-grid-community';
import {
  acknowledgeGridDraftChanges,
  buildGridDraftUpdatePayload,
  createEmptyGridDraftEditingState,
  discardGridDraftRow,
  discardGridDraftRows,
  recordGridDraftCellChange,
  type GridDraftEditingState,
  type GridDraftUpdatePayload,
} from './gridDraftEditing';

export interface UseGridDraftEditingOptions<TData, TField extends string> {
  getRowId: (row: TData) => string;
  isEditableField: (field: string | undefined) => field is TField;
}

/**
 * React/AG Grid adapter for the lightweight BASE + LOCAL draft state.
 *
 * AG Grid keeps owning normal row mutation and all native edit entry points (single edit, Fill Handle,
 * Ctrl+D, Ctrl+Enter, paste). This hook observes committed `cellValueChanged` events and stores only
 * fields that are genuinely dirty.
 */
export function useGridDraftEditing<TData, TField extends string, TValue>({
  getRowId,
  isEditableField,
}: UseGridDraftEditingOptions<TData, TField>) {
  const [state, setState] = useState<GridDraftEditingState<TField, TValue>>(() =>
    createEmptyGridDraftEditingState<TField, TValue>(),
  );

  /**
   * Keep an imperative mirror because SSRM model updates and user callbacks can happen before React's
   * next render. Every state mutation goes through `applyState`, which updates this ref before scheduling
   * React state, so a discard followed immediately by refresh cannot restore the just-discarded draft.
   */
  const stateRef = useRef(state);

  const applyState = useCallback(
    (
      transform: (
        current: GridDraftEditingState<TField, TValue>,
      ) => GridDraftEditingState<TField, TValue>,
    ) => {
      const current = stateRef.current;
      const next = transform(current);
      if (next === current) return;
      stateRef.current = next;
      setState(next);
    },
    [],
  );

  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<TData>) => {
      if (!event.data) return;
      const candidateField = event.colDef.field as string | undefined;
      if (!isEditableField(candidateField)) return;

      applyState((current) =>
        recordGridDraftCellChange(
          current,
          getRowId(event.data as TData),
          candidateField,
          event.oldValue as TValue,
          event.newValue as TValue,
        ),
      );
    },
    [applyState, getRowId, isEditableField],
  );

  /**
   * Reapply only LOCAL values for dirty fields when SSRM recreates loaded RowNodes.
   *
   * No server block is copied into React. A fresh RowNode starts from datasource data, then this overlay
   * puts back only the finite unsaved fields. `recordGridDraftCellChange` is idempotent for the resulting
   * setDataValue event because that LOCAL value is already in the draft map.
   */
  const restoreDrafts = useCallback(
    (api: GridApi<TData>) => {
      const current = stateRef.current;

      api.forEachNode((node) => {
        if (!node.data) return;

        const rowDraft = current.draftsById[getRowId(node.data)];
        if (!rowDraft) return;

        for (const [field, draft] of Object.entries(rowDraft.fields) as Array<
          [TField, { baseValue: TValue; value: TValue }]
        >) {
          node.setDataValue(field, draft.value, 'draftRestore');
        }
      });
    },
    [getRowId],
  );

  const acknowledgeChanges = useCallback(
    (updates: GridDraftUpdatePayload<TField, TValue>['updates']) => {
      applyState((current) => acknowledgeGridDraftChanges(current, updates));
    },
    [applyState],
  );

  const discardRow = useCallback(
    (rowId: string) => {
      applyState((current) => discardGridDraftRow(current, rowId));
    },
    [applyState],
  );

  const discardRows = useCallback(
    (rowIds: readonly string[]) => {
      applyState((current) => discardGridDraftRows(current, rowIds));
    },
    [applyState],
  );

  const payload = useMemo(() => buildGridDraftUpdatePayload(state), [state]);

  return {
    state,
    payload,
    editedRowCount: state.dirtyRowCount,
    editedCellCount: state.dirtyCellCount,
    handleCellValueChanged,
    restoreDrafts,
    acknowledgeChanges,
    discardRow,
    discardRows,
  };
}
