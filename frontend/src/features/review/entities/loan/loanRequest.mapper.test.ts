import { describe, expect, it } from 'vitest';
import { mapLoanFilterModel, mapLoanGridRequest } from './loanRequest.mapper';

describe('Loan Review request mapping', () => {
  it('maps AG Grid block state into the Loan flat backend contract', () => {
    expect(
      mapLoanGridRequest({
        startRow: 50,
        endRow: 100,
        sortModel: [{ colId: 'principal', sort: 'desc' }],
        filterModel: {
          status: { filterType: 'text', type: 'equals', filter: 'Active' },
          principal: { filterType: 'number', type: 'greaterThan', filter: 500000 },
        },
      }),
    ).toEqual({
      offset: 50,
      limit: 50,
      sort: [{ field: 'principal', direction: 'desc' }],
      filters: [
        { field: 'status', operator: 'equals', value: 'Active' },
        { field: 'principal', operator: 'greaterThan', value: 500000 },
      ],
    });
  });

  it('maps the same filter model used by All Filtered Submit', () => {
    expect(
      mapLoanFilterModel({
        borrower: { filterType: 'text', type: 'startsWith', filter: 'Borrower 0' },
      }),
    ).toEqual([
      { field: 'borrower', operator: 'startsWith', value: 'Borrower 0' },
    ]);
  });

  it('rejects unknown configured identifiers instead of forwarding them to Loan APIs', () => {
    expect(() =>
      mapLoanGridRequest({
        startRow: 0,
        endRow: 50,
        sortModel: [{ colId: 'privateField', sort: 'asc' }],
        filterModel: {},
      }),
    ).toThrow('Unsupported Loan sort field');
  });
});
