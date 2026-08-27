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

/**
 * Source tag passed to AG Grid when THIS hook writes a value with `RowNode.setDataValue`.
 *
 * AG Grid fires `cellValueChanged` for both a real user edit and many programmatic value changes. If
 * we did not tag our own writes, restoring/discarding a draft could be mistaken for a brand-new user
 * edit and recreate dirty state immediately after we tried to clear it.
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
   * helpers and draft restoration call RowNode APIs directly. Those programmatic paths must obey the
   * SAME read-only policy or application code could bypass the UI restriction.
   */
  isRowEditable?: (row: TData) => boolean;
}

/**
 * Keeps unsaved edits outside AG Grid RowNodes so drafts survive server-backed row recreation.
 *
 * WHY NOT STORE DRAFTS ONLY IN THE ROWNODE?
 * -----------------------------------------
 * Infinite/SSRM are allowed to evict, reload and recreate RowNodes. A local unsaved edit would vanish
 * with the old RowNode. The small state machine here stores drafts by stable backend row ID and then
 * reapplies them when that row materialises again.
 */
export function useTrackedGridEditing<TData, TField extends string, TValue>({
  getRowId,
  editableFields,
  isEditableField,
  getFieldValue,
  isRowEditable,
}: UseTrackedGridEditingOptions<TData, TField, TValue>) {
  // `state` is business-relevant draft state (original + changed values), not a mirror of AG Grid's
  // entire row model. That distinction keeps React state small and survives cache churn.
  const [state, setState] = useState<TrackedGridEditingState<TField, TValue>>(() =>
    createEmptyTrackedGridEditingState<TField, TValue>(),
  );

  // The latest user edit is used by the "apply last edit" convenience action. It is separate from
  // dirty-row state because one edit can later be copied to many current-page rows.
  const [lastEdit, setLastEdit] = useState<TrackedGridLastEdit<TField, TValue>>();

  // This ref is deliberately NOT React state. It is a synchronous re-entrancy guard around AG Grid
  // API writes; changing it must not trigger a render.
  const applyingProgrammaticChange = useRef(false);

  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<TData>) => {
      /**
       * `cellValueChanged` is AG Grid's committed-value event. It can be raised by:
       * 1. a real user editor commit;
       * 2. our own `setDataValue` calls;
       * 3. a delayed event from a restore/discard operation.
       *
       * Only case 1 should create/update a user draft.
       */
      if (applyingProgrammaticChange.current) {
        // We are inside one of our own synchronous write loops below. Draft state was already handled
        // explicitly before the AG Grid value write, so recording it again would double-process it.
        return;
      }

      if (event.source === TRACKED_GRID_WRITE_SOURCE) {
        // The source tag also protects us if AG Grid delivers the event after the synchronous guard
        // has already been cleared (the discard idempotency race we explicitly test).
        return;
      }

      if (!event.data) {
        // Server-backed RowNodes can exist briefly without row data. There is no stable row ID/value
        // to record yet, so such an event is not a valid draft.
        return;
      }

      if (isRowEditable && !isRowEditable(event.data)) {
        // Defence in depth: the column's native AG Grid `editable` callback should stop the user from
        // entering an editor, but this shared hook also refuses a stale/programmatic event for a row
        // that the feature now considers read-only.
        return;
      }

      const candidateField = event.colDef.field as string | undefined;
      if (!isEditableField(candidateField)) {
        // Ignore changes from display/read-only columns. Shared code trusts the feature's explicit
        // editable-field contract rather than assuming every AG Grid column is persistable.
        return;
      }

      const field: TField = candidateField;
      const oldValue = event.oldValue as TValue;
      const newValue = event.newValue as TValue;
      const rowId = getRowId(event.data);

      // `recordTrackedGridCellChange` owns the important dirty-state rules, including reverting the
      // field back to its original value and removing a no-longer-dirty draft.
      setState((current) => recordTrackedGridCellChange(current, rowId, field, oldValue, newValue));
      setLastEdit({ field, value: newValue });
    },
    [getRowId, isEditableField, isRowEditable],
  );

  const applyChangesToNodes = useCallback(
    (nodes: readonly IRowNode<TData>[], changes: TrackedGridChanges<TField, TValue>) => {
      /**
       * There are TWO intentionally separate phases below:
       *
       * 1. update our durable draft state by stable row ID;
       * 2. write the same values into currently loaded AG Grid RowNodes so the UI changes immediately.
       *
       * Keeping draft state first means the edit survives even if AG Grid later evicts/recreates the
       * node. Both phases apply the same row-editable check so read-only rows are untouched.
       */
      setState((current) => {
        let next = current;

        for (const node of nodes) {
          // A missing-data node is still loading. A read-only node is a real row but is not a legal
          // target for this programmatic edit action.
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

      // The RowNode write below is presentation/synchronisation with AG Grid. The real unsaved draft
      // has already been captured above by stable row ID.
      applyingProgrammaticChange.current = true;
      try {
        for (const node of nodes) {
          if (!node.data || (isRowEditable && !isRowEditable(node.data))) continue;

          for (const field of editableFields) {
            if (!hasTrackedGridField(changes, field)) continue;

            const nextValue = changes[field] as TValue;

            // Avoid unnecessary `setDataValue` calls because AG Grid can emit events/redraw even when
            // application code writes the same value again.
            if (!Object.is(getFieldValue(node.data, field), nextValue)) {
              node.setDataValue(field, nextValue, TRACKED_GRID_WRITE_SOURCE);
            }
          }
        }
      } finally {
        // Always clear the synchronous guard even if a custom value setter/editor throws.
        applyingProgrammaticChange.current = false;
      }
    },
    [editableFields, getFieldValue, getRowId, isRowEditable],
  );

  const restoreTrackedEdits = useCallback(
    (api: GridApi<TData>) => {
      /**
       * AG Grid calls our roots after model/page/cache changes. Newly created RowNodes contain fresh
       * backend data, so we reapply any still-unsaved draft for that stable row ID.
       *
       * We deliberately iterate ONLY currently loaded RowNodes. We never load missing server rows just
       * to restore drafts; when such a row appears later, this function will handle it then.
       */
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
   * Clear only the exact values that were successfully saved.
   *
   * If the user changes the same field again while a request is in flight, acknowledgement of the
   * older snapshot must NOT wipe out the newer draft.
   */
  const acknowledgeChanges = useCallback(
    (updates: TrackedGridUpdatePayload<TField, TValue>['updates']) => {
      setState((current) => acknowledgeTrackedGridChanges(current, updates));
    },
    [],
  );

  const restoreOriginalsForRows = useCallback(
    (api: GridApi<TData>, rowIds: ReadonlySet<string>) => {
      // Discard is another programmatic AG Grid write, so it uses the same guard/source mechanism as
      // bulk editing and restoration. Otherwise the restored original could become a new draft.
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

  /** Discard one row: restore loaded-cell values, then remove that row's durable draft. */
  const discardRow = useCallback(
    (api: GridApi<TData>, rowId: string) => {
      // Idempotency: once the row has no originals/draft left, a repeated Discard is a no-op.
      if (!state.originalsById[rowId]) return;

      restoreOriginalsForRows(api, new Set([rowId]));
      setState((current) => discardTrackedGridRow(current, rowId));
    },
    [restoreOriginalsForRows, state.originalsById],
  );

  /** Discard only the requested dirty rows. Other unsaved rows remain untouched. */
  const discardRows = useCallback(
    (api: GridApi<TData>, rowIds: readonly string[]) => {
      if (rowIds.length === 0) return;

      // Set gives cheap membership tests while iterating loaded AG Grid nodes and also naturally
      // collapses accidental duplicate row IDs from a caller.
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

  // Build the backend-friendly explicit update list only when draft state changes.
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
