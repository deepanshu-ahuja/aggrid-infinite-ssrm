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
 * `originalsById` = BASE value captured when the field first became dirty.
 * `changesById`   = LOCAL unsaved value that the user currently sees.
 * `conflictsById` = latest REMOTE value only when it diverges from both BASE and LOCAL.
 *
 * The state is intentionally field-level. One server-changed cell must not turn unrelated edits in the
 * same row into conflicts, and we do not duplicate whole server rows in React state.
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

/**
 * Central cleanup path for one logical field edit.
 *
 * Manual revert, server convergence, `Use server`, and save acknowledgement all mean the field is clean.
 * Keeping that transition here prevents stale BASE/REMOTE metadata from surviving after LOCAL is gone.
 */
function removeTrackedGridField<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
  rowId: string,
  field: TField,
): TrackedGridEditingState<TField, TValue> {
  const currentChanges = state.changesById[rowId];
  if (!currentChanges || !hasTrackedGridField(currentChanges, field)) return state;

  // Explicit annotations preserve TField indexing under strict TypeScript when the fallback is `{}`.
  const changes: TrackedGridChanges<TField, TValue> = { ...currentChanges };
  const originals: TrackedGridChanges<TField, TValue> = {
    ...(state.originalsById[rowId] ?? {}),
  };
  const conflicts: TrackedGridConflicts<TField, TValue> = {
    ...(state.conflictsById[rowId] ?? {}),
  };

  // A field is one unit of edit state: LOCAL, BASE, and REMOTE are cleared together.
  delete changes[field];
  delete originals[field];
  delete conflicts[field];

  const changesById = { ...state.changesById };
  const originalsById = { ...state.originalsById };
  const conflictsById = { ...state.conflictsById };

  if (Object.keys(changes).length === 0) {
    // No dirty fields remain, so remove the row instead of keeping empty map entries around.
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
 * Record one user/programmatic edit without knowing the owning feature's row shape.
 *
 * BASE is captured only on the first transition away from the server value. Later edits change LOCAL
 * but keep that first BASE so A -> B -> C -> A is recognised as a complete manual revert.
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
    // During a conflict, directly choosing the current REMOTE value has the same meaning as `Use server`.
    return removeTrackedGridField(state, rowId, field);
  }

  if (hasTrackedGridField(currentChanges, field) && Object.is(currentChanges[field], newValue)) {
    // AG Grid can emit an idempotent change event. Do not manufacture a new state object for it.
    return state;
  }

  const nextChanges: TrackedGridChanges<TField, TValue> = { ...currentChanges };
  const nextOriginals: TrackedGridChanges<TField, TValue> = { ...currentOriginals };
  const nextConflicts: TrackedGridConflicts<TField, TValue> = { ...currentConflicts };

  const originalValue = hasTrackedGridField(currentOriginals, field)
    ? currentOriginals[field]
    : oldValue;

  if (!hasTrackedGridField(currentOriginals, field)) {
    // First dirty transition: this old value is the BASE used by future refresh reconciliation.
    nextOriginals[field] = oldValue;
  }

  if (!conflict && Object.is(originalValue, newValue)) {
    // Ordinary edit returned to BASE. It is no longer dirty and needs no reconciliation metadata.
    delete nextChanges[field];
    delete nextOriginals[field];
  } else {
    // New/continued draft. An existing conflict deliberately remains unresolved until an explicit choice.
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
 * Three-way reconciliation for genuinely refreshed server values.
 *
 * For each dirty field:
 * BASE   = value when the field first became dirty
 * LOCAL  = current unsaved value
 * REMOTE = latest authoritative server value
 *
 * Only dirty fields participate. Unedited fields continue to render directly from the refreshed row.
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
      // REMOTE == LOCAL: the backend already contains the user's desired value. Leaving it dirty would
      // create a fake unsaved change, so clean the field automatically with no conflict UI.
      nextState = removeTrackedGridField(nextState, rowId, candidateField);
      continue;
    }

    const conflictsById = { ...nextState.conflictsById };
    const rowConflicts: TrackedGridConflicts<TField, TValue> = {
      ...(conflictsById[rowId] ?? {}),
    };

    if (Object.is(remoteValue, baseValue)) {
      // REMOTE == BASE: refresh occurred but the server did not modify this field. LOCAL remains an
      // ordinary dirty draft. If an earlier conflict existed and the server moved back to BASE, clear it.
      delete rowConflicts[candidateField];
    } else {
      // REMOTE differs from both BASE and LOCAL: two independent edits compete for the same field.
      // Keep LOCAL visible, remember REMOTE for the resolver, and let mutation guards block persistence.
      rowConflicts[candidateField] = { remoteValue };
    }

    if (Object.keys(rowConflicts).length === 0) delete conflictsById[rowId];
    else conflictsById[rowId] = rowConflicts;

    nextState = { ...nextState, conflictsById };
  }

  return nextState;
}

/** Accept REMOTE for one conflicted field; LOCAL/BASE/REMOTE state is no longer needed afterward. */
export function resolveTrackedGridConflictWithRemote<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
  rowId: string,
  field: TField,
): TrackedGridEditingState<TField, TValue> {
  if (!state.conflictsById[rowId]?.[field]) return state;
  return removeTrackedGridField(state, rowId, field);
}

/**
 * Keep LOCAL intentionally after the user has reviewed REMOTE.
 *
 * REMOTE becomes the new BASE and the conflict marker clears. LOCAL intentionally remains dirty so a
 * later Save is a deliberate overwrite of the reviewed server value, not an accidental stale write.
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
    // Rebase to the value the user just reviewed, otherwise the same server value would conflict again.
    [field]: conflict.remoteValue,
  };

  const conflictsById = { ...state.conflictsById };
  const rowConflicts: TrackedGridConflicts<TField, TValue> = {
    ...(conflictsById[rowId] ?? {}),
  };

  // LOCAL stays in `changesById`; only the unresolved conflict is cleared.
  delete rowConflicts[field];
  if (Object.keys(rowConflicts).length === 0) delete conflictsById[rowId];
  else conflictsById[rowId] = rowConflicts;

  return { ...state, originalsById, conflictsById };
}

/** Forget one row's tracked state after the caller restores authoritative values into loaded RowNodes. */
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
 * Acknowledge only exact values that actually succeeded on the backend.
 *
 * If the user edits the same field again while the request is in flight, the newer LOCAL value must
 * remain dirty rather than being erased by the older response.
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

/** True when an explicit update set contains at least one row with an unresolved field conflict. */
export function hasTrackedGridUpdateConflict<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
  updates: TrackedGridUpdatePayload<TField, TValue>['updates'],
) {
  return updates.some((update) => hasTrackedGridRowConflict(state, update.id));
}

/**
 * Selection-wide business actions are blocked only when they touch an actually conflicted field.
 * Example: a status action is blocked by a selected `status` conflict, but not by an unrelated amount
 * conflict. This avoids turning "row has any conflict" into an unnecessarily broad global lock.
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
 * Intersect accumulated edits with logical include/exclude selection.
 *
 * Conflicted rows deliberately remain in this payload. The caller then checks
 * `hasTrackedGridUpdateConflict` and blocks the entire aggregate Save. Silently dropping conflicted rows
 * here would create surprising partial-save behaviour.
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
