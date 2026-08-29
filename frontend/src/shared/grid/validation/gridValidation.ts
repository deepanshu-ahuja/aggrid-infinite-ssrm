// GRIDCAP-EDIT-VALIDATION

/**
 * Shared validation foundation.
 *
 * Call flow for feature code:
 *
 *   feature rules/messages (for example transactionValidation.ts)
 *     -> validateGridValue(...)
 *     -> registry[rule.key] (for example defaultGridValidationRules.ts)
 *     -> normalized GridValidationError[]
 *     -> stable row-id/field validation state
 *
 * This file deliberately owns mechanics/state only. It must not know Transaction fields or business
 * messages, and it must never execute arbitrary JavaScript supplied by configuration/backend data.
 * See docs/implementation/grid-validation.md for the complete capability contract.
 */

export type GridValidationParams = Readonly<Record<string, unknown>>;

export interface GridValidationRule<TKey extends string = string> {
  key: TKey;
  params?: GridValidationParams;
  message?: string;
}

export interface GridValidationError<TKey extends string = string> {
  message: string;
  source: 'client' | 'server';
  ruleKey?: TKey;
}

export type GridFieldValidationErrors<TKey extends string = string> = readonly GridValidationError<TKey>[];

export type GridValidationErrorsByField<TField extends string, TKey extends string = string> = Partial<
  Record<TField, GridFieldValidationErrors<TKey>>
>;

export type GridValidationState<TField extends string, TKey extends string = string> = Record<
  string,
  GridValidationErrorsByField<TField, TKey>
>;

export interface GridValidatorResult {
  valid: boolean;
  defaultMessage?: string;
}

export type GridValidator<TValue> = (
  value: TValue,
  params: GridValidationParams | undefined,
) => GridValidatorResult;

export type GridValidatorRegistry<TKey extends string, TValue> = Readonly<
  Record<TKey, GridValidator<TValue>>
>;

/**
 * Validate one effective field value against already-resolved rules.
 *
 * Rule resolution belongs to feature/configuration code. This engine deliberately receives only stable
 * rule keys + JSON-safe params/messages and looks up executable functions from a frontend registry.
 */
export function validateGridValue<TKey extends string, TValue>(
  value: TValue,
  rules: readonly GridValidationRule<TKey>[],
  registry: GridValidatorRegistry<TKey, TValue>,
): GridFieldValidationErrors<TKey> {
  const errors: GridValidationError<TKey>[] = [];

  for (const rule of rules) {
    const validator = registry[rule.key];
    if (!validator) {
      throw new Error(`Unknown grid validation rule: ${rule.key}`);
    }

    const result = validator(value, rule.params);
    if (result.valid) continue;

    errors.push({
      source: 'client',
      ruleKey: rule.key,
      message: rule.message ?? result.defaultMessage ?? `Validation failed: ${rule.key}`,
    });
  }

  return errors;
}

/** Replace one row/field error list; an empty list removes stale validation for that field. */
export function setGridFieldValidationErrors<TField extends string, TKey extends string>(
  state: GridValidationState<TField, TKey>,
  rowId: string,
  field: TField,
  errors: GridFieldValidationErrors<TKey>,
): GridValidationState<TField, TKey> {
  const rowErrors: GridValidationErrorsByField<TField, TKey> = {
    ...(state[rowId] ?? {}),
  };

  if (errors.length === 0) delete rowErrors[field];
  else rowErrors[field] = [...errors];

  const next = { ...state };
  if (Object.keys(rowErrors).length === 0) delete next[rowId];
  else next[rowId] = rowErrors;
  return next;
}

/** Discard/row cleanup boundary: remove every validation error currently owned by one stable row ID. */
export function clearGridRowValidationErrors<TField extends string, TKey extends string>(
  state: GridValidationState<TField, TKey>,
  rowId: string,
): GridValidationState<TField, TKey> {
  if (!state[rowId]) return state;
  const next = { ...state };
  delete next[rowId];
  return next;
}

export function hasGridFieldValidationError<TField extends string, TKey extends string>(
  state: GridValidationState<TField, TKey>,
  rowId: string,
  field: TField,
) {
  return Boolean(state[rowId]?.[field]?.length);
}

export function hasGridRowValidationError<TField extends string, TKey extends string>(
  state: GridValidationState<TField, TKey>,
  rowId: string,
) {
  return Boolean(state[rowId] && Object.keys(state[rowId]).length > 0);
}

/**
 * Save guard helper for an explicit update set.
 *
 * It checks only fields actually present in each patch, which is important for Save Selected: unrelated
 * invalid fields outside the exact dirty-selected payload must not block a mutation that does not touch them.
 */
export function hasGridUpdateValidationError<
  TField extends string,
  TKey extends string,
  TValue,
>(
  state: GridValidationState<TField, TKey>,
  updates: readonly { id: string; changes: Partial<Record<TField, TValue>> }[],
) {
  return updates.some((update) =>
    Object.keys(update.changes).some((field) =>
      hasGridFieldValidationError(state, update.id, field as TField),
    ),
  );
}

/** Backend serializer errors enter the same field-state shape without pretending they came from a client rule. */
export function createServerGridValidationErrors<TKey extends string = string>(
  messages: readonly string[],
): GridFieldValidationErrors<TKey> {
  return messages.map((message) => ({ source: 'server', message }));
}
