// GRIDCAP-EDIT-VALIDATION
import type { GridValidationParams, GridValidatorRegistry } from './gridValidation';

export type DefaultGridValidationRuleKey = 'required' | 'maxLength' | 'numberRange';

function readNumberParam(params: GridValidationParams | undefined, key: string) {
  const value = params?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Domain-neutral validators keyed by stable names that JSON-safe feature/configuration can reference. */
export const defaultGridValidatorRegistry: GridValidatorRegistry<
  DefaultGridValidationRuleKey,
  unknown
> = {
  required: (value) => ({
    valid: !(value === null || value === undefined || (typeof value === 'string' && value.trim() === '')),
    defaultMessage: 'A value is required.',
  }),
  maxLength: (value, params) => {
    const max = readNumberParam(params, 'max');
    if (max === undefined) throw new Error('maxLength validation requires a finite numeric "max" param.');
    return {
      valid: typeof value !== 'string' || value.length <= max,
      defaultMessage: `Must be ${max} characters or fewer.`,
    };
  },
  numberRange: (value, params) => {
    const min = readNumberParam(params, 'min');
    const max = readNumberParam(params, 'max');
    if (min === undefined && max === undefined) {
      throw new Error('numberRange validation requires at least one finite numeric "min" or "max" param.');
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { valid: false, defaultMessage: 'Must be a valid number.' };
    }
    if (min !== undefined && value < min) {
      return { valid: false, defaultMessage: `Must be at least ${min}.` };
    }
    if (max !== undefined && value > max) {
      return { valid: false, defaultMessage: `Must be at most ${max}.` };
    }
    return { valid: true };
  },
};
