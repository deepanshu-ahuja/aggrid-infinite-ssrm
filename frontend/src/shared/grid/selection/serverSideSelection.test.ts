import { describe, expect, it } from 'vitest';
import {
  createEmptyServerSideSelectionState,
  readFlatServerSideSelectionState,
  removeIdsFromExplicitServerSideSelectionState,
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

  it('removes newly ineligible IDs from native explicit selection', () => {
    expect(
      removeIdsFromExplicitServerSideSelectionState(
        {
          selectAll: false,
          toggledNodes: ['row-a', 'row-b', 'row-c'],
        },
        ['row-b', 'row-c'],
      ),
    ).toEqual({
      selectAll: false,
      toggledNodes: ['row-a'],
    });
  });

  it('does not reinterpret All Records exceptions as selected IDs', () => {
    const state = {
      selectAll: true,
      toggledNodes: ['user-deselected-row'],
    };

    expect(removeIdsFromExplicitServerSideSelectionState(state, ['user-deselected-row'])).toBe(
      state,
    );
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
