import type { RowClassParams, RowClassRules } from 'ag-grid-community';
import type { GridRowInteractionMode } from './gridRowInteraction';

/**
 * Recommended backend/frontend row shape for tables using the shared interaction capability.
 *
 * A table does NOT have to use this exact property name. The shared factories accept `getMode` for
 * features whose API exposes the mode somewhere else. The default property keeps the common case
 * small for future tables.
 */
export interface GridRowWithInteractionMode {
  interactionMode: GridRowInteractionMode;
}

/**
 * CSS classes used by the common interaction states.
 *
 * `enabled` intentionally has no default class. Normal rows should continue to use the normal AG Grid
 * theme, including AG Grid's own selected-row styling. Only restricted states need extra treatment.
 */
export interface GridRowInteractionClassNames {
  selectionDisabled: string;
  readOnly: string;
}

export const DEFAULT_GRID_ROW_INTERACTION_CLASS_NAMES: GridRowInteractionClassNames = {
  selectionDisabled: 'grid-row--selection-disabled',
  readOnly: 'grid-row--read-only',
};

interface GridRowInteractionClassGetterBaseOptions<TData> {
  classNames?: Partial<GridRowInteractionClassNames>;
  getAdditionalClass?: (row: TData) => string | undefined;
}

export type GridRowInteractionDefaultClassGetterOptions<TData> =
  GridRowInteractionClassGetterBaseOptions<TData> & {
    getMode?: never;
  };

export type GridRowInteractionAdaptedClassGetterOptions<TData> =
  GridRowInteractionClassGetterBaseOptions<TData> & {
    getMode: (row: TData) => GridRowInteractionMode;
  };

interface GridRowInteractionClassGetterImplementationOptions<TData>
  extends GridRowInteractionClassGetterBaseOptions<TData> {
  getMode?: (row: TData) => GridRowInteractionMode;
}

interface GridRowInteractionClassRulesBaseOptions {
  classNames?: Partial<GridRowInteractionClassNames>;
}

export type GridRowInteractionDefaultClassRulesOptions = GridRowInteractionClassRulesBaseOptions & {
  getMode?: never;
};

export type GridRowInteractionAdaptedClassRulesOptions<TData> =
  GridRowInteractionClassRulesBaseOptions & {
    getMode: (row: TData) => GridRowInteractionMode;
  };

interface GridRowInteractionClassRulesImplementationOptions<TData>
  extends GridRowInteractionClassRulesBaseOptions {
  getMode?: (row: TData) => GridRowInteractionMode;
}

function resolveClassNames(
  classNames?: Partial<GridRowInteractionClassNames>,
): GridRowInteractionClassNames {
  return {
    selectionDisabled:
      classNames?.selectionDisabled ?? DEFAULT_GRID_ROW_INTERACTION_CLASS_NAMES.selectionDisabled,
    readOnly: classNames?.readOnly ?? DEFAULT_GRID_ROW_INTERACTION_CLASS_NAMES.readOnly,
  };
}

function readInteractionMode<TData extends object>(
  row: TData,
  getMode?: (row: TData) => GridRowInteractionMode,
): GridRowInteractionMode {
  return getMode
    ? getMode(row)
    : (row as TData & GridRowWithInteractionMode).interactionMode;
}

/**
 * Build AG Grid `rowClassRules` for mutable interaction state.
 *
 * This is the preferred mechanism for `interactionMode` because authoritative data can change a row
 * from `selectionDisabled`/`readOnly` to another mode. AG Grid removes a rule-owned class when the rule
 * later evaluates false, whereas `getRowClass` classes are additive and can remain stale after refresh.
 */
export function createGridRowInteractionClassRules<TData extends GridRowWithInteractionMode>(
  options?: GridRowInteractionDefaultClassRulesOptions,
): RowClassRules<TData>;

/** Same dynamic rules for a feature whose backend stores the mode somewhere else. */
export function createGridRowInteractionClassRules<TData extends object>(
  options: GridRowInteractionAdaptedClassRulesOptions<TData>,
): RowClassRules<TData>;

export function createGridRowInteractionClassRules<TData extends object>(
  options: GridRowInteractionClassRulesImplementationOptions<TData> = {},
): RowClassRules<TData> {
  const classNames = resolveClassNames(options.classNames);

  return {
    [classNames.selectionDisabled]: (params: RowClassParams<TData>) =>
      Boolean(
        params.data && readInteractionMode(params.data, options.getMode) === 'selectionDisabled',
      ),
    [classNames.readOnly]: (params: RowClassParams<TData>) =>
      Boolean(params.data && readInteractionMode(params.data, options.getMode) === 'readOnly'),
  };
}

/**
 * Build an additive AG Grid `getRowClass` callback.
 *
 * IMPORTANT: do not use this helper for a class whose condition can change while the same RowNode is
 * alive. AG Grid does not remove old `getRowClass` classes on refresh. Use
 * `createGridRowInteractionClassRules` for mutable interaction state instead. This getter remains useful
 * only for genuinely additive/static feature classes and backwards-compatible adapters.
 */
export function createGridRowInteractionClassGetter<TData extends GridRowWithInteractionMode>(
  options?: GridRowInteractionDefaultClassGetterOptions<TData>,
): (params: RowClassParams<TData>) => string | undefined;

export function createGridRowInteractionClassGetter<TData extends object>(
  options: GridRowInteractionAdaptedClassGetterOptions<TData>,
): (params: RowClassParams<TData>) => string | undefined;

export function createGridRowInteractionClassGetter<TData extends object>(
  options: GridRowInteractionClassGetterImplementationOptions<TData> = {},
): (params: RowClassParams<TData>) => string | undefined {
  const classNames = resolveClassNames(options.classNames);

  return (params: RowClassParams<TData>): string | undefined => {
    if (!params.data) return undefined;

    const row = params.data;
    const mode = readInteractionMode(row, options.getMode);

    let interactionClass: string | undefined;
    if (mode === 'selectionDisabled') {
      interactionClass = classNames.selectionDisabled;
    } else if (mode === 'readOnly') {
      interactionClass = classNames.readOnly;
    }

    const additionalClass = options.getAdditionalClass?.(row);

    if (interactionClass && additionalClass) return `${interactionClass} ${additionalClass}`;
    return interactionClass ?? additionalClass;
  };
}
