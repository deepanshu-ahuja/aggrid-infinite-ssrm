import { describe, expect, it } from 'vitest';
import {
  isGridRowEditable,
  isGridRowReadOnly,
  isGridRowSelectable,
  type GridRowInteractionMode,
} from './gridRowInteraction';

describe('grid row interaction semantics', () => {
  it.each<[
    GridRowInteractionMode,
    { selectable: boolean; editable: boolean; readOnly: boolean },
  ]>([
    ['enabled', { selectable: true, editable: true, readOnly: false }],
    ['selectionDisabled', { selectable: false, editable: true, readOnly: false }],
    ['readOnly', { selectable: false, editable: false, readOnly: true }],
  ])('maps %s to the expected capabilities', (mode, expected) => {
    expect(isGridRowSelectable(mode)).toBe(expected.selectable);
    expect(isGridRowEditable(mode)).toBe(expected.editable);
    expect(isGridRowReadOnly(mode)).toBe(expected.readOnly);
  });
});
