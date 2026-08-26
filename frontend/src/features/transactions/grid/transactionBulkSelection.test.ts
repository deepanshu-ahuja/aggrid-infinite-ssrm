import { describe, expect, it } from 'vitest';
import { buildTransactionBulkSelection } from './transactionBulkSelection';

/**
 * Tests the Transactions-specific bridge between:
 *
 * logical Infinite selection
 *       +
 * Transactions UI/query context
 *       ↓
 * backend-ready selection payload
 *
 * No backend API is called in these tests.
 */
describe('buildTransactionBulkSelection', () => {
  it('builds the same exact-ID payload for page/manual selection', () => {
    const result = buildTransactionBulkSelection(
      {
        mode: 'include',
        ids: ['txn-a', 'txn-b'],
      },
      {
        selectionScope: 'page',
      },
    );

    expect(result).toEqual({
      mode: 'include',
      ids: ['txn-a', 'txn-b'],
    });
  });

  it('ignores visible filters for manual include selection in filtered mode', () => {
    const result = buildTransactionBulkSelection(
      {
        mode: 'include',
        ids: ['txn-a', 'txn-b'],
      },
      {
        selectionScope: 'filtered',
        filterModel: {
          status: {
            filterType: 'text',
            type: 'equals',
            filter: 'Completed',
          },
        },
      },
    );

    /**
     * Explicit IDs define membership completely.
     *
     * Even though the grid currently has a filter, manual include selection remains "exactly these
     * IDs" and therefore carries no filters.
     */
    expect(result).toEqual({
      mode: 'include',
      ids: ['txn-a', 'txn-b'],
    });
  });

  it('reuses the Transactions filter mapper for Select All Filtered', () => {
    const result = buildTransactionBulkSelection(
      {
        mode: 'exclude',
        ids: ['txn-excluded'],
      },
      {
        selectionScope: 'filtered',
        filterModel: {
          status: {
            filterType: 'text',
            type: 'equals',
            filter: 'Completed',
          },
          amount: {
            filterType: 'number',
            type: 'greaterThan',
            filter: 5_000,
          },
        },
      },
    );

    /**
     * Meaning:
     *
     * all backend Transactions where:
     *   status = Completed
     *   amount > 5000
     *
     * except txn-excluded.
     *
     * The expected filter objects are the SAME backend contract produced by
     * `transactionRequest.mapper.ts` during normal row loading.
     */
    expect(result).toEqual({
      mode: 'exclude',
      ids: ['txn-excluded'],
      filters: [
        {
          field: 'status',
          operator: 'equals',
          value: 'Completed',
        },
        {
          field: 'amount',
          operator: 'greaterThan',
          value: 5_000,
        },
      ],
    });
  });

  it('normalises Transaction date filters through the existing mapper', () => {
    const result = buildTransactionBulkSelection(
      {
        mode: 'exclude',
        ids: [],
      },
      {
        selectionScope: 'filtered',
        filterModel: {
          transactionDate: {
            filterType: 'date',
            type: 'equals',
            dateFrom: '2026-08-24 00:00:00',
          },
        },
      },
    );

    /**
     * This proves the bulk-selection path is not inventing its own date conversion. It inherits the
     * mapper's existing date-only YYYY-MM-DD backend semantics.
     */
    expect(result).toEqual({
      mode: 'exclude',
      ids: [],
      filters: [
        {
          field: 'transactionDate',
          operator: 'equals',
          value: '2026-08-24',
        },
      ],
    });
  });

  it('builds Select All Records with an explicitly unfiltered dataset', () => {
    const result = buildTransactionBulkSelection(
      {
        mode: 'exclude',
        ids: ['txn-a'],
      },
      {
        selectionScope: 'all',
      },
    );

    expect(result).toEqual({
      mode: 'exclude',
      ids: ['txn-a'],
      filters: [],
    });
  });

  it('rejects impossible page + exclude state instead of widening it to a dataset action', () => {
    expect(() =>
      buildTransactionBulkSelection(
        {
          mode: 'exclude',
          ids: [],
        },
        {
          selectionScope: 'page',
        },
      ),
    ).toThrow('Invalid Transactions selection: page selection cannot use exclude mode.');
  });
});
