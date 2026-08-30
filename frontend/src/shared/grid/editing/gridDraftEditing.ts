// GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-SAVE-ROW | GRIDCAP-EDIT-SAVE-SELECTED | GRIDCAP-EDIT-DISCARD | GRIDCAP-COUNT-EDITED | GRIDCAP-SEL-TARGET
import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';

export interface GridDraftCell<TValue> {
  /** Server/grid value seen when this field first became dirty. */
  baseValue: TValue;
  /** Latest unsaved value entered through AG Grid editing. */
  value: TValue;
}

export type GridDraftFields<TField extends string, TValue> = Partial<
  Record<TField, GridDraftCell<TValue>>
>;

export interface GridDraftRow<TField extends string, TValue> {
  fields: GridDraftFields<TField, TValue>;
  /** O(1) row-local count so reverting one field never scans every dirty row. */
  dirtyFieldCount: number;
}

/**
 * BASE + LOCAL only.
 *
 * Unlike `TrackedGridEditingState`, this state deliberately has no REMOTE/conflict layer and no copy
 * of fetched server blocks. AG Grid owns loaded row data; this map exists only for fields the user
 * actually changed so unsaved values survive SSRM RowNode/store recreation.
 */
export interface GridDraftEditingState<TField extends string, TValue> {
  draftsById: Record<string, GridDraftRow<TField, TValue>>;
  dirtyRowCount: number;
  dirtyCellCount: number;
}

export interface GridDraftUpdatePayload<TField extends string, TValue> {
  updates: Array<{
    id: string;
    changes: Partial<Record<TField, TValue>>;
  }>;
}

export function createEmptyGridDraftEditingState<
  TField extends string,
  TValue,
>(): GridDraftEditingState<TField, TValue> {
  return {
    draftsById: {},
    dirtyRowCount: 0,
    dirtyCellCount: 0,
  };
}

function hasOwnField<TField extends string, TValue>(
  fields: GridDraftFields<TField, TValue>,
  field: TField,
) {
  return Object.prototype.hasOwnProperty.call(fields, field);
}

export function hasGridDraftRow<TField extends string, TValue>(
  state: GridDraftEditingState<TField, TValue>,
  rowId: string,
) {
  return Boolean(state.draftsById[rowId]);
}

export function hasGridDraftField<TField extends string, TValue>(
  state: GridDraftEditingState<TField, TValue>,
  rowId: string,
  field: TField,
) {
  const row = state.draftsById[rowId];
  return Boolean(row && hasOwnField(row.fields, field));
}

function removeGridDraftField<TField extends string, TValue>(
  state: GridDraftEditingState<TField, TValue>,
  rowId: string,
  field: TField,
): GridDraftEditingState<TField, TValue> {
  const row = state.draftsById[rowId];
  if (!row || !hasOwnField(row.fields, field)) return state;

  const fields: GridDraftFields<TField, TValue> = { ...row.fields };
  delete fields[field];

  const nextDirtyFieldCount = row.dirtyFieldCount - 1;
  const draftsById = { ...state.draftsById };

  if (nextDirtyFieldCount === 0) {
    delete draftsById[rowId];
    return {
      draftsById,
      dirtyRowCount: state.dirtyRowCount - 1,
      dirtyCellCount: state.dirtyCellCount - 1,
    };
  }

  draftsById[rowId] = {
    fields,
    dirtyFieldCount: nextDirtyFieldCount,
  };

  return {
    draftsById,
    dirtyRowCount: state.dirtyRowCount,
    dirtyCellCount: state.dirtyCellCount - 1,
  };
}

/**
 * Record one committed AG Grid cell change.
 *
 * First edit:   BASE=oldValue, LOCAL=newValue.
 * Later edits:  BASE stays unchanged, LOCAL moves.
 * Back to BASE: remove only this field; remove the row only when its last dirty field is gone.
 */
export function recordGridDraftCellChange<TField extends string, TValue>(
  state: GridDraftEditingState<TField, TValue>,
  rowId: string,
  field: TField,
  oldValue: TValue,
  newValue: TValue,
): GridDraftEditingState<TField, TValue> {
  if (Object.is(oldValue, newValue)) return state;

  const row = state.draftsById[rowId];
  const existing = row?.fields[field];

  if (existing) {
    if (Object.is(existing.value, newValue)) return state;
    if (Object.is(existing.baseValue, newValue)) {
      return removeGridDraftField(state, rowId, field);
    }

    const fields: GridDraftFields<TField, TValue> = {
      ...row.fields,
      [field]: {
        baseValue: existing.baseValue,
        value: newValue,
      },
    };

    return {
      ...state,
      draftsById: {
        ...state.draftsById,
        [rowId]: {
          fields,
          dirtyFieldCount: row.dirtyFieldCount,
        },
      },
    };
  }

  const fields: GridDraftFields<TField, TValue> = {
    ...(row?.fields ?? {}),
    [field]: { baseValue: oldValue, value: newValue },
  };

  return {
    draftsById: {
      ...state.draftsById,
      [rowId]: {
        fields,
        dirtyFieldCount: (row?.dirtyFieldCount ?? 0) + 1,
      },
    },
    dirtyRowCount: state.dirtyRowCount + (row ? 0 : 1),
    dirtyCellCount: state.dirtyCellCount + 1,
  };
}

