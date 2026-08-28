// GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-DISCARD | GRIDCAP-EDIT-CONFLICT | GRIDCAP-COUNT-EDITED | GRIDCAP-ROW-ID | GRIDCAP-ROW-ELIGIBILITY
import { useCallback, useMemo, useRef, useState } from 'react';
import type { CellValueChangedEvent, GridApi, IRowNode } from 'ag-grid-community';
import {
  acknowledgeTrackedGridChanges,
  buildTrackedGridUpdatePayload,
  createEmptyTrackedGridEditingState,
  discardTrackedGridRow,
  getTrackedGridConflictCount,
  hasTrackedGridField,
  reconcileTrackedGridRemoteValues,
  recordTrackedGridCellChange,
  resolveTrackedGridConflictWithLocal,
  resolveTrackedGridConflictWithRemote,
  type TrackedGridChanges,
  type TrackedGridConflicts,
  type TrackedGridEditingState,
  type TrackedGridLastEdit,
  type TrackedGridUpdatePayload,
} from './trackedGridEditing';

const TRACKED_GRID_WRITE_SOURCE = 'data';

export interface UseTrackedGridEditingOptions<TData, TField extends string, TValue> {
  getRowId: (row: TData) => string;
  editableFields: readonly TField[];
  isEditableField: (field: string | undefined) => field is TField;
  getFieldValue: (row: TData, field: TField) => TValue;
  isRowEditable?: (row: TData) => boolean;
}

interface LocalOverlayMarker<TData, TField extends string> {
  /** Exact row-data object that already contains our LOCAL presentation values. */
  data: TData;
  fields: Set<TField>;
}

