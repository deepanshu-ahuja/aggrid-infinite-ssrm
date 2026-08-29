// GRIDCAP-CONFIGURABLE-TABLE
import type { ColDef, ValueFormatterParams } from 'ag-grid-community';
import type {
  ConfigurableTableDefinition,
  ConfigurableTableFilterType,
  ConfigurableTableJsonObject,
} from './configurableTable.types';
import { ConfigurableTableDefinitionError } from './configurableTable.validation';

export type ConfigurableTableFormatter<TData> = (
  params: ValueFormatterParams<TData>,
  metadataParams: ConfigurableTableJsonObject | undefined,
) => string;

export interface ConfigurableTableRegistries<TData> {
  renderers?: Record<string, NonNullable<ColDef<TData>['cellRenderer']>>;
  editors?: Record<string, NonNullable<ColDef<TData>['cellEditor']>>;
  formatters?: Record<string, ConfigurableTableFormatter<TData>>;
}

export interface CompiledConfigurableTable<TData> {
  definition: ConfigurableTableDefinition;
  columnDefs: ColDef<TData>[];
}

const FILTER_COMPONENTS: Record<ConfigurableTableFilterType, string> = {
  text: 'agTextColumnFilter',
  number: 'agNumberColumnFilter',
  date: 'agDateColumnFilter',
};

function missingRegistryKey(kind: string, key: string, columnId: string): never {
  throw new ConfigurableTableDefinitionError(
    `definition.columns.${columnId}.${kind}: unknown required registry key "${key}"`,
  );
}

/**
 * Convert validated application metadata into ordinary AG Grid ColDef values. Shared loading,
 * selection, editing and lifecycle hooks remain unaware of the metadata schema.
 */
export function compileConfigurableTable<TData>(
  definition: ConfigurableTableDefinition,
  registries: ConfigurableTableRegistries<TData>,
): CompiledConfigurableTable<TData> {
  const columnDefs = definition.columns.map<ColDef<TData>>((column) => {
    const colDef: ColDef<TData> = {
      colId: column.id,
      field: column.field as ColDef<TData>['field'],
      headerName: column.header,
      sortable: column.sort?.enabled ?? false,
      filter: column.filter ? FILTER_COMPONENTS[column.filter.type] : false,
      ...(column.dataType === 'number' ? { type: 'numericColumn' } : {}),
      ...column.layout,
    };

    if (column.renderer) {
      const renderer = registries.renderers?.[column.renderer.key];
      if (!renderer) missingRegistryKey('renderer', column.renderer.key, column.id);
      colDef.cellRenderer = renderer;
      if (column.renderer.params) colDef.cellRendererParams = column.renderer.params;
    }

    if (column.formatter) {
      const formatter = registries.formatters?.[column.formatter.key];
      if (!formatter) missingRegistryKey('formatter', column.formatter.key, column.id);
      const metadataParams = column.formatter.params;
      colDef.valueFormatter = (params) => formatter(params, metadataParams);
    }

    if (column.editing) {
      colDef.editable = column.editing.supported;
      if (column.editing.supported && column.editing.editor) {
        const editor = registries.editors?.[column.editing.editor.key];
        if (!editor) missingRegistryKey('editor', column.editing.editor.key, column.id);
        colDef.cellEditor = editor;
        if (column.editing.editor.params) colDef.cellEditorParams = column.editing.editor.params;
      }
    }

    return colDef;
  });

  return { definition, columnDefs };
}
