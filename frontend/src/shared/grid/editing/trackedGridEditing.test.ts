import { describe, expect, it } from 'vitest';
import {
  acknowledgeTrackedGridChanges,
  createEmptyTrackedGridEditingState,
  discardTrackedGridRow,
  hasSelectedTrackedGridFieldConflict,
  hasTrackedGridUpdateConflict,
  reconcileTrackedGridRemoteValues,
  recordTrackedGridCellChange,
  resolveTrackedGridConflictWithLocal,
  resolveTrackedGridConflictWithRemote,
} from './trackedGridEditing';

type Field = 'status' | 'amount';
type Value = string | number;

describe('tracked grid edit persistence state', () => {
  it('removes a row when its last ordinary field returns to the original value', () => {
    let state = createEmptyTrackedGridEditingState<Field, Value>();
    state = recordTrackedGridCellChange(state, 'txn-a', 'status', 'Pending', 'Completed');
    state = recordTrackedGridCellChange(state, 'txn-a', 'status', 'Completed', 'Pending');

    expect(state.changesById).toEqual({});
    expect(state.originalsById).toEqual({});
    expect(state.conflictsById).toEqual({});
  });

  it('keeps a normal dirty field when refreshed server value still equals BASE', () => {
    let state = createEmptyTrackedGridEditingState<Field, Value>();
    state = recordTrackedGridCellChange(state, 'txn-a', 'status', 'Pending', 'Failed');
    state = reconcileTrackedGridRemoteValues(state, 'txn-a', { status: 'Pending' });

    expect(state.changesById['txn-a']).toEqual({ status: 'Failed' });
    expect(state.originalsById['txn-a']).toEqual({ status: 'Pending' });
    expect(state.conflictsById).toEqual({});
  });

  it('cleans a dirty field automatically when refreshed server value already equals LOCAL', () => {
    let state = createEmptyTrackedGridEditingState<Field, Value>();
    state = recordTrackedGridCellChange(state, 'txn-a', 'status', 'Pending', 'Failed');
    state = reconcileTrackedGridRemoteValues(state, 'txn-a', { status: 'Failed' });

    expect(state.changesById).toEqual({});
    expect(state.originalsById).toEqual({});
    expect(state.conflictsById).toEqual({});
  });

  it('marks only the divergent edited field as conflicted', () => {
    let state = createEmptyTrackedGridEditingState<Field, Value>();
    state = recordTrackedGridCellChange(state, 'txn-a', 'status', 'Pending', 'Failed');
    state = recordTrackedGridCellChange(state, 'txn-a', 'amount', 100, 150);
    state = reconcileTrackedGridRemoteValues(state, 'txn-a', {
      status: 'Completed',
      amount: 100,
    });

    expect(state.changesById['txn-a']).toEqual({ status: 'Failed', amount: 150 });
    expect(state.conflictsById['txn-a']).toEqual({
      status: { remoteValue: 'Completed' },
    });
  });

  it('Use server clears only the conflicted field', () => {
    let state = createEmptyTrackedGridEditingState<Field, Value>();
    state = recordTrackedGridCellChange(state, 'txn-a', 'status', 'Pending', 'Failed');
    state = recordTrackedGridCellChange(state, 'txn-a', 'amount', 100, 150);
    state = reconcileTrackedGridRemoteValues(state, 'txn-a', { status: 'Completed' });
    state = resolveTrackedGridConflictWithRemote(state, 'txn-a', 'status');

    expect(state.changesById['txn-a']).toEqual({ amount: 150 });
    expect(state.originalsById['txn-a']).toEqual({ amount: 100 });
    expect(state.conflictsById).toEqual({});
  });

  it('Keep my edit rebases BASE to REMOTE and keeps LOCAL dirty', () => {
    let state = createEmptyTrackedGridEditingState<Field, Value>();
    state = recordTrackedGridCellChange(state, 'txn-a', 'status', 'Pending', 'Failed');
    state = reconcileTrackedGridRemoteValues(state, 'txn-a', { status: 'Completed' });
    state = resolveTrackedGridConflictWithLocal(state, 'txn-a', 'status');

    expect(state.changesById['txn-a']).toEqual({ status: 'Failed' });
    expect(state.originalsById['txn-a']).toEqual({ status: 'Completed' });
    expect(state.conflictsById).toEqual({});
  });

  it('guards only mutations that target unresolved conflicts', () => {
    let state = createEmptyTrackedGridEditingState<Field, Value>();
    state = recordTrackedGridCellChange(state, 'txn-a', 'status', 'Pending', 'Failed');
    state = reconcileTrackedGridRemoteValues(state, 'txn-a', { status: 'Completed' });

    const update = [{ id: 'txn-a', changes: { status: 'Failed' } }];
    expect(hasTrackedGridUpdateConflict(state, update)).toBe(true);
    expect(
      hasSelectedTrackedGridFieldConflict(state, { mode: 'include', ids: ['txn-a'] }, ['status']),
    ).toBe(true);
    expect(
      hasSelectedTrackedGridFieldConflict(state, { mode: 'include', ids: ['txn-a'] }, ['amount']),
    ).toBe(false);
  });

  it('acknowledges a submitted value without clearing a newer in-flight edit', () => {
    let state = createEmptyTrackedGridEditingState<Field, Value>();
    state = recordTrackedGridCellChange(state, 'txn-a', 'status', 'Pending', 'Completed');
    const submitted = [{ id: 'txn-a', changes: { status: 'Completed' } }];

    state = recordTrackedGridCellChange(state, 'txn-a', 'status', 'Completed', 'Failed');
    state = acknowledgeTrackedGridChanges(state, submitted);

    expect(state.changesById['txn-a']).toEqual({ status: 'Failed' });
    expect(state.originalsById['txn-a']).toEqual({ status: 'Pending' });
  });

  it('discards only the requested row draft including conflict metadata', () => {
    let state = createEmptyTrackedGridEditingState<Field, Value>();
    state = recordTrackedGridCellChange(state, 'txn-a', 'status', 'Pending', 'Failed');
    state = reconcileTrackedGridRemoteValues(state, 'txn-a', { status: 'Completed' });
    state = recordTrackedGridCellChange(state, 'txn-b', 'amount', 100, 200);

    state = discardTrackedGridRow(state, 'txn-a');

    expect(state.changesById).toEqual({ 'txn-b': { amount: 200 } });
    expect(state.originalsById).toEqual({ 'txn-b': { amount: 100 } });
    expect(state.conflictsById).toEqual({});
  });
});
