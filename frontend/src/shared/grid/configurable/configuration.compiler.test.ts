// GRIDCAP-COLUMNS | GRIDCAP-ROW-ID | GRIDCAP-EDIT-VALIDATION
import { describe, expect, it } from 'vitest';
import { defaultGridValidatorRegistry } from '../validation/defaultGridValidationRules';
import { compileConfigurableSsrmEntity } from './configuration.compiler';
import { normalizeEntityDefinition } from './configuration.normalizer';
import type { ConfigurableGridRegistries } from './configuration.registries';

interface TestRow {
  meta: { id: string };
  amount: number;
  readonly: boolean;
}

const registries: ConfigurableGridRegistries<TestRow> = {
  filters: new Set(['agNumberColumnFilter']),
  editors: new Set(['agNumberCellEditor']),
  renderers: new Set(),
  valueFormatters: {
    suffix: (config) => ({ value }) => `${String(value)}${String(config?.suffix ?? '')}`,
  },
  valueParsers: {
    number: () => ({ newValue }) => Number(newValue),
  },
  validators: { ...defaultGridValidatorRegistry },
};

function createEntity(overrides: Record<string, unknown> = {}) {
  return normalizeEntityDefinition({
    labelKey: 'entity.label',
    dataAdapterKey: 'test',
    rowId: { path: 'meta.id' },
    fields: [{
      colId: 'amount',
      field: 'amount',
      labelKey: 'fields.amount',
      cellDataType: 'number',
      sortable: true,
      filter: 'agNumberColumnFilter',
      filterParams: { filterOptions: ['equals', 'greaterThan'] },
      editable: true,
      cellEditor: 'agNumberCellEditor',
      cellEditorParams: { min: 0 },
      validationRules: [{
        key: 'numberRange',
        params: { min: 0, max: 100 },
        message: 'Amount must be in range.',
      }],
      valueFormatterKey: 'suffix',
      valueFormatterConfig: { suffix: ' USD' },
      valueParserKey: 'number',
      ...overrides,
    }],
  });
}

describe('configurable SSRM compiler', () => {
  it('compiles labels, stable row identity, registries and runtime editability into native ColDef', () => {
    const compiled = compileConfigurableSsrmEntity<TestRow>({
      entity: createEntity(),
      registries,
      resolveLabel: (key) => (key === 'fields.amount' ? 'Amount' : key),
      runtimePolicy: {
        isCellEditable: ({ data }) => Boolean(data && !data.readonly),
      },
    });

    const amount = compiled.columnDefs[0];
    expect(amount?.headerName).toBe('Amount');
    expect(amount?.filterParams).toMatchObject({
      buttons: ['reset', 'apply'],
      closeOnApply: true,
      maxNumConditions: 1,
      filterOptions: ['equals', 'greaterThan'],
    });
    expect(compiled.getRowIdFromData({ meta: { id: 'row-7' }, amount: 10, readonly: false })).toBe('row-7');
    expect(typeof amount?.editable).toBe('function');
    expect(typeof amount?.valueFormatter).toBe('function');
    expect(typeof amount?.valueParser).toBe('function');
  });

  it('merges static editor params with runtime native validation callbacks', () => {
    const compiled = compileConfigurableSsrmEntity<TestRow>({
      entity: createEntity(),
      registries,
      resolveLabel: (key) => key,
    });

    const editorParams = compiled.columnDefs[0]?.cellEditorParams as {
      min?: number;
      getValidationErrors?: (params: { value: unknown }) => string[] | null;
    };

    expect(editorParams.min).toBe(0);
    expect(editorParams.getValidationErrors?.({ value: -1 })).toEqual(['Amount must be in range.']);
    expect(editorParams.getValidationErrors?.({ value: 50 })).toBeNull();
  });

  it('rejects component and executable registry keys that are not allowlisted', () => {
    expect(() => compileConfigurableSsrmEntity<TestRow>({
      entity: createEntity({ cellEditor: 'unknownEditor' }),
      registries,
      resolveLabel: (key) => key,
    })).toThrow(/Unsupported configurable cell editor: unknownEditor/);

    expect(() => compileConfigurableSsrmEntity<TestRow>({
      entity: createEntity({ valueFormatterKey: 'unknownFormatter' }),
      registries,
      resolveLabel: (key) => key,
    })).toThrow(/Unknown configurable value formatter: unknownFormatter/);
  });

  it('fails fast when rowId.path does not resolve to a stable primitive ID', () => {
    const compiled = compileConfigurableSsrmEntity<TestRow>({
      entity: createEntity(),
      registries,
      resolveLabel: (key) => key,
    });

    expect(() => compiled.getRowIdFromData({ meta: { id: '' }, amount: 10, readonly: false }))
      .toThrow(/did not resolve to a stable string\/number ID/);
  });
});
