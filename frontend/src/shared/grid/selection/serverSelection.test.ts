import { describe, expect, it } from 'vitest';
import {
  getDatasetHeaderState,
  isServerRowSelected,
  toServerSelectionIntent,
  updateDatasetHeaderSelection,
  updateRowSelection,
} from './serverSelection';

describe('server selection representation', () => {
  it('represents dataset Select All with exclusions for unloaded records', () => {
    const selectAll = updateDatasetHeaderSelection<string>(true);
    const withException = updateRowSelection(selectAll, 'row-1', false);

    expect(selectAll).toEqual({
      mode: 'exclude',
      ids: new Set(),
    });

    expect(isServerRowSelected(withException, 'row-1')).toBe(false);
    expect(isServerRowSelected(withException, 'row-never-loaded')).toBe(true);

    expect(getDatasetHeaderState(withException, 80)).toEqual({
      checked: false,
      indeterminate: true,
      disabled: false,
    });
  });

  it('serialises only mode and ids, without copying UI scope into logical selection', () => {
    const selectAll = updateDatasetHeaderSelection<string>(true);

    /**
     * The serializer deliberately receives no `page | filtered | all` argument.
     *
     * The same logical state can later be interpreted by the feature/action layer according to the
     * UI strategy that owns it.
     */
    expect(toServerSelectionIntent(selectAll)).toEqual({
      mode: 'exclude',
      ids: [],
    });
  });

  it('serialises explicit/manual row selection as include plus exact ids', () => {
    let selection = updateDatasetHeaderSelection<string>(false);

    selection = updateRowSelection(selection, 'row-a', true);
    selection = updateRowSelection(selection, 'row-b', true);

    expect(toServerSelectionIntent(selection)).toEqual({
      mode: 'include',
      ids: ['row-a', 'row-b'],
    });
  });
});