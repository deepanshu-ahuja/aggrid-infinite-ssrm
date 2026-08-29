// GRIDCAP-EDIT-VALIDATION
import {
  defaultGridValidatorRegistry,
  type DefaultGridValidationRuleKey,
} from '@/shared/grid/validation/defaultGridValidationRules';
import {
  validateGridValue,
  type GridValidationRule,
} from '@/shared/grid/validation/gridValidation';
import type { TransactionEditableField, TransactionEditableValue } from './transactionEditing';

export const TRANSACTION_VALIDATION_RULES: Readonly<
  Record<TransactionEditableField, readonly GridValidationRule<DefaultGridValidationRuleKey>[]>
> = {
  account: [
    { key: 'required', message: 'Account is required.' },
    { key: 'maxLength', params: { max: 100 }, message: 'Account must be 100 characters or fewer.' },
  ],
  amount: [
    {
      key: 'numberRange',
      params: { min: 0, max: 1_000_000 },
      message: 'Amount must be between 0 and 1,000,000.',
    },
  ],
  currency: [
    { key: 'required', message: 'Currency is required.' },
    { key: 'maxLength', params: { max: 3 }, message: 'Currency must be 3 characters or fewer.' },
  ],
  status: [{ key: 'required', message: 'Status is required.' }],
};

/** Transaction owns its business rule selection/messages; shared grid code owns rule execution/state. */
export function validateTransactionField(
  field: TransactionEditableField,
  value: TransactionEditableValue,
) {
  return validateGridValue(value, TRANSACTION_VALIDATION_RULES[field], defaultGridValidatorRegistry);
}
