import { useCallback, useMemo, useState } from 'react';
import type { CellValueChangedEvent, GridApi, IRowNode } from 'ag-grid-community';
import {
  acknowledgeTrackedGridChanges,
  buildTrackedGridUpdatePayload,
  createEmptyTrackedGridEditingState,
  discardTrackedGridRow,
  hasTrackedGridField,
  recordTrackedGridCellChange,
  type TrackedGridChanges,
  type TrackedGridEditingState,
  type TrackedGridLastEdit,
  type TrackedGridUpdatePayload,
} from './trackedGridEditing';

const TRACKED_GRID_WRITE_SOURCE = 'trackedGridEditing';

export interface UseTrackedGridEditingOptions<TData, TField extends string, TValue> {
  getRowId: (row: TData) => string;
  editableFields: readonly TField[];
  isEditableField: (field: string | undefined) => field is TField;
  getFieldValue: (row: TData, field: TField) => TValue;
}

/**
 * Keeps unsaved grid edits outside AG Grid RowNodes so they survive page/cache reloads.
 * The feature still owns which fields are editable and how saves are sent to the backend.
 */
export function useTrackedGridEditing<TData, TField extends string, TValue>({
  getRowId,
  editableFields,
  isEditableField,
  getFieldValue,
}: UseTrackedGridEditingOptions<TData, TField, TValue>) {
  const [state, setState] = useState<TrackedGridEditingState<TField, TValue>>(() =>
    createEmptyTrackedGridEditingState<TField, TValue>(),
  );
  const [lastEdit, setLastEdit] = useState<TrackedGridLastEdit<TField, TValue>>();

  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<TData>) => {
      /**
       * A user edit reaches us after AG Grid commits the cell value. Our own calls to setDataValue can
       * also produce this event, so they carry a source marker and must not be recorded as another edit.
       * Checking the event source works even if AG Grid delivers the event after setDataValue returns.
       */
      if (event.source === TRACKED_GRID_WRITE_SOURCE || !event.data) return;

      const candidateField = event.colDef.field as string | undefined;
      if (!isEditableField(candidateField)) return;

      const field: TField = candidateField;
      const oldValue = event.oldValue as TValue;
      const newValue = event.newValue as TValue;
      const rowId = getRowId(event.data);

      setState((current) => recordTrackedGridCellChange(current, rowId, field, oldValue, newValue));
      setLastEdit({ field, value: newValue });
    },
    [getRowId, isEditableField],
  );

  const applyChangesToNodes = useCallback(
    (nodes: readonly IRowNode<TData>[], changes: TrackedGridChanges<TField, TValue>) => {
      // Bulk actions are real drafts, so record them before writing their values into loaded RowNodes.
      setState((current) => {
        let next = current;
        for (const node of nodes) {
          if (!node.data) continue;
          const rowId = getRowId(node.data);
          for (const field of editableFields) {
            if (!hasTrackedGridField(changes, field)) continue;
            next = recordTrackedGridCellChange(
              next,
              rowId,
              field,
              getFieldValue(node.data, field),
              changes[field] as TValue,
            );
          }
        }
        return next;
      });

      for (const node of nodes) {
        if (!node.data) continue;
        for (const field of editableFields) {
          if (!hasTrackedGridField(changes, field)) continue;
          const nextValue = changes[field] as TValue;
          if (!Object.is(getFieldValue(node.data, field), nextValue)) {
            node.setDataValue(field, nextValue, TRACKED_GRID_WRITE_SOURCE);
          }
        }
      }
    },
    [editableFields, getFieldValue, getRowId],
  );

  const restoreTrackedEdits = useCallback(
    (api: GridApi<TData>) => {
      // A newly loaded RowNode starts with backend data. Put any still-unsaved local values back into it.
      api.forEachNode((node) => {
        if (!node.data) return;
        const rowChanges = state.changesById[getRowId(node.data)];
        if (!rowChanges) return;
        for (const field of editableFields) {
          if (!hasTrackedGridField(rowChanges, field)) continue;
          const trackedValue = rowChanges[field] as TValue;
          if (!Object.is(getFieldValue(node.data, field), trackedValue)) {
            node.setDataValue(field, trackedValue, TRACKED_GRID_WRITE_SOURCE);
          }
        }
      });
    },
    [editableFields, getFieldValue, getRowId, state.changesById],
  );

  /**
   * Clear only the exact values that were successfully saved. If the user changed a field again while
   * the request was running, that newer value stays dirty.
   */
  const acknowledgeChanges = useCallback(
    (updates: TrackedGridUpdatePayload<TField, TValue>['updates']) => {
      setState((current) => acknowledgeTrackedGridChanges(current, updates));
    },
    [],
  );

  const restoreOriginalsForRows = useCallback(
    (api: GridApi<TData>, rowIds: ReadonlySet<string>) => {
      api.forEachNode((node) => {
        if (!node.data) return;

        const rowId = getRowId(node.data);
        if (!rowIds.has(rowId)) return;

        const originals = state.originalsById[rowId];
        if (!originals) return;

        for (const field of editableFields) {
          if (!hasTrackedGridField(originals, field)) continue;
          const originalValue = originals[field] as TValue;
          if (!Object.is(getFieldValue(node.data, field), originalValue)) {
            // Source marks this as our restore, not a new edit made by the user.
            node.setDataValue(field, originalValue, TRACKED_GRID_WRITE_SOURCE);
          }
        }
      });
    },
    [editableFields, getFieldValue, getRowId, state.originalsById],
  );

  /** Discard one row: restore its first values in the loaded grid and remove its local draft. */
  const discardRow = useCallback(
    (api: GridApi<TData>, rowId: string) => {
      if (!state.originalsById[rowId]) return;

      restoreOriginalsForRows(api, new Set([rowId]));
      setState((current) => discardTrackedGridRow(current, rowId));
    },
    [restoreOriginalsForRows, state.originalsById],
  );

  /** Discard only the selected dirty rows. Other unsaved rows stay untouched. */
  const discardRows = useCallback(
    (api: GridApi<TData>, rowIds: readonly string[]) => {
      if (rowIds.length === 0) return;

      const ids = new Set(rowIds);
      restoreOriginalsForRows(api, ids);

      setState((current) => {
        let next = current;
        for (const rowId of ids) {
          next = discardTrackedGridRow(next, rowId);
        }
        return next;
      });
    },
    [restoreOriginalsForRows],
  );

  const payload = useMemo(() => buildTrackedGridUpdatePayload(state), [state]);

  return {
    state,
    payload,
    editedRowCount: payload.updates.length,
    lastEdit,
    handleCellValueChanged,
    applyChangesToNodes,
    restoreTrackedEdits,
    acknowledgeChanges,
    discardRow,
    discardRows,
  };
}
