import { describe, expect, it } from 'vitest';
import {
  mapTransactionBulkUpdateItems,
  mapTransactionUpdateChanges,
} from './transactionUpdate.mapper';

describe('transaction update mapper', () => {
  it('maps tracked editable values to the strict backend patch', () => {
    expect(
      mapTransactionUpdateChanges({
        account: 'Treasury',
        amount: 1250,
        currency: 'USD',
        status: 'Completed',
        transactionDate: '2026-01-15',
      }),
    ).toEqual({
      account: 'Treasury',
      amount: 1250,
      currency: 'USD',
      status: 'Completed',
      transactionDate: '2026-01-15',
    });
  });

  it('rejects an invalid generic tracked value before the API call', () => {
    expect(() => mapTransactionUpdateChanges({ amount: 'not-a-number' })).toThrow(
      'Transaction amount must be a finite number.',
    );
    expect(() => mapTransactionUpdateChanges({ transactionDate: 'not-a-date' })).toThrow(
      'Transaction date must be an ISO date (YYYY-MM-DD).',
    );
  });

  it('maps every bulk row independently without changing ids', () => {
    expect(
      mapTransactionBulkUpdateItems([
        { id: 'txn-a', changes: { status: 'Failed' } },
        { id: 'txn-b', changes: { amount: 400 } },
      ]),
    ).toEqual([
      { id: 'txn-a', changes: { status: 'Failed' } },
      { id: 'txn-b', changes: { amount: 400 } },
    ]);
  });
});