/**
 * Keeps unsaved edits outside AG Grid RowNodes so drafts survive server-backed row recreation.
 *
 * BASE/LOCAL/REMOTE reconciliation happens only when a RowNode contains genuinely fresh server data.
 * After this hook writes LOCAL values into a node, a later pagination/model event can revisit the same
 * node. `localOverlayByNode` records the exact data-object reference we mutated so those revisits are
 * presentation restores, not false "server now equals LOCAL" acknowledgements. If AG Grid replaces the
 * row data during a real cache/server refresh, the data reference changes and reconciliation runs again.
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
  const localOverlayByNode = useRef(new WeakMap<IRowNode<TData>, LocalOverlayMarker<TData, TField>>());

  const markLocalOverlay = useCallback((node: IRowNode<TData> | undefined, field: TField) => {
    // AG Grid supplies `event.node` in production. Some focused hook tests intentionally construct the
    // smallest possible CellValueChangedEvent; missing node bookkeeping is safe because reconciliation
    // still works when a later real RowNode materialises.
    if (!node?.data) return;
    const current = localOverlayByNode.current.get(node);
    if (current?.data === node.data) {
      current.fields.add(field);
      return;
    }
    localOverlayByNode.current.set(node, { data: node.data, fields: new Set([field]) });
  }, []);

  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<TData>) => {
      if (applyingProgrammaticChange.current || event.source === TRACKED_GRID_WRITE_SOURCE) return;
      if (!event.data || (isRowEditable && !isRowEditable(event.data))) return;

      const candidateField = event.colDef.field as string | undefined;
      if (!isEditableField(candidateField)) return;

      const field: TField = candidateField;
      const oldValue = event.oldValue as TValue;
      const newValue = event.newValue as TValue;
      const rowId = getRowId(event.data);

      // A direct user edit mutates this same row-data object, so later model/page events must not mistake
      // that LOCAL value for newly fetched REMOTE data.
      markLocalOverlay(event.node, field);
      setState((current) => recordTrackedGridCellChange(current, rowId, field, oldValue, newValue));
      setLastEdit({ field, value: newValue });
    },
    [getRowId, isEditableField, isRowEditable, markLocalOverlay],
  );

  const applyChangesToNodes = useCallback(
    (nodes: readonly IRowNode<TData>[], changes: TrackedGridChanges<TField, TValue>) => {
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
            markLocalOverlay(node, field);
          }
        }
      } finally {
        applyingProgrammaticChange.current = false;
      }
    },
    [editableFields, getFieldValue, getRowId, isRowEditable, markLocalOverlay],
  );

  // GRIDCAP-EDIT-CONFLICT | GRIDCAP-LIFECYCLE-REFRESH
  const restoreTrackedEdits = useCallback(
    (api: GridApi<TData>) => {
      let reconciledState = state;
      const loadedNodes: IRowNode<TData>[] = [];

      api.forEachNode((node) => {
        if (!node.data) return;
        loadedNodes.push(node);

        const rowId = getRowId(node.data);
        const rowChanges = reconciledState.changesById[rowId];
        if (!rowChanges) return;

        const marker = localOverlayByNode.current.get(node);
        const sameLocallyMutatedData = marker?.data === node.data;
        const remoteValues: TrackedGridChanges<TField, TValue> = {};

        for (const field of editableFields) {
          if (!hasTrackedGridField(rowChanges, field)) continue;
          if (sameLocallyMutatedData && marker.fields.has(field)) continue;
          remoteValues[field] = getFieldValue(node.data, field);
        }

        reconciledState = reconcileTrackedGridRemoteValues(reconciledState, rowId, remoteValues);
      });

      if (reconciledState !== state) setState(reconciledState);

      applyingProgrammaticChange.current = true;
      try {
        for (const node of loadedNodes) {
          if (!node.data) continue;
          const rowChanges = reconciledState.changesById[getRowId(node.data)];
          if (!rowChanges) continue;

          for (const field of editableFields) {
            if (!hasTrackedGridField(rowChanges, field)) continue;
            const trackedValue = rowChanges[field] as TValue;
            if (!Object.is(getFieldValue(node.data, field), trackedValue)) {
              node.setDataValue(field, trackedValue, TRACKED_GRID_WRITE_SOURCE);
            }
            markLocalOverlay(node, field);
          }
        }
      } finally {
        applyingProgrammaticChange.current = false;
      }
    },
    [editableFields, getFieldValue, getRowId, markLocalOverlay, state],
  );

  const acknowledgeChanges = useCallback(
    (updates: TrackedGridUpdatePayload<TField, TValue>['updates']) => {
      setState((current) => acknowledgeTrackedGridChanges(current, updates));
    },
    [],
  );

  const restoreAuthoritativeValuesForRows = useCallback(
    (api: GridApi<TData>, rowIds: ReadonlySet<string>) => {
      applyingProgrammaticChange.current = true;
      try {
        api.forEachNode((node) => {
          if (!node.data) return;
          const rowId = getRowId(node.data);
          if (!rowIds.has(rowId)) return;

          const originals = state.originalsById[rowId];
          if (!originals) return;
          const conflicts: TrackedGridConflicts<TField, TValue> = state.conflictsById[rowId] ?? {};

          for (const field of editableFields) {
            if (!hasTrackedGridField(originals, field)) continue;
            const nextValue = conflicts[field]?.remoteValue ?? (originals[field] as TValue);
            if (!Object.is(getFieldValue(node.data, field), nextValue)) {
              node.setDataValue(field, nextValue, TRACKED_GRID_WRITE_SOURCE);
            }
          }
        });
      } finally {
        applyingProgrammaticChange.current = false;
      }
    },
    [editableFields, getFieldValue, getRowId, state.conflictsById, state.originalsById],
  );

  // GRIDCAP-EDIT-DISCARD
  const discardRow = useCallback(
    (api: GridApi<TData>, rowId: string) => {
      if (!state.originalsById[rowId]) return;
      restoreAuthoritativeValuesForRows(api, new Set([rowId]));
      setState((current) => discardTrackedGridRow(current, rowId));
    },
    [restoreAuthoritativeValuesForRows, state.originalsById],
  );

  // GRIDCAP-EDIT-DISCARD
  const discardRows = useCallback(
    (api: GridApi<TData>, rowIds: readonly string[]) => {
      if (rowIds.length === 0) return;
      const ids = new Set(rowIds);
      restoreAuthoritativeValuesForRows(api, ids);
      setState((current) => {
        let next = current;
        for (const rowId of ids) next = discardTrackedGridRow(next, rowId);
        return next;
      });
    },
    [restoreAuthoritativeValuesForRows],
  );

  // GRIDCAP-EDIT-CONFLICT
  const resolveConflictWithRemote = useCallback(
    (api: GridApi<TData>, rowId: string, field: TField) => {
      const conflict = state.conflictsById[rowId]?.[field];
      if (!conflict) return;

      applyingProgrammaticChange.current = true;
      try {
        api.forEachNode((node) => {
          if (!node.data || getRowId(node.data) !== rowId) return;
          if (!Object.is(getFieldValue(node.data, field), conflict.remoteValue)) {
            node.setDataValue(field, conflict.remoteValue, TRACKED_GRID_WRITE_SOURCE);
          }
        });
      } finally {
        applyingProgrammaticChange.current = false;
      }

      setState((current) => resolveTrackedGridConflictWithRemote(current, rowId, field));
    },
    [getFieldValue, getRowId, state.conflictsById],
  );

  // GRIDCAP-EDIT-CONFLICT
  const resolveConflictWithLocal = useCallback((rowId: string, field: TField) => {
    setState((current) => resolveTrackedGridConflictWithLocal(current, rowId, field));
  }, []);

  const payload = useMemo(() => buildTrackedGridUpdatePayload(state), [state]);
  const conflictCount = useMemo(() => getTrackedGridConflictCount(state), [state]);

  return {
    state,
    payload,
    // GRIDCAP-COUNT-EDITED: one update per dirty row, regardless of how many fields are dirty.
    editedRowCount: payload.updates.length,
    conflictCount,
    lastEdit,
    handleCellValueChanged,
    applyChangesToNodes,
    restoreTrackedEdits,
    acknowledgeChanges,
    discardRow,
    discardRows,
    resolveConflictWithRemote,
    resolveConflictWithLocal,
  };
}
