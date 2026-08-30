// GRIDCAP-EDIT-TRACKED | GRIDCAP-EDIT-SAVE-SELECTED | GRIDCAP-EDIT-DISCARD | GRIDCAP-COUNT-EDITED | GRIDCAP-SEL-TARGET
import { describe, expect, it } from 'vitest';
import {
  acknowledgeGridDraftChanges,
  buildSelectedGridDraftUpdatePayload,
  createEmptyGridDraftEditingState,
  discardGridDraftRow,
  recordGridDraftCellChange,
} from './gridDraftEditing';

type Field = 'account' | 'amount' | 'status';
type Value = string | number | null;

describe('grid draft editing state', () => {
  it('captures BASE once while later edits move only LOCAL', () => {
    let state = createEmptyGridDraftEditingState<Field, Value>();

    state = recordGridDraftCellChange(state, 'txn-1', 'amount', 100, 500);
    state = recordGridDraftCellChange(state, 'txn-1', 'amount', 500, 600);

    expect(state.draftsById['txn-1']?.fields.amount).toEqual({
      baseValue: 100,
      value: 600,
    });
    expect(state.dirtyRowCount).toBe(1);
    expect(state.dirtyCellCount).toBe(1);
  });

  it('tracks two dirty fields in one row without increasing the dirty-row count twice', () => {
    let state = createEmptyGridDraftEditingState<Field, Value>();

    state = recordGridDraftCellChange(state, 'txn-1', 'amount', 100, 500);
    state = recordGridDraftCellChange(state, 'txn-1', 'status', 'Pending', 'Completed');

    expect(state.draftsById['txn-1']?.dirtyFieldCount).toBe(2);
    expect(state.dirtyRowCount).toBe(1);
    expect(state.dirtyCellCount).toBe(2);
  });

  it('removes only the reverted field and removes the row when its last field returns to BASE', () => {
    let state = createEmptyGridDraftEditingState<Field, Value>();

    state = recordGridDraftCellChange(state, 'txn-1', 'amount', 100, 500);
    state = recordGridDraftCellChange(state, 'txn-1', 'status', 'Pending', 'Completed');

    state = recordGridDraftCellChange(state, 'txn-1', 'amount', 500, 100);
    expect(state.draftsById['txn-1']?.fields).toEqual({
      status: { baseValue: 'Pending', value: 'Completed' },
    });
    expect(state.dirtyRowCount).toBe(1);
    expect(state.dirtyCellCount).toBe(1);

    state = recordGridDraftCellChange(state, 'txn-1', 'status', 'Completed', 'Pending');
    expect(state.draftsById).toEqual({});
    expect(state.dirtyRowCount).toBe(0);
    expect(state.dirtyCellCount).toBe(0);
  });

  it('builds Save Selected as selected intersect dirty', () => {
    let state = createEmptyGridDraftEditingState<Field, Value>();
    state = recordGridDraftCellChange(state, 'txn-1', 'amount', 100, 150);
    state = recordGridDraftCellChange(state, 'txn-5', 'account', 'A', 'B');
    state = recordGridDraftCellChange(state, 'txn-9', 'status', 'Pending', 'Failed');

    const payload = buildSelectedGridDraftUpdatePayload(state, {
      mode: 'include',
      ids: ['txn-1', 'txn-2', 'txn-3', 'txn-4', 'txn-5', 'txn-6', 'txn-7', 'txn-8', 'txn-10', 'txn-11'],
    });

    expect(payload).toEqual({
      updates: [
        { id: 'txn-1', changes: { amount: 150 } },
        { id: 'txn-5', changes: { account: 'B' } },
      ],
    });
  });

  it('supports SSRM exclude/select-all intent without materialising the selected dataset', () => {
    let state = createEmptyGridDraftEditingState<Field, Value>();
    state = recordGridDraftCellChange(state, 'txn-1', 'amount', 100, 150);
    state = recordGridDraftCellChange(state, 'txn-2', 'amount', 200, 250);

    const payload = buildSelectedGridDraftUpdatePayload(state, {
      mode: 'exclude',
      ids: ['txn-2'],
    });

    expect(payload).toEqual({
      updates: [{ id: 'txn-1', changes: { amount: 150 } }],
    });
  });

  it('acknowledges an exact saved value by removing its draft', () => {
    let state = createEmptyGridDraftEditingState<Field, Value>();
    state = recordGridDraftCellChange(state, 'txn-1', 'amount', 100, 500);

    state = acknowledgeGridDraftChanges(state, [
      { id: 'txn-1', changes: { amount: 500 } },
    ]);

    expect(state.draftsById).toEqual({});
    expect(state.dirtyRowCount).toBe(0);
    expect(state.dirtyCellCount).toBe(0);
  });

  it('rebases BASE when the user edits again while Save is in flight', () => {
    let state = createEmptyGridDraftEditingState<Field, Value>();
    state = recordGridDraftCellChange(state, 'txn-1', 'amount', 100, 500);
    const submitted = [{ id: 'txn-1', changes: { amount: 500 } }];

    state = recordGridDraftCellChange(state, 'txn-1', 'amount', 500, 600);
    state = acknowledgeGridDraftChanges(state, submitted);

    expect(state.draftsById['txn-1']?.fields.amount).toEqual({
      baseValue: 500,
      value: 600,
    });
    expect(state.dirtyRowCount).toBe(1);
    expect(state.dirtyCellCount).toBe(1);
  });

  it('discards one row using its stored dirty-field count', () => {
    let state = createEmptyGridDraftEditingState<Field, Value>();
    state = recordGridDraftCellChange(state, 'txn-1', 'amount', 100, 500);
    state = recordGridDraftCellChange(state, 'txn-1', 'status', 'Pending', 'Failed');
    state = recordGridDraftCellChange(state, 'txn-2', 'account', 'A', 'B');

    state = discardGridDraftRow(state, 'txn-1');

    expect(state.draftsById).toEqual({
      'txn-2': {
        fields: {
          account: { baseValue: 'A', value: 'B' },
        },
        dirtyFieldCount: 1,
      },
    });
    expect(state.dirtyRowCount).toBe(1);
    expect(state.dirtyCellCount).toBe(1);
  });
});
