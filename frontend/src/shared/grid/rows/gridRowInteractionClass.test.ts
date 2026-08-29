import { describe, expect, it } from 'vitest';
import type { RowClassParams, RowClassRules } from 'ag-grid-community';
import {
  createGridRowInteractionClassGetter,
  createGridRowInteractionClassRules,
} from './gridRowInteractionClass';
import type { GridRowInteractionMode } from './gridRowInteraction';

interface TestRow {
  interactionMode: GridRowInteractionMode;
  kind?: 'special';
}

function params(data?: TestRow): RowClassParams<TestRow> {
  return { data } as RowClassParams<TestRow>;
}

function evaluateRule(
  rules: RowClassRules<TestRow>,
  className: string,
  ruleParams: RowClassParams<TestRow>,
): boolean {
  const rule = rules[className];
  if (typeof rule !== 'function') throw new Error(`Expected function rule for ${className}`);
  return Boolean(rule(ruleParams));
}

describe('grid row interaction classes', () => {
  it('maps mutable interaction modes through rowClassRules', () => {
    const rules = createGridRowInteractionClassRules<TestRow>();

    expect(
      evaluateRule(rules, 'grid-row--selection-disabled', params({ interactionMode: 'enabled' })),
    ).toBe(false);
    expect(
      evaluateRule(
        rules,
        'grid-row--selection-disabled',
        params({ interactionMode: 'selectionDisabled' }),
      ),
    ).toBe(true);
    expect(
      evaluateRule(rules, 'grid-row--read-only', params({ interactionMode: 'readOnly' })),
    ).toBe(true);

    // The same rule must become false again when authoritative data changes mode. AG Grid uses this
    // false result to remove the previously applied class instead of accumulating stale row styling.
    expect(
      evaluateRule(rules, 'grid-row--selection-disabled', params({ interactionMode: 'enabled' })),
    ).toBe(false);
  });

  it('supports a dynamic feature mode adapter', () => {
    type CustomRow = { access: { mode: GridRowInteractionMode } };
    const rules = createGridRowInteractionClassRules<CustomRow>({
      getMode: (row) => row.access.mode,
    });
    const rule = rules['grid-row--read-only'];
    if (typeof rule !== 'function') throw new Error('Expected read-only function rule');

    expect(
      rule({ data: { access: { mode: 'readOnly' } } } as RowClassParams<CustomRow>),
    ).toBe(true);
  });

  it('keeps the additive getter for static/additive class use only', () => {
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

  it('returns no additive class while a server-backed RowNode has no data', () => {
    const getRowClass = createGridRowInteractionClassGetter<TestRow>();
    expect(getRowClass(params())).toBeUndefined();
  });
});
