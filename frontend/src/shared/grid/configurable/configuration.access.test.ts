// GRIDCAP-CONFIG-ACCESS
import { describe, expect, it } from 'vitest';
import { resolveFeatureAccess, type ConfigurableApplicationAccessProjection } from './configuration.access';
import type { FeatureDefinition } from './configuration.types';

const feature = {
  featureKey: 'review',
  entities: {
    loan: {
      labelKey: 'entities.loan',
      dataAdapterKey: 'loan',
      rowId: { path: 'id' },
      fields: [
        {
          colId: 'reference',
          field: 'reference',
          labelKey: 'fields.reference',
          cellDataType: 'text',
          editable: false,
        },
        {
          colId: 'amount',
          field: 'amount',
          labelKey: 'fields.amount',
          cellDataType: 'number',
          editable: true,
        },
        {
          colId: 'internalScore',
          field: 'internalScore',
          labelKey: 'fields.internalScore',
          cellDataType: 'number',
          editable: false,
        },
      ],
    },
    finance: {
      labelKey: 'entities.finance',
      dataAdapterKey: 'finance',
      rowId: { path: 'id' },
      fields: [
        {
          colId: 'reference',
          field: 'reference',
          labelKey: 'fields.reference',
          cellDataType: 'text',
          editable: false,
        },
      ],
    },
  },
} satisfies FeatureDefinition<'review', 'loan' | 'finance'>;

function access(
  entities: ConfigurableApplicationAccessProjection['features'][string]['entities'],
): ConfigurableApplicationAccessProjection {
  return { features: { review: { entities } } };
}

describe('configurable current-user access resolution', () => {
  it('removes inaccessible entities and fields while preserving base field order', () => {
    const resolved = resolveFeatureAccess(
      feature,
      access({
        loan: {
          fields: {
            reference: 'read',
            amount: 'edit',
          },
        },
      }),
    );

    expect(Object.keys(resolved?.entities ?? {})).toEqual(['loan']);
    expect(resolved?.entities.loan?.fields.map((field) => field.colId)).toEqual([
      'reference',
      'amount',
    ]);
  });

  it('downgrades read access and never promotes a base read-only field', () => {
    const readResolved = resolveFeatureAccess(
      feature,
      access({ loan: { fields: { amount: 'read' } } }),
    );
    expect(readResolved?.entities.loan?.fields[0]?.editable).toBe(false);

    const editResolved = resolveFeatureAccess(
      feature,
      access({ loan: { fields: { reference: 'edit' } } }),
    );
    expect(editResolved?.entities.loan?.fields[0]?.editable).toBe(false);
  });

  it('returns no feature when the current user/session cannot access it', () => {
    expect(resolveFeatureAccess(feature, { features: {} })).toBeUndefined();
  });

  it('fails controlledly when local/current-user access references unknown configuration identities', () => {
    expect(() =>
      resolveFeatureAccess(feature, access({ missing: { fields: { reference: 'read' } } })),
    ).toThrow(/unknown entity "missing"/);

    expect(() =>
      resolveFeatureAccess(feature, access({ loan: { fields: { missing: 'read' } } })),
    ).toThrow(/unknown field colId "missing"/);
  });
});
