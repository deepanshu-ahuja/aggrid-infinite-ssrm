import { describe, expect, it } from 'vitest';
import {
  normalizeFeatureDefinition,
  normalizeFieldDefinition,
} from './configuration.normalizer';

const validField = {
  colId: 'amount',
  field: 'amount',
  labelKey: 'fields.amount',
  cellDataType: 'number',
  sortable: true,
  filter: 'agNumberColumnFilter',
  filterParams: {
    maxNumConditions: 1,
    filterOptions: ['equals', 'greaterThan'],
  },
  editable: true,
  cellEditor: 'agNumberCellEditor',
  cellEditorParams: { min: 0 },
  validationRules: [{ key: 'numberRange', params: { min: 0 } }],
};

describe('configurable runtime normalization', () => {
  it('accepts and deep-clones a supported backend JSON feature', () => {
    const raw = {
      featureKey: 'review',
      entities: {
        transaction: {
          labelKey: 'entities.transaction',
          dataAdapterKey: 'transactions',
          rowId: { path: 'id' },
          gridOptions: {
            invalidEditValueMode: 'block',
            cellSelection: { handle: { mode: 'fill', direction: 'y' } },
          },
          fields: [validField],
        },
      },
    };

    const normalized = normalizeFeatureDefinition(raw);
    expect(normalized).toEqual(raw);
    expect(normalized).not.toBe(raw);
    expect(normalized.entities.transaction).not.toBe(raw.entities.transaction);
  });

  it('rejects unknown properties instead of silently passing them to AG Grid', () => {
    expect(() => normalizeFieldDefinition({ ...validField, valueGetter: 'data.amount' }))
      .toThrow(/valueGetter.*not supported/);
  });

  it('rejects executable/non-JSON values at the normalization boundary', () => {
    expect(() => normalizeFieldDefinition({
      ...validField,
      cellEditorParams: { getValidationErrors: () => null },
    })).toThrow(/JSON-safe/);
  });

  it('rejects Simple Filter conditions the server query contract cannot represent', () => {
    expect(() => normalizeFieldDefinition({
      ...validField,
      filterParams: { maxNumConditions: 2, filterOptions: ['equals'] },
    })).toThrow(/maxNumConditions.*exactly 1/);
  });

  it('validates filter operators against the configured cell-data-type semantics', () => {
    expect(() => normalizeFieldDefinition({
      ...validField,
      cellDataType: 'number',
      filterParams: { filterOptions: ['contains'] },
    })).toThrow(/unsupported filter option "contains"/);
  });
});
