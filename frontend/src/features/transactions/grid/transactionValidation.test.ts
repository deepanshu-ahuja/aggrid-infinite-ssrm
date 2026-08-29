// GRIDCAP-EDIT-VALIDATION
import { describe, expect, it } from 'vitest';
import {
  mapTransactionServerValidationErrors,
  validateTransactionField,
} from './transactionValidation';

describe('transaction validation', () => {
  it('requires non-blank account, currency and date values', () => {
    expect(validateTransactionField('account', '')[0]?.message).toBe('Account is required.');
    expect(validateTransactionField('currency', '   ')[0]?.message).toBe('Currency is required.');
    expect(validateTransactionField('transactionDate', null)[0]?.message).toBe(
      'Transaction date is required.',
    );
  });

  it('enforces configured string lengths', () => {
    expect(validateTransactionField('account', 'a'.repeat(101))[0]?.message).toContain('100 characters');
    expect(validateTransactionField('currency', 'USDX')[0]?.message).toContain('3 characters');
  });

  it('enforces the Transaction amount range', () => {
    expect(validateTransactionField('amount', 0)).toEqual([]);
    expect(validateTransactionField('amount', 1_000_000)).toEqual([]);
    expect(validateTransactionField('amount', -0.01)[0]?.message).toContain('between 0 and 1,000,000');
    expect(validateTransactionField('amount', 1_000_000.01)[0]?.message).toContain(
      'between 0 and 1,000,000',
    );
  });

  it('accepts a populated transaction date draft', () => {
    expect(validateTransactionField('transactionDate', '2026-08-29')).toEqual([]);
  });

  it('maps single-row DRF field errors back to the submitted row id', () => {
    expect(
      mapTransactionServerValidationErrors(
        { account: ['Backend account error.'], amount: ['Backend amount error.'] },
        [{ id: 'txn-a', changes: { account: 'bad', amount: -1 } }],
      ),
    ).toEqual([
      {
        rowId: 'txn-a',
        fields: {
          account: ['Backend account error.'],
          amount: ['Backend amount error.'],
        },
      },
    ]);
  });

  it('maps indexed bulk serializer errors to the corresponding submitted row ids', () => {
    expect(
      mapTransactionServerValidationErrors(
        {
          updates: [
            {},
            { changes: { currency: ['Backend currency error.'] } },
          ],
        },
        [
          { id: 'txn-a', changes: { account: 'Valid' } },
          { id: 'txn-b', changes: { currency: 'USDX' } },
        ],
      ),
    ).toEqual([
      {
        rowId: 'txn-b',
        fields: { currency: ['Backend currency error.'] },
      },
    ]);
  });
});
