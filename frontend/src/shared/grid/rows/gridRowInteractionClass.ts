import type { RowClassParams } from 'ag-grid-community';
import type { GridRowInteractionMode } from './gridRowInteraction';

/**
 * Recommended backend/frontend row shape for tables using the shared interaction capability.
 *
 * A table does NOT have to use this exact property name. `createGridRowInteractionClassGetter`
 * accepts `getMode` for features whose API exposes the mode somewhere else. The default exists only
 * to make the common case very small for future tables.
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

/**
 * Options for adapting a feature row to the shared AG Grid `getRowClass` behaviour.
 *
 * The helper deliberately exposes ROW-DATA callbacks, not AG Grid RowNode details. A developer adding
 * another server-backed table should only need to answer domain questions such as "where is the mode"
 * or "does this row need another feature-only class". The helper owns the AG Grid callback shape.
 */
export interface GridRowInteractionClassGetterOptions<TData> {
  /**
   * Optional adapter for a feature that does not expose `row.interactionMode` directly.
   *
   * Example:
   * `getMode: (payable) => payable.permissions.gridInteractionMode`
   */
  getMode?: (row: TData) => GridRowInteractionMode;

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
 * Build an AG Grid `getRowClass` callback for the common row-interaction states.
 *
 * WHY A FACTORY IN SHARED CODE?
 * -----------------------------
 * Without this helper every feature would need to know that AG Grid calls `getRowClass` with
 * `RowClassParams`, remember to handle loading/stub rows with no data, repeat the interaction-mode
 * switch, and merge extra classes correctly. That is real reusable grid mechanics, not domain logic.
 *
 * DEFAULT PROPERTY
 * ----------------
 * If `getMode` is omitted, the helper expects the recommended `interactionMode` property. This keeps
 * the normal case tiny. A feature with another API shape can pass `getMode` instead of renaming data or
 * copying this function.
 */
export function createGridRowInteractionClassGetter<TData extends object>(
  options: GridRowInteractionClassGetterOptions<TData> = {},
): (params: RowClassParams<TData>) => string | undefined {
  // Merge defaults once when the callback is created, not once per rendered row.
  const classNames: GridRowInteractionClassNames = {
    ...DEFAULT_GRID_ROW_INTERACTION_CLASS_NAMES,
    ...options.classNames,
  };

  return (params: RowClassParams<TData>): string | undefined => {
    // Infinite/SSRM may temporarily ask AG Grid to render a RowNode before its server data is present.
    // There is no row policy or feature-only class to evaluate yet, so return no class.
    if (!params.data) return undefined;

    const row = params.data;

    // Prefer the feature adapter when supplied. Otherwise use the recommended common API property.
    // The cast is isolated here so every feature does not need its own AG Grid adapter merely to read
    // the same conventional `interactionMode` field.
    const mode = options.getMode
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
