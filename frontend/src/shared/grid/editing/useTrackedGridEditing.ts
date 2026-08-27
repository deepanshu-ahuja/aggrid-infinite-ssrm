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
  type TrackedGridEditingState,
  type TrackedGridLastEdit,
  type TrackedGridUpdatePayload,
} from './trackedGridEditing';

/**
 * Source tag passed to AG Grid when THIS hook writes a value with `RowNode.setDataValue`.
 *
 * AG Grid fires `cellValueChanged` for both a real user edit and many programmatic value changes. If
 * we did not tag our own writes, restoring/discarding/resolving a draft could be mistaken for a brand-new
 * user edit and recreate dirty state immediately after we tried to reconcile it.
 */
const TRACKED_GRID_WRITE_SOURCE = 'data';

export interface UseTrackedGridEditingOptions<TData, TField extends string, TValue> {
  /** Stable backend identity. Never use row index because server-backed RowNodes are recreated. */
  getRowId: (row: TData) => string;

  /** Feature-owned writable fields. Shared editing code must not know Transaction/Payable field names. */
  editableFields: readonly TField[];

  /** Runtime type guard because AG Grid column definitions expose `field` as a general string. */
  isEditableField: (field: string | undefined) => field is TField;

  /** Feature-owned value reader keeps this hook independent of concrete row shapes. */
  getFieldValue: (row: TData, field: TField) => TValue;

  /**
   * Optional row-level edit policy supplied by the feature.
   *
   * AG Grid's column `editable` callback blocks normal UI editing, but our own current-page/bulk edit
   * helpers call RowNode APIs directly. Those programmatic edit paths must obey the SAME read-only policy.
   */
  isRowEditable?: (row: TData) => boolean;
}

/**
 * Keeps unsaved edits outside AG Grid RowNodes so drafts survive server-backed row recreation.
 *
 * RowNodes are presentation/cache objects and may disappear. The durable editing state is therefore
 * keyed by backend row ID. When fresh rows materialise, this hook performs three-way field reconciliation
 * (BASE/LOCAL/REMOTE) before reapplying any still-valid local value to the new RowNode.
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

  // Synchronous re-entrancy guard only; changing it must never cause React rendering.
  const applyingProgrammaticChange = useRef(false);

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

      setState((current) => recordTrackedGridCellChange(current, rowId, field, oldValue, newValue));
      setLastEdit({ field, value: newValue });
    },
    [getRowId, isEditableField, isRowEditable],
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
      /**
       * This is intentionally reconciliation, not blind restoration. Each loaded row currently contains
       * fresh authoritative server values. Before overlaying LOCAL drafts we compare them with their BASE
       * values and these REMOTE values so a backend change can never be silently hidden by cache refresh.
       */
      let reconciledState = state;
      const loadedNodes: IRowNode<TData>[] = [];

      api.forEachNode((node) => {
        if (!node.data) return;
        loadedNodes.push(node);

        const rowId = getRowId(node.data);
        const rowChanges = reconciledState.changesById[rowId];
        if (!rowChanges) return;

        const remoteValues: TrackedGridChanges<TField, TValue> = {};
        for (const field of editableFields) {
          if (hasTrackedGridField(rowChanges, field)) {
            remoteValues[field] = getFieldValue(node.data, field);
          }
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

          // Reapply even when the refreshed server row has become read-only. The local value remains the
          // user's visible unsaved work; feature mutation guards decide what can subsequently be persisted.
          for (const field of editableFields) {
            if (!hasTrackedGridField(rowChanges, field)) continue;
            const trackedValue = rowChanges[field] as TValue;
            if (!Object.is(getFieldValue(node.data, field), trackedValue)) {
              node.setDataValue(field, trackedValue, TRACKED_GRID_WRITE_SOURCE);
            }
          }
        }
      } finally {
        applyingProgrammaticChange.current = false;
      }
    },
    [editableFields, getFieldValue, getRowId, state],
  );

  const acknowledgeChanges = useCallback(
    (updates: TrackedGridUpdatePayload<TField, TValue>['updates']) => {
      setState((current) => acknowledgeTrackedGridChanges(current, updates));
    },
    [],
  );

  const restoreAuthoritativeValuesForRows = useCallback(
    (api: GridApi<TData>, rowIds: ReadonlySet<string>) => {
      /**
       * Discard means "forget my local work". If a field has already detected a REMOTE value, that value
       * is more authoritative than the old BASE and must be restored. Otherwise BASE is still the latest
       * known server value for the ordinary dirty field.
       */
      applyingProgrammaticChange.current = true;
      try {
        api.forEachNode((node) => {
          if (!node.data) return;
          const rowId = getRowId(node.data);
          if (!rowIds.has(rowId)) return;

          const originals = state.originalsById[rowId];
          if (!originals) return;
          const conflicts = state.conflictsById[rowId] ?? {};

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

  const discardRow = useCallback(
    (api: GridApi<TData>, rowId: string) => {
      if (!state.originalsById[rowId]) return;
      restoreAuthoritativeValuesForRows(api, new Set([rowId]));
      setState((current) => discardTrackedGridRow(current, rowId));
    },
    [restoreAuthoritativeValuesForRows, state.originalsById],
  );

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

  const resolveConflictWithLocal = useCallback((rowId: string, field: TField) => {
    setState((current) => resolveTrackedGridConflictWithLocal(current, rowId, field));
  }, []);

  const payload = useMemo(() => buildTrackedGridUpdatePayload(state), [state]);
  const conflictCount = useMemo(() => getTrackedGridConflictCount(state), [state]);

  return {
    state,
    payload,
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
