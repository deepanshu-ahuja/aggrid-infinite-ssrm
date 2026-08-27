import { describe, expect, it } from 'vitest';
import type { RowClassParams } from 'ag-grid-community';
import { createGridRowInteractionClassGetter } from './gridRowInteractionClass';
import type { GridRowInteractionMode } from './gridRowInteraction';

interface TestRow {
  interactionMode: GridRowInteractionMode;
  kind?: 'special';
}

function params(data?: TestRow): RowClassParams<TestRow> {
  return { data } as RowClassParams<TestRow>;
}

describe('createGridRowInteractionClassGetter', () => {
  it('uses the common interactionMode property and default classes', () => {
    const getRowClass = createGridRowInteractionClassGetter<TestRow>();

    expect(getRowClass(params({ interactionMode: 'enabled' }))).toBeUndefined();
    expect(getRowClass(params({ interactionMode: 'selectionDisabled' }))).toBe(
      'grid-row--selection-disabled',
    );
    expect(getRowClass(params({ interactionMode: 'readOnly' }))).toBe('grid-row--read-only');
  });

  it('supports a feature mode adapter when the backend shape is different', () => {
    type CustomRow = { access: { mode: GridRowInteractionMode } };
    const getRowClass = createGridRowInteractionClassGetter<CustomRow>({
      getMode: (row) => row.access.mode,
    });

    expect(
      getRowClass({ data: { access: { mode: 'readOnly' } } } as RowClassParams<CustomRow>),
    ).toBe('grid-row--read-only');
  });

  it('allows class overrides and appends a feature-only class', () => {
    const getRowClass = createGridRowInteractionClassGetter<TestRow>({
      classNames: {
        readOnly: 'my-grid--locked',
      },
      getAdditionalClass: (row) => (row.kind === 'special' ? 'feature-row--special' : undefined),
    });

    expect(getRowClass(params({ interactionMode: 'readOnly', kind: 'special' }))).toBe(
      'my-grid--locked feature-row--special',
    );
    expect(getRowClass(params({ interactionMode: 'enabled', kind: 'special' }))).toBe(
      'feature-row--special',
    );
  });

  it('returns no class while a server-backed RowNode has no data', () => {
    const getRowClass = createGridRowInteractionClassGetter<TestRow>();
    expect(getRowClass(params())).toBeUndefined();
  });
});
