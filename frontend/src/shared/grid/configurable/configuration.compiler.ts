// GRIDCAP-COLUMNS | GRIDCAP-ROW-ID | GRIDCAP-EDIT-VALIDATION
import type {
  ColDef,
  EditableCallbackParams,
  GetRowIdFunc,
  GridOptions,
  ICellEditorParams,
  IsRowSelectable,
} from 'ag-grid-community';
import {
  configurableSsrmGridDefaults,
  resolveConfigurableSsrmGridOptions,
} from './configuration.defaults';
import type {
  ConfigurationJsonObject,
  ConfigurableDefaultColDef,
  ConfigurableSsrmGridOptions,
  EntityDefinition,
} from './configuration.types';
import {
  requireAllowedComponentName,
  requireRegisteredKey,
  type ConfigurableGridComponents,
  type ConfigurableGridRegistries,
} from './configuration.registries';
import { validateGridValue } from '../validation/gridValidation';

export interface ConfigurableGridRuntimePolicy<TData> {
  /**
   * Business/access policy composed only when metadata makes a column editable.
   *
   * Native AG Grid interactions (single edit, Fill Handle, clipboard, Ctrl+D/Ctrl+Enter) all consult
   * this final `ColDef.editable`, so business eligibility is not reimplemented for each interaction.
   */
  isCellEditable?: (params: EditableCallbackParams<TData>) => boolean;
  /** Runtime business selection policy; never persisted as backend JSON. */
  isRowSelectable?: IsRowSelectable<TData>;
}

export interface CompileConfigurableSsrmEntityOptions<TData> {
  entity: EntityDefinition;
  registries: ConfigurableGridRegistries<TData>;
  resolveLabel: (labelKey: string) => string;
  runtimePolicy?: ConfigurableGridRuntimePolicy<TData>;
  defaults?: ConfigurableSsrmGridOptions;
}

export interface CompiledConfigurableSsrmEntity<TData> {
  /** Native declarative/runtime GridOptions safe to spread before concrete lifecycle-owned props. */
  gridOptions: GridOptions<TData>;
  /** Final native AG Grid ColDefs after defaults, registries, labels, validation and business policy. */
  columnDefs: ColDef<TData>[];
  /** Runtime callback compiled from declarative `rowId.path`. */
  getRowId: GetRowIdFunc<TData>;
  /** Same identity accessor for shared draft state that works directly from a row object. */
  getRowIdFromData: (data: TData) => string;
  /** Frontend-owned custom AG Grid component registrations. */
  components?: ConfigurableGridComponents<TData>;
}

function mergeJsonObject(
  base: ConfigurationJsonObject | undefined,
  override: ConfigurationJsonObject | undefined,
): ConfigurationJsonObject | undefined {
  if (!base) return override ? { ...override } : undefined;
  if (!override) return { ...base };
  return { ...base, ...override };
}

function mergeFieldNativeOptions(
  defaultColDef: ConfigurableDefaultColDef | undefined,
  field: EntityDefinition['fields'][number],
) {
  const merged = {
    ...(defaultColDef ?? {}),
    ...field,
  };

  merged.filterParams =
    defaultColDef?.filterParams || field.filterParams
      ? {
          ...(defaultColDef?.filterParams ?? {}),
          ...(field.filterParams ?? {}),
        }
      : undefined;

  merged.cellEditorParams = mergeJsonObject(
    defaultColDef?.cellEditorParams,
    field.cellEditorParams,
  );
  merged.cellRendererParams = mergeJsonObject(
    defaultColDef?.cellRendererParams,
    field.cellRendererParams,
  );

  return merged;
}

function validateConfiguredComponentNames<TData>(
  field: ReturnType<typeof mergeFieldNativeOptions>,
  registries: ConfigurableGridRegistries<TData>,
) {
  if (typeof field.filter === 'string') {
    requireAllowedComponentName(registries.filters, field.filter, 'filter');
  }
  if (field.cellEditor) {
    requireAllowedComponentName(registries.editors, field.cellEditor, 'cell editor');
  }
  if (field.cellRenderer) {
    requireAllowedComponentName(registries.renderers, field.cellRenderer, 'cell renderer');
  }
}

