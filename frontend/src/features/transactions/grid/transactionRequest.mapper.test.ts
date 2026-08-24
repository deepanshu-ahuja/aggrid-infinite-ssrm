import { describe, expect, it } from 'vitest';
import { mapTransactionGridRequest } from './transactionRequest.mapper';

describe('mapTransactionGridRequest', () => {
  it('maps flat AG Grid block state into the backend contract', () => {
    expect(
      mapTransactionGridRequest({
        startRow: 50,
        endRow: 100,
        sortModel: [{ colId: 'amount', sort: 'desc' }],
        filterModel: {
          status: { filterType: 'text', type: 'equals', filter: 'Completed' },
          amount: { filterType: 'number', type: 'greaterThan', filter: 5000 },
        },
      }),
    ).toEqual({
      offset: 50,
      limit: 50,
      sort: [{ field: 'amount', direction: 'desc' }],
      filters: [
        { field: 'status', operator: 'equals', value: 'Completed' },
        { field: 'amount', operator: 'greaterThan', value: 5000 },
      ],
    });
  });

  it('rejects unknown column identifiers instead of forwarding them to the API', () => {
    expect(() =>
      mapTransactionGridRequest({
        startRow: 0,
        endRow: 50,
        sortModel: [{ colId: 'internalOnly', sort: 'asc' }],
        filterModel: {},
      }),
    ).toThrow('Unsupported transaction sort field');
  });

  it('rejects combined filters until the backend contract explicitly supports them', () => {
    expect(() =>
      mapTransactionGridRequest({
        startRow: 0,
        endRow: 50,
        sortModel: [],
        filterModel: {
          status: {
            filterType: 'text',
            operator: 'OR',
            conditions: [
              { type: 'equals', filter: 'Completed' },
              { type: 'equals', filter: 'Pending' },
            ],
          },
        },
      }),
    ).toThrow('Combined AG Grid filter conditions are not supported');
  });
});
