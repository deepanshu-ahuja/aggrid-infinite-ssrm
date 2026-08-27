import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';

/** Changed values keyed by an editable field name. */
export type TrackedGridChanges<TField extends string, TValue> = Partial<Record<TField, TValue>>;

/** Latest authoritative server value for one locally edited field that diverged from its baseline. */
export interface TrackedGridConflict<TValue> {
  remoteValue: TValue;
}

export type TrackedGridConflicts<TField extends string, TValue> = Partial<
  Record<TField, TrackedGridConflict<TValue>>
>;

/**
 * Row-ID keyed edit state that survives AG Grid RowNode/cache recreation.
 *
 * `originalsById` is the BASE value captured when a field first became dirty. `changesById` is the
 * current LOCAL value. `conflictsById` exists only when a later authoritative refresh supplies a REMOTE
 * value that differs from both BASE and LOCAL. Keeping these three concerns separate makes refresh
 * reconciliation field-level instead of turning an otherwise valid row into one opaque conflict.
 */
export interface TrackedGridEditingState<TField extends string, TValue> {
  changesById: Record<string, TrackedGridChanges<TField, TValue>>;
  originalsById: Record<string, TrackedGridChanges<TField, TValue>>;
  conflictsById: Record<string, TrackedGridConflicts<TField, TValue>>;
}

export interface TrackedGridLastEdit<TField extends string, TValue> {
  field: TField;
  value: TValue;
}

export interface TrackedGridUpdatePayload<TField extends string, TValue> {
  updates: Array<{
    id: string;
    changes: TrackedGridChanges<TField, TValue>;
  }>;
}

export function createEmptyTrackedGridEditingState<
  TField extends string,
  TValue,
>(): TrackedGridEditingState<TField, TValue> {
  return {
    changesById: {},
    originalsById: {},
    conflictsById: {},
  };
}

/** Distinguishes an omitted field from a field whose value itself may be `undefined`. */
export function hasTrackedGridField<TField extends string, TValue>(
  values: TrackedGridChanges<TField, TValue>,
  field: TField,
) {
  return Object.prototype.hasOwnProperty.call(values, field);
}

function removeTrackedGridField<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
  rowId: string,
  field: TField,
): TrackedGridEditingState<TField, TValue> {
  const currentChanges = state.changesById[rowId];
  if (!currentChanges || !hasTrackedGridField(currentChanges, field)) return state;

  // Keep these clones explicitly typed. Generic object spread with an empty fallback otherwise narrows
  // to `{}` and loses the TField index signature under strict TypeScript checking.
  const changes: TrackedGridChanges<TField, TValue> = { ...currentChanges };
  const originals: TrackedGridChanges<TField, TValue> = {
    ...(state.originalsById[rowId] ?? {}),
  };
  const conflicts: TrackedGridConflicts<TField, TValue> = {
    ...(state.conflictsById[rowId] ?? {}),
  };
  delete changes[field];
  delete originals[field];
  delete conflicts[field];

  const changesById = { ...state.changesById };
  const originalsById = { ...state.originalsById };
  const conflictsById = { ...state.conflictsById };

  if (Object.keys(changes).length === 0) {
    delete changesById[rowId];
    delete originalsById[rowId];
    delete conflictsById[rowId];
  } else {
    changesById[rowId] = changes;
    originalsById[rowId] = originals;
    if (Object.keys(conflicts).length === 0) delete conflictsById[rowId];
    else conflictsById[rowId] = conflicts;
  }

  return { changesById, originalsById, conflictsById };
}

/**
 * Records one row/field transition without knowing anything about the feature that owns the row.
 *
 * This is the reusable state machine behind direct cell edits and programmatic bulk propagation:
 * - first edit captures the original value;
 * - later edits preserve that first original value;
 * - returning to the original value removes an ordinary non-conflicted edit;
 * - different fields accumulate under the same stable backend row ID.
 *
 * If the field is already conflicted, the REMOTE value becomes an additional meaningful reference.
 * Editing directly to that REMOTE value resolves the conflict and removes the draft. Other values remain
 * an explicit local choice until the user resolves the conflict through the feature UI.
 */
