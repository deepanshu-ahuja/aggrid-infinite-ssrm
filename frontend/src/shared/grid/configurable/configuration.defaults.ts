import type {
  ConfigurableCellSelectionOptions,
  ConfigurableDefaultColDef,
  ConfigurableSsrmGridOptions,
  ConfigurableSsrmRowSelectionOptions,
} from './configuration.types';
import { serverBackedGridDefaults } from '../config/serverBackedGridDefaults';

/**
 * Application defaults for the isolated configurable SSRM runtime.
 *
 * These are application policy, not persisted metadata. In particular, sortable/filterable default
 * to false so the global AG Grid defaults cannot accidentally expose a server query operation that
 * the active feature adapter has not explicitly enabled.
 */
export const configurableSsrmGridDefaults = {
  ...serverBackedGridDefaults,
  invalidEditValueMode: 'block',
  defaultColDef: {
    sortable: false,
    filter: false,
    filterParams: {
      buttons: ['reset', 'apply'],
      closeOnApply: true,
      maxNumConditions: 1,
    },
  },
  rowSelection: {
    mode: 'multiRow',
    checkboxes: true,
    headerCheckbox: true,
    selectAll: 'all',
  },
  cellSelection: {
    enableHeaderHighlight: true,
    handle: {
      mode: 'fill',
      direction: 'y',
    },
  },
} satisfies ConfigurableSsrmGridOptions;

function mergeDefined<T extends object>(base: T, override: Partial<T> | undefined): T {
  // Runtime-normalized JSON cannot contain `undefined`, so object spread gives deterministic
  // "entity value replaces application default" semantics for top-level scalar/array members.
  return override ? ({ ...base, ...override } as T) : { ...base };
}

function mergeDefaultColDef(
  base: ConfigurableDefaultColDef | undefined,
  override: ConfigurableDefaultColDef | undefined,
): ConfigurableDefaultColDef | undefined {
  if (!base) return override ? { ...override } : undefined;
  if (!override) return { ...base };

  const merged = mergeDefined(base, override);

  if (base.filterParams || override.filterParams) {
    merged.filterParams = {
      ...(base.filterParams ?? {}),
      ...(override.filterParams ?? {}),
    };
  }

  if (base.cellEditorParams || override.cellEditorParams) {
    merged.cellEditorParams = {
      ...(base.cellEditorParams ?? {}),
      ...(override.cellEditorParams ?? {}),
    };
  }

  if (base.cellRendererParams || override.cellRendererParams) {
    merged.cellRendererParams = {
      ...(base.cellRendererParams ?? {}),
      ...(override.cellRendererParams ?? {}),
    };
  }

  return merged;
}

function mergeRowSelection(
  base: ConfigurableSsrmRowSelectionOptions | undefined,
  override: ConfigurableSsrmRowSelectionOptions | undefined,
): ConfigurableSsrmRowSelectionOptions | undefined {
  if (!base) return override ? { ...override } : undefined;
  if (!override) return { ...base };

  // The singleRow and multiRow branches have different valid members. A mode change is therefore a
  // branch replacement rather than a shallow merge that could leak multi-row-only values.
  if (base.mode !== override.mode) return { ...override };

  return {
    ...base,
    ...override,
  } as ConfigurableSsrmRowSelectionOptions;
}

function mergeCellSelectionHandle(
  base: ConfigurableCellSelectionOptions['handle'],
  override: ConfigurableCellSelectionOptions['handle'],
): ConfigurableCellSelectionOptions['handle'] {
  if (!base) return override ? { ...override } : undefined;
  if (!override) return { ...base };

  // Range and fill handles are separate native discriminated branches. Only same-mode handles merge.
  if (base.mode !== override.mode) return { ...override };

  return {
    ...base,
    ...override,
  } as ConfigurableCellSelectionOptions['handle'];
}

function mergeCellSelection(
  base: ConfigurableSsrmGridOptions['cellSelection'],
  override: ConfigurableSsrmGridOptions['cellSelection'],
): ConfigurableSsrmGridOptions['cellSelection'] {
  if (override === undefined) {
    return typeof base === 'object' && base !== null ? { ...base } : base;
  }

  // Native boolean cellSelection is a complete enable/disable choice and replaces any object branch.
  if (typeof override === 'boolean') return override;
  if (typeof base !== 'object' || base === null) return { ...override };

  return {
    ...base,
    ...override,
    handle: mergeCellSelectionHandle(base.handle, override.handle),
  };
}

/**
 * Resolve application defaults plus one normalized entity override.
 *
 * Arrays are replacement values. Nested native objects merge only where inheritance is useful and
 * semantically safe: defaultColDef params, same-mode rowSelection, and same-mode cellSelection handle.
 */
export function resolveConfigurableSsrmGridOptions(
  defaults: ConfigurableSsrmGridOptions,
  override: ConfigurableSsrmGridOptions | undefined,
): ConfigurableSsrmGridOptions {
  const resolved = mergeDefined(defaults, override);

  resolved.defaultColDef = mergeDefaultColDef(defaults.defaultColDef, override?.defaultColDef);
  resolved.rowSelection = mergeRowSelection(defaults.rowSelection, override?.rowSelection);
  resolved.cellSelection = mergeCellSelection(defaults.cellSelection, override?.cellSelection);

  return resolved;
}
