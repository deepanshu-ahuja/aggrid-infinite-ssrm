// GRIDCAP-EDIT-VALIDATION
import { describe, expect, it } from 'vitest';
import { defaultGridValidatorRegistry } from './defaultGridValidationRules';
import {
  clearGridRowValidationErrors,
  createServerGridValidationErrors,
  hasGridUpdateValidationError,
  setGridFieldValidationErrors,
  validateGridValue,
  type GridValidationState,
} from './gridValidation';

type Field = 'account' | 'amount';

describe('grid validation', () => {
  it('evaluates resolved rules and preserves configured messages', () => {
    expect(
      validateGridValue(
        '',
        [
          { key: 'required', message: 'Account is required.' },
          { key: 'maxLength', params: { max: 10 } },
        ],
        defaultGridValidatorRegistry,
      ),
    ).toEqual([
      {
        source: 'client',
        ruleKey: 'required',
        message: 'Account is required.',
      },
    ]);
  });

  it('fails predictably for an unknown required rule key', () => {
    expect(() =>
      validateGridValue('value', [{ key: 'unknown' }], {} as never),
    ).toThrow('Unknown grid validation rule: unknown');
  });

  it('supports numeric bounds and rejects non-finite values', () => {
    const rules = [{ key: 'numberRange' as const, params: { min: 0, max: 100 } }];

    expect(validateGridValue(50, rules, defaultGridValidatorRegistry)).toEqual([]);
    expect(validateGridValue(-1, rules, defaultGridValidatorRegistry)[0]?.message).toContain('at least 0');
    expect(validateGridValue(Number.NaN, rules, defaultGridValidatorRegistry)[0]?.message).toBe(
      'Must be a valid number.',
    );
  });

  it('stores client/server field errors by stable row id and clears a discarded row', () => {
    let state: GridValidationState<Field> = {};
    state = setGridFieldValidationErrors(state, 'txn-a', 'account', [
      { source: 'client', ruleKey: 'required', message: 'Account is required.' },
    ]);
    state = setGridFieldValidationErrors(
      state,
      'txn-b',
      'amount',
      createServerGridValidationErrors(['Amount was rejected by the server.']),
    );

    expect(
      hasGridUpdateValidationError(state, [
        { id: 'txn-a', changes: { account: '' } },
      ]),
    ).toBe(true);
    expect(
      hasGridUpdateValidationError(state, [
        { id: 'txn-a', changes: { amount: 10 } },
      ]),
    ).toBe(false);

    state = clearGridRowValidationErrors(state, 'txn-a');
    expect(state['txn-a']).toBeUndefined();
    expect(state['txn-b']?.amount?.[0]?.source).toBe('server');
  });
});
