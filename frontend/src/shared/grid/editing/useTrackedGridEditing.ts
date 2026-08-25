import { useCallback, useMemo, useRef, useState } from 'react';
import type { CellValueChangedEvent, GridApi, IRowNode } from 'ag-grid-community';
import {
  buildTrackedGridUpdatePayload,
  createEmptyTrackedGridEditingState,
  hasTrackedGridField,
  recordTrackedGridCellChange,
  type TrackedGridChanges,
  type TrackedGridEditingState,
  type TrackedGridLastEdit,
} from './trackedGridEditing';

interface UseTrackedGridEditingOptions<TData, TField extends string, TValue> {
  /** Stable backend identity used to keep edits independent of RowNode/cache position. */
  getRowId: (row: TData) => string;

  /** Fields this grid permits the shared edit engine to track and restore. */
  editableFields: readonly TField[];

  /** Runtime field guard because AG Grid's `colDef.field` is a string rather than `TField`. */
  isEditableField: (field: string | undefined) => field is TField;

  /** Reads a typed field value from the feature row model. */
  getFieldValue: (row: TData, field: TField) => TValue;
}

/**
 * Generic edit-state engine for server-backed grids whose RowNodes may be recreated.
 *
 * The hook owns only mechanics that future tables should not have to rewrite: accumulated changes,
 * original-value tracking, the latest direct edit, applying changes to loaded nodes, and restoring
 * tracked values after pagination/cache recreation. Feature code still decides editable fields,
 * row identity, validation, presentation and backend payload mapping.
 */
export function useTrackedGridEditing<TData, TField extends string, TValue>({
  getRowId,
  editableFields,
  isEditableField,
  getFieldValue,
}: UseTrackedGridEditingOptions<TData, TField, TValue>) {
  /**
   * Application-owned edit state must outlive AG Grid RowNodes, which can disappear during cache
   * eviction/pagination. React state is required because edit counts/previews/UI depend on changes.
   */
  const [state, setState] = useState<TrackedGridEditingState<TField, TValue>>(
    () => createEmptyTrackedGridEditingState<TField, TValue>(),
  );

  /** Latest direct user cell edit, used by the current "apply last edit" behavior. */
  const [lastEdit, setLastEdit] = useState<TrackedGridLastEdit<TField, TValue>>();

  /**
   * Programmatic bulk changes also emit AG Grid value-change events. This ref prevents those events
   * from replacing the user's latest DIRECT edit while avoiding a render for transient plumbing.
   */
  const applyingProgrammaticChange = useRef(false);

  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<TData>) => {
      if (!event.data || !isEditableField(event.colDef.field)) return;

      const field = event.colDef.field;
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

  /**
   * Shared mutation primitive used after some caller resolves the target RowNodes.
   *
   * The hook records changes before mutating RowNodes, so local edit state survives even if the grid
   * immediately recreates/evicts those nodes afterward.
   */
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

  /**
   * Re-applies unsaved tracked edits to newly materialised RowNodes after cache/page changes.
   * Until a real save endpoint persists the values, backend reloads can otherwise visually revert
   * local edits even though application edit state still contains them.
   */
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

  /** All accumulated local edits, independent of current selection. */
  const payload = useMemo(() => buildTrackedGridUpdatePayload(state), [state]);

  return {
    state,
    editedRowCount: payload.updates.length,
    handleCellValueChanged,
    lastEdit,
    applyChangesToNodes,
    restoreTrackedEdits,
    payload,
  };
}
