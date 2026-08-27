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

/** All writes made by this hook already have their draft state handled explicitly. */
const TRACKED_GRID_WRITE_SOURCE = 'data';

export interface UseTrackedGridEditingOptions<TData, TField extends string, TValue> {
  getRowId: (row: TData) => string;
  editableFields: readonly TField[];
  isEditableField: (field: string | undefined) => field is TField;
  getFieldValue: (row: TData, field: TField) => TValue;

  /**
   * Optional row-level edit policy supplied by the feature.
   *
   * AG Grid's column `editable` callback prevents normal cell editing, but current-page edit flows and
   * draft restoration write through RowNode APIs. Those application writes must obey the same row
   * policy instead of treating programmatic writes as a way around a read-only row.
   */
  isRowEditable?: (row: TData) => boolean;
}

/**
 * Keeps unsaved grid edits outside AG Grid RowNodes so they survive page/cache reloads.
 * The feature still owns which fields/rows are editable and how saves are sent to the backend.
 */
export function useTrackedGridEditing<TData, TField extends string, TValue>({
  getRowId,
  editableFields,
  isEditableField,
  getFieldValue,
  isRowEditable,
}: UseTrackedGridEditingOptions<TData, TField, TValue>) {
  const [state, setState] = useState<TrackedGridEditingState<TField, TValue>>(() =>
    createEmptyTrackedGridEditingState<TField, TValue>(),
  );
  const [lastEdit, setLastEdit] = useState<TrackedGridLastEdit<TField, TValue>>();
  const applyingProgrammaticChange = useRef(false);

  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<TData>) => {
      /**
       * User typing becomes a draft only after AG Grid commits the edit and fires cellValueChanged.
       * Our own setDataValue calls can fire the same event. Ignore them by source as well as by the
       * synchronous guard, so a delayed restore event cannot recreate a draft after Discard finished.
       */
      if (
        applyingProgrammaticChange.current ||
        event.source === TRACKED_GRID_WRITE_SOURCE ||
        !event.data ||
        (isRowEditable && !isRowEditable(event.data))
      ) {
        return;
      }

      const candidateField = event.colDef.field as string | undefined;
      if (!isEditableField(candidateField)) return;

      const field: TField = candidateField;
      const oldValue = event.oldValue as TValue;
      const newValue = event.newValue as TValue;
      const rowId = getRowId(event.data);

      setState((current) => recordTrackedGridCellChange(current, rowId, field, oldValue, newValue));
      setLastEdit({ field, value: newValue });
    },
    [getRowId, isEditableField, isRowEditable],
  );

  const applyChangesToNodes = useCallback(
    (nodes: readonly IRowNode<TData>[], changes: TrackedGridChanges<TField, TValue>) => {
      // Bulk edit controls are real drafts, but read-only rows are never valid edit targets.
      setState((current) => {
        let next = current;
        for (const node of nodes) {
          if (!node.data || (isRowEditable && !isRowEditable(node.data))) continue;
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
          if (!node.data || (isRowEditable && !isRowEditable(node.data))) continue;
          for (const field of editableFields) {
            if (!hasTrackedGridField(changes, field)) continue;
            const nextValue = changes[field] as TValue;
            if (!Object.is(getFieldValue(node.data, field), nextValue)) {
              node.setDataValue(field, nextValue, TRACKED_GRID_WRITE_SOURCE);
            }
          }
        }
      } finally {
        applyingProgrammaticChange.current = false;
      }
    },
    [editableFields, getFieldValue, getRowId, isRowEditable],
  );

  const restoreTrackedEdits = useCallback(
    (api: GridApi<TData>) => {
      // A newly loaded RowNode starts with backend data. Restore a draft only if the row is still editable.
      applyingProgrammaticChange.current = true;
      try {
        api.forEachNode((node) => {
          if (!node.data || (isRowEditable && !isRowEditable(node.data))) return;
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
      } finally {
        applyingProgrammaticChange.current = false;
      }
    },
    [editableFields, getFieldValue, getRowId, isRowEditable, state.changesById],
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
              node.setDataValue(field, originalValue, TRACKED_GRID_WRITE_SOURCE);
            }
          }
        });
      } finally {
        applyingProgrammaticChange.current = false;
      }
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