function readPathValue(value: unknown, path: string): unknown {
  let current = value;

  for (const segment of path.split('.')) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

/** Compile a JSON-safe row path into the stable string ID required by AG Grid and draft state. */
export function compileConfigurableRowId<TData>(
  path: string,
): Pick<CompiledConfigurableSsrmEntity<TData>, 'getRowId' | 'getRowIdFromData'> {
  const getRowIdFromData = (data: TData) => {
    const value = readPathValue(data, path);
    if (
      (typeof value !== 'string' && typeof value !== 'number') ||
      (typeof value === 'number' && !Number.isFinite(value)) ||
      String(value).trim().length === 0
    ) {
      throw new Error(`Configured rowId.path "${path}" did not resolve to a stable string/number ID.`);
    }
    return String(value);
  };

  return {
    getRowIdFromData,
    getRowId: ({ data }) => getRowIdFromData(data),
  };
}

function compileField<TData>(
  field: EntityDefinition['fields'][number],
  defaultColDef: ConfigurableDefaultColDef | undefined,
  registries: ConfigurableGridRegistries<TData>,
  resolveLabel: (labelKey: string) => string,
  runtimePolicy: ConfigurableGridRuntimePolicy<TData> | undefined,
): ColDef<TData> {
  const merged = mergeFieldNativeOptions(defaultColDef, field);
  validateConfiguredComponentNames(merged, registries);

  const {
    labelKey,
    validationRules,
    valueFormatterKey,
    valueFormatterConfig,
    valueParserKey,
    valueParserConfig,
    ...native
  } = merged;

  // `FieldDefinition.field` is runtime-validated metadata, while generic `ColDef<TData>` can only
  // prove compile-time paths for statically-known TData. Crossing that deliberate runtime boundary
  // requires one narrow assertion after normalization, not a parallel hand-written ColDef type.
  const colDef = {
    ...native,
    headerName: resolveLabel(labelKey),
  } as ColDef<TData>;

  // Persisted config can enable/disable editability, but executable access policy stays runtime-owned.
  if (native.editable === true && runtimePolicy?.isCellEditable) {
    colDef.editable = runtimePolicy.isCellEditable;
  }

  if (valueFormatterConfig && !valueFormatterKey) {
    throw new Error(`Column "${String(field.colId)}" has valueFormatterConfig without valueFormatterKey.`);
  }
  if (valueFormatterKey) {
    const factory = requireRegisteredKey(
      registries.valueFormatters,
      valueFormatterKey,
      'value formatter',
    );
    colDef.valueFormatter = factory(valueFormatterConfig) as ColDef<TData>['valueFormatter'];
  }

  if (valueParserConfig && !valueParserKey) {
    throw new Error(`Column "${String(field.colId)}" has valueParserConfig without valueParserKey.`);
  }
  if (valueParserKey) {
    const factory = requireRegisteredKey(registries.valueParsers, valueParserKey, 'value parser');
    colDef.valueParser = factory(valueParserConfig) as ColDef<TData>['valueParser'];
  }

  if (validationRules?.length) {
    // Fail configuration compilation immediately for an unknown validator rather than waiting until a
    // user opens an editor. The actual executable functions still stay exclusively in the registry.
    for (const rule of validationRules) {
      requireRegisteredKey(registries.validators, rule.key, 'validation rule');
    }

    const staticEditorParams = colDef.cellEditorParams;
    colDef.cellEditorParams = {
      ...(typeof staticEditorParams === 'object' && staticEditorParams !== null
        ? staticEditorParams
        : {}),
      getValidationErrors: (params: ICellEditorParams<TData, unknown>) => {
        const errors = validateGridValue(params.value, validationRules, registries.validators);
        return errors.length > 0 ? errors.map((error) => error.message) : null;
      },
    };
  }

  return colDef;
}

function compileGridOptions<TData>(
  resolved: ConfigurableSsrmGridOptions,
  runtimePolicy: ConfigurableGridRuntimePolicy<TData> | undefined,
): GridOptions<TData> {
  const { rowSelection, defaultColDef, ...rest } = resolved;

  const compiled: GridOptions<TData> = {
    ...rest,
    // Runtime-normalized string paths cannot satisfy generic TData's compile-time nested-path proof.
    // Keep that assertion at this single metadata/compiler boundary.
    defaultColDef: defaultColDef ? ({ ...defaultColDef } as ColDef<TData>) : undefined,
  };

  if (rowSelection) {
    compiled.rowSelection = {
      ...rowSelection,
      ...(runtimePolicy?.isRowSelectable
        ? { isRowSelectable: runtimePolicy.isRowSelectable }
        : {}),
    } as GridOptions<TData>['rowSelection'];
  }

  return compiled;
}

/**
 * Compile one normalized entity into native AG Grid configuration.
 *
 * Runtime infrastructure is deliberately absent from `gridOptions`: the concrete root still owns
 * rowModelType, datasource, modules, GridApi refs and lifecycle events.
 */
export function compileConfigurableSsrmEntity<TData>({
  entity,
  registries,
  resolveLabel,
  runtimePolicy,
  defaults = configurableSsrmGridDefaults,
}: CompileConfigurableSsrmEntityOptions<TData>): CompiledConfigurableSsrmEntity<TData> {
  const resolved = resolveConfigurableSsrmGridOptions(defaults, entity.gridOptions);

  if (typeof resolved.defaultColDef?.filter === 'string') {
    requireAllowedComponentName(registries.filters, resolved.defaultColDef.filter, 'filter');
  }
  if (resolved.defaultColDef?.cellEditor) {
    requireAllowedComponentName(registries.editors, resolved.defaultColDef.cellEditor, 'cell editor');
  }
  if (resolved.defaultColDef?.cellRenderer) {
    requireAllowedComponentName(registries.renderers, resolved.defaultColDef.cellRenderer, 'cell renderer');
  }

  const rowIdentity = compileConfigurableRowId<TData>(entity.rowId.path);
  const columnDefs = entity.fields.map((field) =>
    compileField(field, resolved.defaultColDef, registries, resolveLabel, runtimePolicy),
  );

  return {
    gridOptions: compileGridOptions(resolved, runtimePolicy),
    columnDefs,
    ...rowIdentity,
    components: registries.components,
  };
}
