import { describe, expect, it } from 'vitest';
import {
  createEmptyServerSideSelectionState,
  readFlatServerSideSelectionState,
  serverSideSelectionToIntent,
} from './serverSideSelection';

describe('SSRM selection adapter', () => {
  it('creates native empty selection state', () => {
    expect(createEmptyServerSideSelectionState()).toEqual({
      selectAll: false,
      toggledNodes: [],
    });
  });

  it('maps native explicit SSRM selection to include IDs', () => {
    expect(
      serverSideSelectionToIntent({
        selectAll: false,
        toggledNodes: ['row-a', 'row-b'],
      }),
    ).toEqual({
      mode: 'include',
      ids: ['row-a', 'row-b'],
    });
  });

  it('maps native SSRM Select All to exclude IDs', () => {
    expect(
      serverSideSelectionToIntent({
        selectAll: true,
        toggledNodes: ['row-a'],
      }),
    ).toEqual({
      mode: 'exclude',
      ids: ['row-a'],
    });
  });

  it('rejects hierarchical/group SSRM state instead of guessing', () => {
    expect(() =>
      readFlatServerSideSelectionState({
        selectAllChildren: true,
        toggledNodes: [],
      }),
    ).toThrow('Expected flat SSRM selection state');
  });
});
