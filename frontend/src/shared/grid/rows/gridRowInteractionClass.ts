import type { RowClassParams } from 'ag-grid-community';
import type { GridRowInteractionMode } from './gridRowInteraction';

/**
 * Recommended backend/frontend row shape for tables using the shared interaction capability.
 *
 * A table does NOT have to use this exact property name. `createGridRowInteractionClassGetter`
 * accepts `getMode` for features whose API exposes the mode somewhere else. The default property
 * exists only to make the common case very small for future tables.
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
  /**
   * Optional replacement class names. Override these only when a grid intentionally needs different
   * presentation; the interaction semantics themselves do not change.
   */
  classNames?: Partial<GridRowInteractionClassNames>;

  /**
   * Optional feature-only class appended AFTER the common interaction class.
   *
   * This is the escape hatch for a table-specific row style without copying the AG Grid interaction
   * mapping. Example: a Transaction feature might add `transaction-row--high-value` while still
   * receiving the common `grid-row--read-only` class when appropriate.
   *
   * Keep general conditional-row styling as its own capability; this option is intentionally small.
   */
  getAdditionalClass?: (row: TData) => string | undefined;
}

/**
 * Common case: the row follows the recommended API contract and exposes `interactionMode` directly.
 * No adapter is required.
 */
export type GridRowInteractionDefaultClassGetterOptions<TData> =
  GridRowInteractionClassGetterBaseOptions<TData> & {
    getMode?: never;
  };

/**
 * Adapted case: a feature uses another backend shape and explicitly tells shared grid code where the
 * generic mode lives.
 */
export type GridRowInteractionAdaptedClassGetterOptions<TData> =
  GridRowInteractionClassGetterBaseOptions<TData> & {
    getMode: (row: TData) => GridRowInteractionMode;
  };

/**
 * Build an AG Grid `getRowClass` callback for rows that expose the recommended `interactionMode`
 * property directly.
 *
 * The overload is intentional: TypeScript will reject a row type that does NOT contain
 * `interactionMode` unless the caller uses the adapted overload below and supplies `getMode`.
 */
export function createGridRowInteractionClassGetter<TData extends GridRowWithInteractionMode>(
  options?: GridRowInteractionDefaultClassGetterOptions<TData>,
): (params: RowClassParams<TData>) => string | undefined;

/**
 * Build the same AG Grid callback for a feature whose backend row stores the mode somewhere else.
 *
 * Example:
 *
 * createGridRowInteractionClassGetter<Payable>({
 *   getMode: (row) => row.permissions.gridInteractionMode,
 * });
 */
export function createGridRowInteractionClassGetter<TData extends object>(
  options: GridRowInteractionAdaptedClassGetterOptions<TData>,
): (params: RowClassParams<TData>) => string | undefined;

/**
 * Implementation shared by both overloads.
 *
 * WHY A FACTORY IN SHARED CODE?
 * -----------------------------
 * Without this helper every feature would need to know that AG Grid calls `getRowClass` with
 * `RowClassParams`, remember to handle loading/stub rows with no data, repeat the interaction-mode
 * switch, and merge extra classes correctly. That is genuine reusable grid mechanics, not domain logic.
 */
export function createGridRowInteractionClassGetter<TData extends object>(
  options:
    | GridRowInteractionDefaultClassGetterOptions<TData & GridRowWithInteractionMode>
    | GridRowInteractionAdaptedClassGetterOptions<TData> = {},
): (params: RowClassParams<TData>) => string | undefined {
  // Resolve defaults once when the callback is created, not for every row render. Using `??` instead
  // of object-spreading a Partial also guarantees the final values are always real strings.
  const classNames: GridRowInteractionClassNames = {
    selectionDisabled:
      options.classNames?.selectionDisabled ??
      DEFAULT_GRID_ROW_INTERACTION_CLASS_NAMES.selectionDisabled,
    readOnly: options.classNames?.readOnly ?? DEFAULT_GRID_ROW_INTERACTION_CLASS_NAMES.readOnly,
  };

  return (params: RowClassParams<TData>): string | undefined => {
    // Infinite/SSRM may temporarily ask AG Grid to render a RowNode before its server data is present.
    // There is no row policy or feature-only class to evaluate yet, so return no class.
    if (!params.data) return undefined;

    const row = params.data;

    // Prefer the explicit adapter when supplied. Otherwise use the recommended common API property.
    // The overloads above make this cast safe for callers: a row without `interactionMode` cannot use
    // the no-adapter signature.
    const mode =
      'getMode' in options && options.getMode
        ? options.getMode(row)
        : (row as TData & GridRowWithInteractionMode).interactionMode;

    let interactionClass: string | undefined;

    // `enabled` deliberately maps to no class. Normal/selected visuals remain AG Grid theme-owned.
    if (mode === 'selectionDisabled') {
      interactionClass = classNames.selectionDisabled;
    } else if (mode === 'readOnly') {
      interactionClass = classNames.readOnly;
    }

    // A feature may append one feature-only class without replacing the common restriction class.
    // Example result: "grid-row--read-only transaction-row--high-value".
    const additionalClass = options.getAdditionalClass?.(row);

    if (interactionClass && additionalClass) return `${interactionClass} ${additionalClass}`;
    return interactionClass ?? additionalClass;
  };
}
