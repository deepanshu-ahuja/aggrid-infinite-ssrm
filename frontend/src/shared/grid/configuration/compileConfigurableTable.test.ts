import { describe, expect, it } from 'vitest';
import { compileConfigurableTable } from './compileConfigurableTable';
import { parseConfigurableTableDefinition } from './configurableTable.validation';

interface TestRow {
  id: string;
  status: string;
}

const validDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: 'test.table',
  rowIdField: 'id',
  dataSourceKey: 'testRows',
  columns: [
    {
      id: 'statusColumn',
      field: 'status',
      semanticKey: 'status',
      header: 'Status',
      dataType: 'text',
      layout: { minWidth: 120 },
      sort: { enabled: true },
      filter: { type: 'text' },
      renderer: { key: 'badge', params: { compact: true } },
      formatter: { key: 'uppercase' },
      editing: { supported: true, editor: { key: 'statusEditor' } },
    },
  ],
};

describe('configurable table metadata boundary', () => {
  it('validates JSON metadata and compiles explicit fields through allowlisted registries', () => {
    const renderer = () => 'rendered';
    const editor = 'agTextCellEditor';
    const definition = parseConfigurableTableDefinition(validDefinition);

    const compiled = compileConfigurableTable<TestRow>(definition, {
      renderers: { badge: renderer },
      editors: { statusEditor: editor },
      formatters: {
        uppercase: ({ value }) => String(value ?? '').toUpperCase(),
      },
    });

    expect(compiled.definition).toBe(definition);
    expect(compiled.columnDefs).toHaveLength(1);
    expect(compiled.columnDefs[0]).toMatchObject({
      colId: 'statusColumn',
      field: 'status',
      headerName: 'Status',
      minWidth: 120,
      sortable: true,
      filter: 'agTextColumnFilter',
      editable: true,
      cellRenderer: renderer,
      cellRendererParams: { compact: true },
      cellEditor: editor,
    });
    expect(compiled.columnDefs[0]?.valueFormatter?.({ value: 'pending' } as never)).toBe('PENDING');
  });

  it('rejects unsupported schema versions before compilation', () => {
    expect(() =>
      parseConfigurableTableDefinition({ ...validDefinition, schemaVersion: 2 }),
    ).toThrow(/unsupported schema version 2/);
  });

  it('rejects executable values in provider metadata', () => {
    expect(() =>
      parseConfigurableTableDefinition({
        ...validDefinition,
        columns: [
          {
            ...validDefinition.columns[0],
            renderer: { key: 'badge', params: { callback: () => 'not allowed' } },
          },
        ],
      }),
    ).toThrow(/JSON-safe values only/);
  });

  it('fails predictably when a required registry key is unknown', () => {
    const definition = parseConfigurableTableDefinition(validDefinition);

    expect(() => compileConfigurableTable<TestRow>(definition, {})).toThrow(
      /unknown required registry key "badge"/,
    );
  });
});
