import { describe, expect, it } from 'vitest';
import { formatCurrency } from './formatCurrency';

describe('formatCurrency', () => {
  it('formats an amount with a valid currency', () => {
    expect(formatCurrency(1234.5, 'USD')).toContain('1,234.5');
  });

  it('falls back to a plain localized number for a blank LOCAL currency draft', () => {
    expect(() => formatCurrency(1234.5, '')).not.toThrow();
    expect(formatCurrency(1234.5, '')).toContain('1,234.5');
  });

  it('falls back instead of throwing for a malformed LOCAL currency draft', () => {
    expect(() => formatCurrency(1234.5, 'NOT-A-CURRENCY')).not.toThrow();
  });
});