export function recordTrackedGridCellChange<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
  rowId: string,
  field: TField,
  oldValue: TValue,
  newValue: TValue,
): TrackedGridEditingState<TField, TValue> {
  if (Object.is(oldValue, newValue)) return state;

  const currentChanges: TrackedGridChanges<TField, TValue> = state.changesById[rowId] ?? {};
  const currentOriginals: TrackedGridChanges<TField, TValue> = state.originalsById[rowId] ?? {};
  const currentConflicts: TrackedGridConflicts<TField, TValue> = state.conflictsById[rowId] ?? {};
  const conflict = currentConflicts[field];

  if (conflict && Object.is(conflict.remoteValue, newValue)) {
    return removeTrackedGridField(state, rowId, field);
  }

  if (hasTrackedGridField(currentChanges, field) && Object.is(currentChanges[field], newValue)) {
    return state;
  }

  const nextChanges: TrackedGridChanges<TField, TValue> = { ...currentChanges };
  const nextOriginals: TrackedGridChanges<TField, TValue> = { ...currentOriginals };
  const nextConflicts: TrackedGridConflicts<TField, TValue> = { ...currentConflicts };

  const originalValue = hasTrackedGridField(currentOriginals, field)
    ? currentOriginals[field]
    : oldValue;

  if (!hasTrackedGridField(currentOriginals, field)) {
    nextOriginals[field] = oldValue;
  }

  if (!conflict && Object.is(originalValue, newValue)) {
    delete nextChanges[field];
    delete nextOriginals[field];
  } else {
    nextChanges[field] = newValue;
  }

  const changesById = { ...state.changesById };
  const originalsById = { ...state.originalsById };
  const conflictsById = { ...state.conflictsById };

  if (Object.keys(nextChanges).length === 0) {
    delete changesById[rowId];
    delete originalsById[rowId];
    delete conflictsById[rowId];
  } else {
    changesById[rowId] = nextChanges;
    originalsById[rowId] = nextOriginals;
    if (Object.keys(nextConflicts).length === 0) delete conflictsById[rowId];
    else conflictsById[rowId] = nextConflicts;
  }

  return { changesById, originalsById, conflictsById };
}

/**
 * Reconcile fresh authoritative values with the fields that already have local drafts.
 *
 * Per edited field:
 * - REMOTE === BASE: the server did not change our baseline; keep LOCAL dirty and clear stale conflict.
 * - REMOTE === LOCAL: the server already contains the desired value; clear the draft automatically.
 * - otherwise: retain LOCAL, remember REMOTE, and mark only that field conflicted.
 *
 * The caller supplies only values from a freshly materialised server row. Unedited fields are not copied
 * into React state and continue to render directly from AG Grid's server-backed row data.
 */
export function reconcileTrackedGridRemoteValues<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
  rowId: string,
  remoteValues: TrackedGridChanges<TField, TValue>,
): TrackedGridEditingState<TField, TValue> {
  const currentChanges = state.changesById[rowId];
  const currentOriginals = state.originalsById[rowId];
  if (!currentChanges || !currentOriginals) return state;

  let nextState = state;

  for (const [candidateField, remoteValue] of Object.entries(remoteValues) as Array<
    [TField, TValue]
  >) {
    const changes = nextState.changesById[rowId];
    const originals = nextState.originalsById[rowId];
    if (!changes || !originals || !hasTrackedGridField(changes, candidateField)) continue;

    const localValue = changes[candidateField] as TValue;
    const baseValue = originals[candidateField] as TValue;

    if (Object.is(remoteValue, localValue)) {
      nextState = removeTrackedGridField(nextState, rowId, candidateField);
      continue;
    }

    const conflictsById = { ...nextState.conflictsById };
    const rowConflicts: TrackedGridConflicts<TField, TValue> = {
      ...(conflictsById[rowId] ?? {}),
    };

    if (Object.is(remoteValue, baseValue)) {
      delete rowConflicts[candidateField];
    } else {
      rowConflicts[candidateField] = { remoteValue };
    }

    if (Object.keys(rowConflicts).length === 0) delete conflictsById[rowId];
    else conflictsById[rowId] = rowConflicts;

    nextState = { ...nextState, conflictsById };
  }

  return nextState;
}

/** Accept the current authoritative server value for one conflicted field and forget its local draft. */
export function resolveTrackedGridConflictWithRemote<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
  rowId: string,
  field: TField,
): TrackedGridEditingState<TField, TValue> {
  if (!state.conflictsById[rowId]?.[field]) return state;
  return removeTrackedGridField(state, rowId, field);
}

/**
 * Keep the user's local value intentionally after reviewing a conflict.
 *
 * The latest REMOTE value becomes the new BASE, the conflict marker clears, and LOCAL stays dirty so a
 * later Save is an explicit overwrite decision rather than an accidental stale write.
 */
