import { describe, expect, it } from 'vitest';
import {
  buildTransactionUpdatePayload,
  createEmptyTransactionEditingState,
  recordTransactionCellChange,
} from './transactionEditing';

describe('transaction editing state', () => {
  it('groups different edited fields under the same row id', () => {
    let state = createEmptyTransactionEditingState();

    state = recordTransactionCellChange(state, 'row-1', 'amount', 10, 20);
    state = recordTransactionCellChange(
      state,
      'row-1',
      'status',
      'Pending',
      'Completed',
    );

    expect(buildTransactionUpdatePayload(state)).toEqual({
      updates: [
        {
          id: 'row-1',
          changes: {
            amount: 20,
            status: 'Completed',
          },
        },
      ],
    });
  });

  it('keeps edits from multiple rows ready for one eventual backend payload', () => {
    let state = createEmptyTransactionEditingState();

    state = recordTransactionCellChange(state, 'row-1', 'account', 'A', 'B');
    state = recordTransactionCellChange(state, 'row-9', 'currency', 'USD', 'EUR');

    expect(buildTransactionUpdatePayload(state)).toEqual({
      updates: [
        { id: 'row-1', changes: { account: 'B' } },
        { id: 'row-9', changes: { currency: 'EUR' } },
      ],
    });
  });

  it('removes a field when the user changes it back to its original value', () => {
    let state = createEmptyTransactionEditingState();

    state = recordTransactionCellChange(state, 'row-1', 'amount', 10, 20);
    state = recordTransactionCellChange(state, 'row-1', 'amount', 20, 10);

    expect(buildTransactionUpdatePayload(state)).toEqual({ updates: [] });
  });

  it('preserves the first original value across several edits', () => {
    let state = createEmptyTransactionEditingState();

    state = recordTransactionCellChange(state, 'row-1', 'amount', 10, 20);
    state = recordTransactionCellChange(state, 'row-1', 'amount', 20, 30);
    state = recordTransactionCellChange(state, 'row-1', 'amount', 30, 10);

    expect(buildTransactionUpdatePayload(state)).toEqual({ updates: [] });
  });
});
