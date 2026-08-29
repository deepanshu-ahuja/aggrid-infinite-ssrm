// GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-DISCARD | GRIDCAP-EDIT-CONFLICT | GRIDCAP-EDIT-VALIDATION | GRIDCAP-COUNT-EDITED | GRIDCAP-ROW-ID | GRIDCAP-ROW-ELIGIBILITY
import { useCallback, useMemo, useRef, useState } from 'react';
import type { CellValueChangedEvent, GridApi, IRowNode } from 'ag-grid-community';
import {
  clearGridRowValidationErrors,
  createServerGridValidationErrors,
  setGridFieldValidationErrors,
  type GridFieldValidationErrors,
  type GridValidationState,
} from '@/shared/grid/validation/gridValidation';
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
  /** Feature-owned rule selection/messages; shared editing owns when effective LOCAL values must revalidate. */
  validateField?: (field: TField, value: TValue) => GridFieldValidationErrors;
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
 *
 * Validation is coordinated here because this hook owns every lifecycle that creates, replaces or removes
 * an effective LOCAL value. Validation state remains a separate stable-id/field store; it is not encoded
 * into dirty/conflict state and does not change BASE/LOCAL/REMOTE reconciliation semantics.
 */
export function useTrackedGridEditing<TData, TField extends string, TValue>({
  getRowId,
  editableFields,
  isEditableField,
  getFieldValue,
  isRowEditable,
  validateField,
}: UseTrackedGridEditingOptions<TData, TField, TValue>) {
  const [state, setState] = useState<TrackedGridEditingState<TField, TValue>>(() =>
    createEmptyTrackedGridEditingState<TField, TValue>(),
  );
  const [validationState, setValidationState] = useState<GridValidationState<TField>>({});
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

  // GRIDCAP-EDIT-VALIDATION
  const validateLocalField = useCallback(
    (rowId: string, field: TField, value: TValue) => {
      if (!validateField) return;
      setValidationState((current) =>
        setGridFieldValidationErrors(current, rowId, field, validateField(field, value)),
      );
    },
    [validateField],
  );

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
      validateLocalField(rowId, field, newValue);
      setLastEdit({ field, value: newValue });
    },
    [getRowId, isEditableField, isRowEditable, markLocalOverlay, validateLocalField],
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

      // Programmatic current-page edits are real LOCAL edits and therefore use the exact same validation
      // rules as direct cell editing. Invalid values remain visible and dirty; validation never rejects
      // the local write itself.
      if (validateField) {
        setValidationState((current) => {
          let next = current;
          for (const node of nodes) {
            if (!node.data || (isRowEditable && !isRowEditable(node.data))) continue;
            const rowId = getRowId(node.data);
            for (const field of editableFields) {
              if (!hasTrackedGridField(changes, field)) continue;
              const value = changes[field] as TValue;
              next = setGridFieldValidationErrors(next, rowId, field, validateField(field, value));
            }
          }
          return next;
        });
      }

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
    [editableFields, getFieldValue, getRowId, isRowEditable, markLocalOverlay, validateField],
  );

  // GRIDCAP-EDIT-CONFLICT | GRIDCAP-EDIT-VALIDATION | GRIDCAP-LIFECYCLE-REFRESH
  const restoreTrackedEdits = useCallback(
    (api: GridApi<TData>) => {
      let reconciledState = state;
      const loadedNodes: IRowNode<TData>[] = [];
      const validationFieldsToClear: Array<{ rowId: string; field: TField }> = [];

      api.forEachNode((node) => {
        if (!node.data) return;
        loadedNodes.push(node);

        const rowId = getRowId(node.data);
        const rowChangesBefore = reconciledState.changesById[rowId];
        if (!rowChangesBefore) return;

        const marker = localOverlayByNode.current.get(node);
        const sameLocallyMutatedData = marker?.data === node.data;
        const remoteValues: TrackedGridChanges<TField, TValue> = {};

        for (const field of editableFields) {
          if (!hasTrackedGridField(rowChangesBefore, field)) continue;
          if (sameLocallyMutatedData && marker.fields.has(field)) continue;
          remoteValues[field] = getFieldValue(node.data, field);
        }

        const before = reconciledState;
        reconciledState = reconcileTrackedGridRemoteValues(reconciledState, rowId, remoteValues);

        // REMOTE == LOCAL auto-cleans the draft. Since the authoritative row now contains that value,
        // stale client/server validation errors for the no-longer-local field must disappear as well.
        for (const field of editableFields) {
          if (
            hasTrackedGridField(before.changesById[rowId], field) &&
            !hasTrackedGridField(reconciledState.changesById[rowId], field)
          ) {
            validationFieldsToClear.push({ rowId, field });
          }
        }
      });

      if (reconciledState !== state) setState(reconciledState);
      if (validationFieldsToClear.length > 0) {
        setValidationState((current) => {
          let next = current;
          for (const { rowId, field } of validationFieldsToClear) {
            next = setGridFieldValidationErrors(next, rowId, field, []);
          }
          return next;
        });
      }

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
      // Saves are blocked while submitted fields are invalid. Any newer in-flight edit revalidates when it
      // is created, so acknowledgement only owns dirty-state cleanup and must not erase newer validation.
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

  // GRIDCAP-EDIT-DISCARD | GRIDCAP-EDIT-VALIDATION
  const discardRow = useCallback(
    (api: GridApi<TData>, rowId: string) => {
      if (!state.originalsById[rowId]) return;
      restoreAuthoritativeValuesForRows(api, new Set([rowId]));
      setState((current) => discardTrackedGridRow(current, rowId));
      setValidationState((current) => clearGridRowValidationErrors(current, rowId));
    },
    [restoreAuthoritativeValuesForRows, state.originalsById],
  );

  // GRIDCAP-EDIT-DISCARD | GRIDCAP-EDIT-VALIDATION
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
      setValidationState((current) => {
        let next = current;
        for (const rowId of ids) next = clearGridRowValidationErrors(next, rowId);
        return next;
      });
    },
    [restoreAuthoritativeValuesForRows],
  );

  // GRIDCAP-EDIT-CONFLICT | GRIDCAP-EDIT-VALIDATION
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
      // `Use server` removes LOCAL for the field, so no LOCAL/server-rejection error remains relevant.
      setValidationState((current) => setGridFieldValidationErrors(current, rowId, field, []));
    },
    [getFieldValue, getRowId, state.conflictsById],
  );

  // GRIDCAP-EDIT-CONFLICT | GRIDCAP-EDIT-VALIDATION
  const resolveConflictWithLocal = useCallback(
    (rowId: string, field: TField) => {
      const localValue = state.changesById[rowId]?.[field];
      setState((current) => resolveTrackedGridConflictWithLocal(current, rowId, field));
      // `Keep my edit` rebases BASE to REMOTE but keeps LOCAL. Re-run the feature rule set so any stale
      // server error is replaced by validation of the value the user explicitly chose to keep.
      if (localValue !== undefined) validateLocalField(rowId, field, localValue as TValue);
    },
    [state.changesById, validateLocalField],
  );

  // GRIDCAP-EDIT-VALIDATION
  const setServerValidationErrors = useCallback(
    (rowId: string, errorsByField: Partial<Record<TField, readonly string[]>>) => {
      setValidationState((current) => {
        let next = current;
        for (const field of editableFields) {
          if (!Object.prototype.hasOwnProperty.call(errorsByField, field)) continue;
          next = setGridFieldValidationErrors(
            next,
            rowId,
            field,
            createServerGridValidationErrors(errorsByField[field] ?? []),
          );
        }
        return next;
      });
    },
    [editableFields],
  );

  const payload = useMemo(() => buildTrackedGridUpdatePayload(state), [state]);
  const conflictCount = useMemo(() => getTrackedGridConflictCount(state), [state]);
  const validationErrorCount = useMemo(
    () =>
      Object.values(validationState).reduce(
        (rowTotal, rowErrors) =>
          rowTotal +
          Object.values(rowErrors).reduce(
            (fieldTotal, fieldErrors) => fieldTotal + (fieldErrors?.length ?? 0),
            0,
          ),
        0,
      ),
    [validationState],
  );

  return {
    state,
    validationState,
    payload,
    // GRIDCAP-COUNT-EDITED: one update per dirty row, regardless of how many fields are dirty.
    editedRowCount: payload.updates.length,
    conflictCount,
    validationErrorCount,
    lastEdit,
    handleCellValueChanged,
    applyChangesToNodes,
    restoreTrackedEdits,
    acknowledgeChanges,
    discardRow,
    discardRows,
    resolveConflictWithRemote,
    resolveConflictWithLocal,
    setServerValidationErrors,
  };
}
