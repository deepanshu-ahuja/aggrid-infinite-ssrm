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

  const restoreOriginalsForRows = useCallback(
    (api: GridApi<TData>, rowIds: ReadonlySet<string>) => {
      applyingProgrammaticChange.current = true;
      try {
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
              node.setDataValue(field, originalValue, 'data');
            }
          }
        });
      } finally {
        applyingProgrammaticChange.current = false;
      }
    },
    [editableFields, getFieldValue, getRowId, state.originalsById],
  );

  /** Discard exactly one row; single-row actions do not depend on checkbox selection. */
  const discardRow = useCallback(
    (api: GridApi<TData>, rowId: string) => {
      if (!state.originalsById[rowId]) return;

      restoreOriginalsForRows(api, new Set([rowId]));
      setState((current) => discardTrackedGridRow(current, rowId));
    },
    [restoreOriginalsForRows, state.originalsById],
  );

  /**
   * Discard an explicit set of dirty rows, used by selection-scoped aggregate actions.
   * Unselected drafts remain untouched and can still be saved/discarded from their own row action.
   */
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
