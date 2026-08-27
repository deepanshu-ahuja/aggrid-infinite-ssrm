import { describe, expect, it } from 'vitest';
import {
  buildGridSelectionActionTarget,
  hasGridSelection,
} from './gridSelectionActionTarget';

describe('gridSelectionActionTarget', () => {
  it('turns include ids into an exact target without visible filters', () => {
    expect(
      buildGridSelectionActionTarget(
        { mode: 'include', ids: ['row-a', 'row-b'] },
        'filtered',
        [{ field: 'status', value: 'Pending' }],
      ),
    ).toEqual({
      selection: {
        mode: 'include',
        ids: ['row-a', 'row-b'],
      },
    });
  });

  it('attaches already-translated filters only to filtered exclude', () => {
    expect(
      buildGridSelectionActionTarget(
        { mode: 'exclude', ids: ['row-b'] },
        'filtered',
        [{ field: 'status', value: 'Pending' }],
      ),
    ).toEqual({
      selection: {
        mode: 'exclude',
        ids: ['row-b'],
      },
      filters: [{ field: 'status', value: 'Pending' }],
    });
  });

  it('keeps all-record exclude independent of visible filters', () => {
    expect(
      buildGridSelectionActionTarget(
        { mode: 'exclude', ids: ['row-c'] },
        'all',
        [{ field: 'status', value: 'Pending' }],
      ),
    ).toEqual({
      selection: {
        mode: 'exclude',
        ids: ['row-c'],
      },
    });
  });

  it('treats exclude as actionable and empty include as empty selection', () => {
    expect(hasGridSelection({ mode: 'exclude', ids: [] })).toBe(true);
    expect(hasGridSelection({ mode: 'include', ids: [] })).toBe(false);
  });
});
