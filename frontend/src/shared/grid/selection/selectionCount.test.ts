import { describe, expect, it } from 'vitest';
import { getLogicalSelectedRowCount } from './selectionCount';

describe('logical selected-row count', () => {
  it('counts explicit/manual selection from exact include IDs', () => {
    expect(
      getLogicalSelectedRowCount(
        { mode: 'include', ids: ['txn-1', 'txn-2', 'txn-3'] },
        10_000,
      ),
    ).toBe(3);
  });

  it('counts dataset-wide Select All from the scope total minus user exceptions', () => {
    expect(
      getLogicalSelectedRowCount(
        { mode: 'exclude', ids: ['txn-7', 'txn-12'] },
        2_400,
      ),
    ).toBe(2_398);
  });

  it('never exposes a negative count while totals and exception state are reconciling', () => {
    expect(
      getLogicalSelectedRowCount(
        { mode: 'exclude', ids: ['txn-1', 'txn-2', 'txn-3'] },
        2,
      ),
    ).toBe(0);
  });
});
