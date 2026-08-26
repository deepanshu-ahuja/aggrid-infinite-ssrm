import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';

/** Changed values keyed by an editable field name. */
export type TrackedGridChanges<TField extends string, TValue> = Partial<Record<TField, TValue>>;

/**
 * Row-ID keyed edit state that survives AG Grid RowNode/cache recreation.
 *
 * `originalsById` remembers the first value seen for a changed field so returning to that value can
 * remove the field from the eventual update payload instead of producing a false edit.
 */
export interface TrackedGridEditingState<TField extends string, TValue> {
  changesById: Record<string, TrackedGridChanges<TField, TValue>>;
  originalsById: Record<string, TrackedGridChanges<TField, TValue>>;
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
 * Records one row/field transition without knowing anything about the feature that owns the row.
 *
 * This is the reusable state machine behind direct cell edits and programmatic bulk propagation:
 * - first edit captures the original value;
 * - later edits preserve that first original value;
 * - returning to the original value removes the edit;
 * - different fields accumulate under the same stable backend row ID.
 */
export function recordTrackedGridCellChange<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
  rowId: string,
  field: TField,
  oldValue: TValue,
  newValue: TValue,
): TrackedGridEditingState<TField, TValue> {
  if (Object.is(oldValue, newValue)) return state;

  /** Keep the mapped generic type when a row has no prior edits; raw `{}` loses indexed access. */
  const currentChanges: TrackedGridChanges<TField, TValue> = state.changesById[rowId] ?? {};
  const currentOriginals: TrackedGridChanges<TField, TValue> = state.originalsById[rowId] ?? {};

  if (hasTrackedGridField(currentChanges, field) && Object.is(currentChanges[field], newValue)) {
    return state;
  }

  const nextChanges: TrackedGridChanges<TField, TValue> = {
    ...currentChanges,
  };
  const nextOriginals: TrackedGridChanges<TField, TValue> = {
    ...currentOriginals,
  };

  const originalValue = hasTrackedGridField(currentOriginals, field)
    ? currentOriginals[field]
    : oldValue;

  if (!hasTrackedGridField(currentOriginals, field)) {
    nextOriginals[field] = oldValue;
  }

  if (Object.is(originalValue, newValue)) {
    delete nextChanges[field];
    delete nextOriginals[field];
  } else {
    nextChanges[field] = newValue;
  }

  const nextChangesById = { ...state.changesById };
  const nextOriginalsById = { ...state.originalsById };

  if (Object.keys(nextChanges).length === 0) {
    delete nextChangesById[rowId];
    delete nextOriginalsById[rowId];
  } else {
    nextChangesById[rowId] = nextChanges;
    nextOriginalsById[rowId] = nextOriginals;
  }

  return {
    changesById: nextChangesById,
    originalsById: nextOriginalsById,
  };
}

/**
 * Forget one row's local draft after the caller has restored its original values in any loaded RowNode.
 *
 * Discard is intentionally a local editing-state operation; there is no backend request because the
 * server never received the unsaved values.
 */
export function discardTrackedGridRow<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
  rowId: string,
): TrackedGridEditingState<TField, TValue> {
  if (!state.changesById[rowId]) return state;

  const changesById = { ...state.changesById };
  const originalsById = { ...state.originalsById };
  delete changesById[rowId];
  delete originalsById[rowId];

  return { changesById, originalsById };
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

    const remainingChanges: TrackedGridChanges<TField, TValue> = {
      ...currentChanges,
    };
    const remainingOriginals: TrackedGridChanges<TField, TValue> = {
      ...(nextState.originalsById[update.id] ?? {}),
    };

    for (const [field, submittedValue] of Object.entries(update.changes) as Array<
      [TField, TValue]
    >) {
      if (
        hasTrackedGridField(currentChanges, field) &&
        Object.is(currentChanges[field], submittedValue)
      ) {
        delete remainingChanges[field];
        delete remainingOriginals[field];
      }
    }

    const changesById = { ...nextState.changesById };
    const originalsById = { ...nextState.originalsById };

    if (Object.keys(remainingChanges).length === 0) {
      delete changesById[update.id];
      delete originalsById[update.id];
    } else {
      changesById[update.id] = remainingChanges;
      originalsById[update.id] = remainingOriginals;
    }

    nextState = { changesById, originalsById };
  }

  return nextState;
}

/** Every row that currently contains at least one real local change. */
export function buildTrackedGridUpdatePayload<TField extends string, TValue>(
  state: TrackedGridEditingState<TField, TValue>,
): TrackedGridUpdatePayload<TField, TValue> {
  return {
    updates: Object.entries(state.changesById).map(([id, changes]) => ({
      id,
      changes,
    })),
  };
}

/** Tests membership without materialising rows that are not already represented by an ID. */
export function isGridRowIdSelected(selection: ServerSelectionIntent<string>, id: string) {
  const ids = new Set(selection.ids);
  return selection.mode === 'include' ? ids.has(id) : !ids.has(id);
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
