import { describe, expect, it } from 'vitest';
import { mapFinanceGridRequest, mapFinanceSubmitTarget } from './financeRequest.mapper';

describe('Finance Review request mapping', () => {
  it('maps AG Grid block state into Finance window/orderBy/criteria vocabulary', () => {
    expect(
      mapFinanceGridRequest({
        startRow: 40,
        endRow: 80,
        sortModel: [{ colId: 'exposure', sort: 'desc' }],
        filterModel: {
          desk: { filterType: 'text', type: 'equals', filter: 'Credit' },
          utilizationPct: { filterType: 'number', type: 'greaterThanOrEqual', filter: 50 },
        },
      }),
    ).toEqual({
      window: { from: 40, size: 40 },
      orderBy: [{ attribute: 'exposure', descending: true }],
      criteria: [
        { attribute: 'desk', comparison: 'eq', operand: 'Credit' },
        { attribute: 'utilizationPct', comparison: 'gte', operand: 50 },
      ],
    });
  });

  it('maps explicit and dataset-wide selection into Finance command targets', () => {
    expect(
      mapFinanceSubmitTarget({ mode: 'include', ids: ['FIN-5001'] }, {}),
    ).toEqual({ mode: 'explicit', keys: ['FIN-5001'] });

    expect(
      mapFinanceSubmitTarget(
        { mode: 'exclude', ids: ['FIN-5003'] },
        { reviewStatus: { filterType: 'text', type: 'equals', filter: 'Open' } },
      ),
    ).toEqual({
      mode: 'all',
      exceptKeys: ['FIN-5003'],
      criteria: [{ attribute: 'reviewStatus', comparison: 'eq', operand: 'Open' }],
    });
  });

  it('rejects unknown identifiers rather than coupling Finance to arbitrary AG Grid fields', () => {
    expect(() =>
      mapFinanceGridRequest({
        startRow: 0,
        endRow: 40,
        sortModel: [{ colId: 'privateField', sort: 'asc' }],
        filterModel: {},
      }),
    ).toThrow('Unsupported Finance sort field');
  });
});