export function resolveTrackedGridConflictWithLocal<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
  rowId: string,
  field: TField,
): TrackedGridEditingState<TField, TValue> {
  const conflict = state.conflictsById[rowId]?.[field];
  const changes = state.changesById[rowId];
  if (!conflict || !changes || !hasTrackedGridField(changes, field)) return state;

  const originalsById = { ...state.originalsById };
  originalsById[rowId] = {
    ...(originalsById[rowId] ?? {}),
    [field]: conflict.remoteValue,
  };

  const conflictsById = { ...state.conflictsById };
  const rowConflicts: TrackedGridConflicts<TField, TValue> = {
    ...(conflictsById[rowId] ?? {}),
  };
  delete rowConflicts[field];
  if (Object.keys(rowConflicts).length === 0) delete conflictsById[rowId];
  else conflictsById[rowId] = rowConflicts;

  return { ...state, originalsById, conflictsById };
}

/** Forget one row's local draft after the caller has restored authoritative values in loaded RowNodes. */
export function discardTrackedGridRow<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
  rowId: string,
): TrackedGridEditingState<TField, TValue> {
  if (!state.changesById[rowId]) return state;

  const changesById = { ...state.changesById };
  const originalsById = { ...state.originalsById };
  const conflictsById = { ...state.conflictsById };
  delete changesById[rowId];
  delete originalsById[rowId];
  delete conflictsById[rowId];

  return { changesById, originalsById, conflictsById };
}

/**
 * Remove only values that were actually included in a successful save request.
 *
 * A user can edit the same row again while a network request is in flight. Clearing the whole row on
 * success would lose that newer local change. A field is therefore acknowledged only when the current
 * tracked value still equals the submitted value; newer values remain dirty for the next save.
 */
export function acknowledgeTrackedGridChanges<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
  updates: TrackedGridUpdatePayload<TField, TValue>['updates'],
): TrackedGridEditingState<TField, TValue> {
  let nextState = state;

  for (const update of updates) {
    const currentChanges = nextState.changesById[update.id];
    if (!currentChanges) continue;

    for (const [field, submittedValue] of Object.entries(update.changes) as Array<
      [TField, TValue]
    >) {
      const latestChanges = nextState.changesById[update.id];
      if (
        latestChanges &&
        hasTrackedGridField(latestChanges, field) &&
        Object.is(latestChanges[field], submittedValue)
      ) {
        nextState = removeTrackedGridField(nextState, update.id, field);
      }
    }
  }

  return nextState;
}

/** Every row that currently contains at least one real local change. */
export function buildTrackedGridUpdatePayload<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
): TrackedGridUpdatePayload<TField, TValue> {
  return {
    updates: Object.entries(state.changesById).map(([id, changes]) => ({ id, changes })),
  };
}

export function hasTrackedGridFieldConflict<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
  rowId: string,
  field: TField,
) {
  return Boolean(state.conflictsById[rowId]?.[field]);
}

export function hasTrackedGridRowConflict<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
  rowId: string,
) {
  return Boolean(state.conflictsById[rowId] && Object.keys(state.conflictsById[rowId]).length > 0);
}

export function getTrackedGridConflictCount<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
) {
  return Object.values(state.conflictsById).reduce(
    (count, conflicts) => count + Object.keys(conflicts).length,
    0,
  );
}

/** Tests membership without materialising rows that are not already represented by an ID. */
export function isGridRowIdSelected(selection: ServerSelectionIntent<string>, id: string) {
  const ids = new Set(selection.ids);
  return selection.mode === 'include' ? ids.has(id) : !ids.has(id);
}

/** True when the requested explicit updates contain at least one row with unresolved conflicts. */
export function hasTrackedGridUpdateConflict<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
  updates: TrackedGridUpdatePayload<TField, TValue>['updates'],
) {
  return updates.some((update) => hasTrackedGridRowConflict(state, update.id));
}

/**
 * Selection-wide business actions can be allowed when they do not touch the conflicted field.
 * Only locally tracked conflicts can be inspected here; unloaded rows without local drafts are not
 * represented and therefore need no frontend conflict resolution.
 */
export function hasSelectedTrackedGridFieldConflict<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
  selection: ServerSelectionIntent<string>,
  fields: readonly TField[],
) {
  const fieldSet = new Set(fields);
  return Object.entries(state.conflictsById).some(
    ([rowId, conflicts]) =>
      isGridRowIdSelected(selection, rowId) &&
      Object.keys(conflicts).some((field) => fieldSet.has(field as TField)),
  );
}

/**
 * Intersects accumulated edits with logical include/exclude selection.
 *
 * This is production-capable behavior, not a developer-preview concern. A real Save/Bulk Update UI
 * can use the same helper and then let its feature map the selected edits into its backend contract.
 */
export function buildSelectedTrackedGridUpdatePayload<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
  selection: ServerSelectionIntent<string>,
): TrackedGridUpdatePayload<TField, TValue> {
  return {
    updates: Object.entries(state.changesById)
      .filter(([id]) => isGridRowIdSelected(selection, id))
      .map(([id, changes]) => ({ id, changes })),
  };
}
