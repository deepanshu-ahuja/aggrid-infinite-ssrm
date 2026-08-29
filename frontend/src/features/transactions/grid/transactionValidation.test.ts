// GRIDCAP-EDIT-VALIDATION
import { describe, expect, it } from 'vitest';
import { validateTransactionField } from './transactionValidation';

describe('transaction validation', () => {
  it('requires non-blank account and currency values', () => {
    expect(validateTransactionField('account', '')[0]?.message).toBe('Account is required.');
    expect(validateTransactionField('currency', '   ')[0]?.message).toBe('Currency is required.');
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
});
