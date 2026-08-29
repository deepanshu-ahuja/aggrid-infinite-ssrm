// GRIDCAP-EDIT-VALIDATION
import {
  defaultGridValidatorRegistry,
  type DefaultGridValidationRuleKey,
} from '@/shared/grid/validation/defaultGridValidationRules';
import {
  validateGridValue,
  type GridValidationRule,
} from '@/shared/grid/validation/gridValidation';
import type {
  TransactionEditableField,
  TransactionEditableValue,
  TransactionUpdatePayload,
} from './transactionEditing';

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
  transactionDate: [{ key: 'required', message: 'Transaction date is required.' }],
};

/** Transaction owns its business rule selection/messages; shared grid code owns rule execution/state. */
export function validateTransactionField(
  field: TransactionEditableField,
  value: TransactionEditableValue,
) {
  return validateGridValue(value, TRANSACTION_VALIDATION_RULES[field], defaultGridValidatorRegistry);
}

export interface TransactionServerValidationRowErrors {
  rowId: string;
  fields: Partial<Record<TransactionEditableField, readonly string[]>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asMessages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function readFieldErrors(value: unknown) {
  if (!isRecord(value)) return {};
  const fields: Partial<Record<TransactionEditableField, readonly string[]>> = {};
  for (const field of Object.keys(TRANSACTION_VALIDATION_RULES) as TransactionEditableField[]) {
    const messages = asMessages(value[field]);
    if (messages.length > 0) fields[field] = messages;
  }
  return fields;
}

/**
 * Translate DRF's single-row and indexed bulk serializer error shapes back to stable Transaction IDs.
 * Transport parsing stays feature-owned because only Transactions knows how command rows correspond to
 * serializer positions. Shared validation receives only normalized row-id/field message collections.
 */
export function mapTransactionServerValidationErrors(
  details: unknown,
  updates: TransactionUpdatePayload['updates'],
): TransactionServerValidationRowErrors[] {
  if (!isRecord(details) || updates.length === 0) return [];

  if (updates.length === 1 && !Array.isArray(details.updates)) {
    const update = updates[0];
    if (!update) return [];
    const fields = readFieldErrors(details);
    return Object.keys(fields).length > 0 ? [{ rowId: update.id, fields }] : [];
  }

  const updateErrors = details.updates;
  if (!Array.isArray(updateErrors)) return [];

  const result: TransactionServerValidationRowErrors[] = [];
  updateErrors.forEach((item, index) => {
    const update = updates[index];
    if (!update || !isRecord(item)) return;
    const fields = readFieldErrors(item.changes);
    if (Object.keys(fields).length > 0) result.push({ rowId: update.id, fields });
  });
  return result;
}
