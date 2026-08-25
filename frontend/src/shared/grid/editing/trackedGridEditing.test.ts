import { describe, expect, it } from 'vitest';
import {
  acknowledgeTrackedGridChanges,
  createEmptyTrackedGridEditingState,
  discardTrackedGridRow,
  recordTrackedGridCellChange,
} from './trackedGridEditing';

type Field = 'status' | 'amount';
type Value = string | number;

describe('tracked grid edit persistence state', () => {
  it('removes a row from pending changes when its last field returns to the original value', () => {
    let state = createEmptyTrackedGridEditingState<Field, Value>();

    state = recordTrackedGridCellChange(
      state,
      'txn-a',
      'status',
      'Pending',
      'Completed',
    );
    state = recordTrackedGridCellChange(
      state,
      'txn-a',
      'status',
      'Completed',
      'Pending',
    );

    expect(state.changesById).toEqual({});
    expect(state.originalsById).toEqual({});
  });

  it('acknowledges a submitted value without clearing a newer in-flight edit', () => {
    let state = createEmptyTrackedGridEditingState<Field, Value>();
    state = recordTrackedGridCellChange(
      state,
      'txn-a',
      'status',
      'Pending',
      'Completed',
    );

    const submitted = [{ id: 'txn-a', changes: { status: 'Completed' } }];

    state = recordTrackedGridCellChange(
      state,
      'txn-a',
      'status',
      'Completed',
      'Failed',
    );
    state = acknowledgeTrackedGridChanges(state, submitted);

    expect(state.changesById['txn-a']).toEqual({ status: 'Failed' });
    expect(state.originalsById['txn-a']).toEqual({ status: 'Pending' });
  });

  it('removes a saved value when it still matches the submitted request', () => {
    let state = createEmptyTrackedGridEditingState<Field, Value>();
    state = recordTrackedGridCellChange(
      state,
      'txn-a',
      'status',
      'Pending',
      'Completed',
    );

    state = acknowledgeTrackedGridChanges(state, [
      { id: 'txn-a', changes: { status: 'Completed' } },
    ]);

    expect(state.changesById).toEqual({});
    expect(state.originalsById).toEqual({});
  });

  it('discards only the requested row draft', () => {
    let state = createEmptyTrackedGridEditingState<Field, Value>();
    state = recordTrackedGridCellChange(
      state,
      'txn-a',
      'status',
      'Pending',
      'Completed',
    );
    state = recordTrackedGridCellChange(
      state,
      'txn-b',
      'amount',
      100,
      200,
    );

    state = discardTrackedGridRow(state, 'txn-a');

    expect(state.changesById).toEqual({
      'txn-b': { amount: 200 },
    });
    expect(state.originalsById).toEqual({
      'txn-b': { amount: 100 },
    });
  });
});