function buildRowChanges<TField extends string, TValue>(
  row: GridDraftRow<TField, TValue>,
): Partial<Record<TField, TValue>> {
  const changes: Partial<Record<TField, TValue>> = {};

  for (const [candidateField, draft] of Object.entries(row.fields) as Array<
    [TField, GridDraftCell<TValue>]
  >) {
    changes[candidateField] = draft.value;
  }

  return changes;
}

export function buildGridDraftUpdatePayload<TField extends string, TValue>(
  state: GridDraftEditingState<TField, TValue>,
): GridDraftUpdatePayload<TField, TValue> {
  return {
    updates: Object.entries(state.draftsById).map(([id, row]) => ({
      id,
      changes: buildRowChanges(row),
    })),
  };
}

/**
 * Build selected ∩ dirty without materialising unloaded SSRM rows.
 *
 * Include mode tests explicit selected IDs. Exclude mode tests only the finite set of dirty IDs
 * against the selection exceptions, so dataset-wide selection stays cheap even for huge datasets.
 */
export function buildSelectedGridDraftUpdatePayload<TField extends string, TValue>(
  state: GridDraftEditingState<TField, TValue>,
  selection: ServerSelectionIntent<string>,
): GridDraftUpdatePayload<TField, TValue> {
  const selectionIds = new Set(selection.ids);
  const updates: GridDraftUpdatePayload<TField, TValue>['updates'] = [];

  for (const [id, row] of Object.entries(state.draftsById)) {
    const selected =
      selection.mode === 'include' ? selectionIds.has(id) : !selectionIds.has(id);

    if (selected) {
      updates.push({
        id,
        changes: buildRowChanges(row),
      });
    }
  }

  return { updates };
}

/** Remove one complete row draft in O(1) using the row's tracked dirty-field count. */
export function discardGridDraftRow<TField extends string, TValue>(
  state: GridDraftEditingState<TField, TValue>,
  rowId: string,
): GridDraftEditingState<TField, TValue> {
  const row = state.draftsById[rowId];
  if (!row) return state;

  const draftsById = { ...state.draftsById };
  delete draftsById[rowId];

  return {
    draftsById,
    dirtyRowCount: state.dirtyRowCount - 1,
    dirtyCellCount: state.dirtyCellCount - row.dirtyFieldCount,
  };
}

export function discardGridDraftRows<TField extends string, TValue>(
  state: GridDraftEditingState<TField, TValue>,
  rowIds: readonly string[],
): GridDraftEditingState<TField, TValue> {
  let nextState = state;
  for (const rowId of rowIds) nextState = discardGridDraftRow(nextState, rowId);
  return nextState;
}

/**
 * Acknowledge only the values that actually reached the backend.
 *
 * If the user edited again while Save was in flight, keep the newer LOCAL value but rebase BASE to the
 * submitted value that is now authoritative. This keeps later "back to base" detection correct without
 * introducing a REMOTE/conflict store.
 */
export function acknowledgeGridDraftChanges<TField extends string, TValue>(
  state: GridDraftEditingState<TField, TValue>,
  updates: GridDraftUpdatePayload<TField, TValue>['updates'],
): GridDraftEditingState<TField, TValue> {
  let nextState = state;

  for (const update of updates) {
    for (const [candidateField, submittedValue] of Object.entries(update.changes) as Array<
      [TField, TValue]
    >) {
      const row = nextState.draftsById[update.id];
      const current = row?.fields[candidateField];
      if (!row || !current) continue;

      if (Object.is(current.value, submittedValue)) {
        nextState = removeGridDraftField(nextState, update.id, candidateField);
        continue;
      }

      const fields: GridDraftFields<TField, TValue> = {
        ...row.fields,
        [candidateField]: {
          baseValue: submittedValue,
          value: current.value,
        },
      };

      nextState = {
        ...nextState,
        draftsById: {
          ...nextState.draftsById,
          [update.id]: {
            fields,
            dirtyFieldCount: row.dirtyFieldCount,
          },
        },
      };
    }
  }

  return nextState;
}
