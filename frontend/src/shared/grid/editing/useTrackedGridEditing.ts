import { useCallback, useMemo, useRef, useState } from 'react';
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

export interface UseTrackedGridEditingOptions<TData, TField extends string, TValue> {
  getRowId: (row: TData) => string;
  editableFields: readonly TField[];
  isEditableField: (field: string | undefined) => field is TField;
  getFieldValue: (row: TData, field: TField) => TValue;
}

/**
 * Generic edit-state engine for server-backed grids whose RowNodes may be recreated.
 *
 * It owns application draft mechanics only: accumulated changes, originals, restore after cache churn,
 * acknowledgement after successful persistence, and local discard. Backend calls and row-model refresh
 * remain outside because those are feature/row-model responsibilities.
 */
export function useTrackedGridEditing<TData, TField extends string, TValue>({
  getRowId,
  editableFields,
  isEditableField,
  getFieldValue,
}: UseTrackedGridEditingOptions<TData, TField, TValue>) {
  const [state, setState] = useState<TrackedGridEditingState<TField, TValue>>(
    () => createEmptyTrackedGridEditingState<TField, TValue>(),
  );
  const [lastEdit, setLastEdit] = useState<TrackedGridLastEdit<TField, TValue>>();
  const applyingProgrammaticChange = useRef(false);

  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<TData>) => {
      if (!event.data) return;

      const candidateField = event.colDef.field as string | undefined;
      if (!isEditableField(candidateField)) return;

      const field: TField = candidateField;
      const oldValue = event.oldValue as TValue;
      const newValue = event.newValue as TValue;
      const rowId = getRowId(event.data);

      setState((current) =>
        recordTrackedGridCellChange(current, rowId, field, oldValue, newValue),
      );

      if (!applyingProgrammaticChange.current) {
        setLastEdit({ field, value: newValue });
      }
    },
    [getRowId, isEditableField],
  );

  const applyChangesToNodes = useCallback(
    (nodes: readonly IRowNode<TData>[], changes: TrackedGridChanges<TField, TValue>) => {
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

      applyingProgrammaticChange.current = true;
      try {
        for (const node of nodes) {
          if (!node.data) continue;
          for (const field of editableFields) {
            if (!hasTrackedGridField(changes, field)) continue;
            const nextValue = changes[field] as TValue;
            if (!Object.is(getFieldValue(node.data, field), nextValue)) {
              node.setDataValue(field, nextValue, 'data');
            }
          }
        }
      } finally {
        applyingProgrammaticChange.current = false;
      }
    },
    [editableFields, getFieldValue, getRowId],
  );

  const restoreTrackedEdits = useCallback(
    (api: GridApi<TData>) => {
      applyingProgrammaticChange.current = true;
      try {
        api.forEachNode((node) => {
          if (!node.data) return;
          const rowChanges = state.changesById[getRowId(node.data)];
          if (!rowChanges) return;
          for (const field of editableFields) {
            if (!hasTrackedGridField(rowChanges, field)) continue;
            const trackedValue = rowChanges[field] as TValue;
            if (!Object.is(getFieldValue(node.data, field), trackedValue)) {
              node.setDataValue(field, trackedValue, 'data');
            }
          }
        });
      } finally {
        applyingProgrammaticChange.current = false;
      }
    },
    [editableFields, getFieldValue, getRowId, state.changesById],
  );

  /**
   * Acknowledge exactly the values submitted by a successful request. If the user changed the same
   * field again while the request was in flight, the newer value remains dirty.
   */
  const acknowledgeChanges = useCallback(
    (updates: TrackedGridUpdatePayload<TField, TValue>['updates']) => {
      setState((current) => acknowledgeTrackedGridChanges(current, updates));
    },
    [],
  );

  /**
   * Discard one row locally. Loaded RowNodes are restored immediately from the first captured originals;
   * unloaded rows need no grid mutation because the next server load already contains persisted values.
   */
  const discardRow = useCallback(
    (api: GridApi<TData>, rowId: string) => {
      const originals = state.originalsById[rowId];
      if (!originals) return;

      applyingProgrammaticChange.current = true;
      try {
        api.forEachNode((node) => {
          if (!node.data || getRowId(node.data) !== rowId) return;
          for (const field of editableFields) {
            if (!hasTrackedGridField(originals, field)) continue;
            const originalValue = originals[field] as TValue;
            if (!Object.is(getFieldValue(node.data, field), originalValue)) {
              node.setDataValue(field, originalValue, 'data');
            }
          }
        });
      } finally {
        applyingProgrammaticChange.current = false;
      }

      setState((current) => discardTrackedGridRow(current, rowId));
    },
    [editableFields, getFieldValue, getRowId, state.originalsById],
  );

  const discardAll = useCallback(
    (api: GridApi<TData>) => {
      applyingProgrammaticChange.current = true;
      try {
        api.forEachNode((node) => {
          if (!node.data) return;
          const originals = state.originalsById[getRowId(node.data)];
          if (!originals) return;
          for (const field of editableFields) {
            if (!hasTrackedGridField(originals, field)) continue;
            const originalValue = originals[field] as TValue;
            if (!Object.is(getFieldValue(node.data, field), originalValue)) {
              node.setDataValue(field, originalValue, 'data');
            }
          }
        });
      } finally {
        applyingProgrammaticChange.current = false;
      }

      setState(createEmptyTrackedGridEditingState<TField, TValue>());
      setLastEdit(undefined);
    },
    [editableFields, getFieldValue, getRowId, state.originalsById],
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
    discardAll,
  };
}
