import { describe, expect, it } from 'vitest';
import { buildTransactionSelectionActionRequest } from './transactionSelectionAction';

describe('buildTransactionSelectionActionRequest', () => {
  it('keeps include ids exact and does not attach visible filters', () => {
    expect(
      buildTransactionSelectionActionRequest(
        { mode: 'include', ids: ['txn-a', 'txn-b'] },
        'filtered',
        { status: { type: 'equals', filter: 'Pending' } },
        { status: 'Failed' },
      ),
    ).toEqual({
      selection: {
        mode: 'include',
        ids: ['txn-a', 'txn-b'],
      },
      changes: { status: 'Failed' },
    });
  });

  it('attaches translated filters to filtered exclude selection', () => {
    expect(
      buildTransactionSelectionActionRequest(
        { mode: 'exclude', ids: ['txn-b'] },
        'filtered',
        { status: { type: 'equals', filter: 'Pending' } },
        { status: 'Completed' },
      ),
    ).toEqual({
      selection: {
        mode: 'exclude',
        ids: ['txn-b'],
      },
      filters: [{ field: 'status', operator: 'equals', value: 'Pending' }],
      changes: { status: 'Completed' },
    });
  });

  it('keeps all-record exclude selection independent of visible filters', () => {
    expect(
      buildTransactionSelectionActionRequest(
        { mode: 'exclude', ids: ['txn-c'] },
        'all',
        { status: { type: 'equals', filter: 'Pending' } },
        { status: 'Failed' },
      ),
    ).toEqual({
      selection: {
        mode: 'exclude',
        ids: ['txn-c'],
      },
      changes: { status: 'Failed' },
    });
  });
});
