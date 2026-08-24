import { describe, expect, it } from 'vitest';
import { buildGridBulkSelection } from './gridBulkSelection';

interface TestFilter {
  field: 'status' | 'amount';
  operator: 'equals' | 'greaterThan';
  value: string | number;
}

/**
 * Tests the shared boundary between logical grid selection and a future backend bulk action.
 *
 * These tests deliberately use neutral row IDs and a tiny fake filter type so the contract remains
 * reusable across Transactions and future server-backed tables.
 */
describe('buildGridBulkSelection', () => {
  it('builds exact-ID include selection and does not attach active filters', () => {
    const activeFilters: TestFilter[] = [
      {
        field: 'status',
        operator: 'equals',
        value: 'Completed',
      },
    ];

    const result = buildGridBulkSelection(
      {
        mode: 'include',
        ids: ['row-a', 'row-b'],
      },
      activeFilters,
    );

    /**
     * Manual/current-page selection means exactly these IDs.
     *
     * The active visible filter must not redefine membership, so the backend payload contains no
     * `filters` property at all.
     */
    expect(result).toEqual({
      mode: 'include',
      ids: ['row-a', 'row-b'],
    });
  });

  it('builds filtered Select-All as exclusions plus backend filters', () => {
    const filters: TestFilter[] = [
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
    ];

    const result = buildGridBulkSelection(
      {
        mode: 'exclude',
        ids: ['row-a'],
      },
      filters,
    );

    /**
     * Meaning:
     *
     * all rows matching:
     *   Status = Completed
     *   Amount > 5000
     *
     * except:
     *   row-a
     */
    expect(result).toEqual({
      mode: 'exclude',
      ids: ['row-a'],
      filters,
    });
  });

  it('builds Select-All-Records as exclusions plus an explicit empty filter list', () => {
    const result = buildGridBulkSelection(
      {
        mode: 'exclude',
        ids: ['row-a', 'row-b'],
      },
      [],
    );

    /**
     * Empty filters are NOT missing information here.
     *
     * They explicitly mean the starting dataset is the complete unfiltered dataset:
     *
     * all records except row-a and row-b.
     */
    expect(result).toEqual({
      mode: 'exclude',
      ids: ['row-a', 'row-b'],
      filters: [],
    });
  });

  it('does not mutate caller-owned selection IDs or filters', () => {
    const ids = ['row-a'];
    const filters: TestFilter[] = [
      {
        field: 'status',
        operator: 'equals',
        value: 'Completed',
      },
    ];

    const result = buildGridBulkSelection(
      {
        mode: 'exclude',
        ids,
      },
      filters,
    );

    /**
     * The builder creates transport payload arrays rather than returning the caller's arrays by
     * reference. A later consumer mutating its request must not mutate the React/application state
     * that produced the selection.
     */
    expect(result.ids).not.toBe(ids);

    if (result.mode === 'exclude') {
      expect(result.filters).not.toBe(filters);
    }

    expect(ids).toEqual(['row-a']);
    expect(filters).toEqual([
      {
        field: 'status',
        operator: 'equals',
        value: 'Completed',
      },
    ]);
  });
});
