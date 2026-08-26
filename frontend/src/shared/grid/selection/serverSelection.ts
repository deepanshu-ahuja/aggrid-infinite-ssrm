/**
 * Dataset-wide Select-All meanings supported by the custom Infinite Row Model strategy.
 *
 * IMPORTANT:
 * This type controls UI/lifecycle behaviour only. It is NOT part of the serialised logical
 * selection intent.
 *
 * - `filtered`: Select All means every row matching the active backend filter.
 * - `all`: Select All means every row in the complete dataset.
 */
export type DatasetSelectionScope = 'filtered' | 'all';

/**
 * UI strategy chosen by an Infinite Row Model table.
 *
 * `page`, `filtered`, and `all` answer one question only:
 *
 *     "What should the custom header checkbox do?"
 *
 * They do NOT describe the final logical selection object.
 *
 * Example:
 * - UI mode is `page`.
 * - Page 1 header selects A and B.
 * - User moves to Page 2 and manually selects C.
 *
 * Logical selection is simply:
 *
 *     include [A, B, C]
 *
 * The pagination history is irrelevant to the selection itself.
 */
export type InfiniteSelectionMode = 'page' | DatasetSelectionScope;

export type GridSelectionId = string | number;

/**
 * Compact in-memory selection representation for datasets that may be much larger than browser
 * memory.
 *
 * `include`
 * ---------
 * IDs are the exact selected rows.
 *
 * Example:
 *
 *     include [A, B]
 *
 * means only A and B are selected.
 *
 * `exclude`
 * ---------
 * Select All is active and IDs are exceptions.
 *
 * Example:
 *
 *     exclude []
 *
 * means everything in the Select-All dataset is selected.
 *
 *     exclude [A]
 *
 * means everything in that dataset except A is selected.
 *
 * Which dataset `exclude` refers to is decided by the UI strategy that owns the state:
 *
 * - filtered strategy -> all rows matching the defining filter;
 * - all strategy      -> all records.
 *
 * That UI strategy is intentionally NOT duplicated inside this state object.
 */
export interface ServerSelection<TId extends GridSelectionId = string> {
  mode: 'include' | 'exclude';
  ids: ReadonlySet<TId>;
}

/**
 * JSON-safe snapshot of the current logical selection.
 *
 * This deliberately contains ONLY:
 *
 *     mode + ids
 *
 * It does not contain `page`, `filtered`, `all`, or `explicit`.
 *
 * Why?
 * ----
 * Manual selection has the same meaning regardless of UI configuration:
 *
 *     include [A, B]
 *
 * means "A and B are selected" whether the grid header is configured for page, filtered, or all.
 *
 * `exclude` means Select All is active and the IDs are exceptions. The feature that owns the UI
 * strategy already knows whether that Select All represents filtered rows or all rows.
 *
 * IMPORTANT:
 * This is still NOT the final backend bulk-action request.
 *
 * A later action builder will combine this logical selection with the action context:
 *
 * - include -> exact IDs;
 * - filtered exclude -> exclusions + the defining backend filters;
 * - all exclude -> exclusions + an empty/unfiltered query.
 *
 * Keeping that action/query context outside this generic state prevents redundant or contradictory
 * fields such as `scope: 'all'` together with non-empty filters.
 */
export interface ServerSelectionIntent<TId extends GridSelectionId = string> {
  mode: ServerSelection<TId>['mode'];
  ids: TId[];
}

/** Visual state required by the custom Infinite header checkbox. */
export interface SelectionHeaderState {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
}

/** Creates the neutral state: no rows selected. */
export function createEmptyServerSelection<TId extends GridSelectionId>(): ServerSelection<TId> {
  return { mode: 'include', ids: new Set<TId>() };
}

/**
 * Returns whether one row ID is logically selected.
 *
 * This same membership rule works for every currently loaded AG Grid RowNode:
 *
 * - include -> ID must be present;
 * - exclude -> ID must NOT be present.
 */
export function isServerRowSelected<TId extends GridSelectionId>(
  selection: ServerSelection<TId>,
  id: TId,
) {
  return selection.mode === 'include' ? selection.ids.has(id) : !selection.ids.has(id);
}

/**
 * Applies one user row-checkbox change to the compact include/exclude representation.
 *
 * Include mode:
 *
 *     include [A, B]
 *     user checks C
 *     -> include [A, B, C]
 *
 * Exclude mode:
 *
 *     exclude []
 *     user unchecks A
 *     -> exclude [A]
 *
 * In exclude mode the IDs are exceptions, not selected IDs.
 */
export function updateRowSelection<TId extends GridSelectionId>(
  selection: ServerSelection<TId>,
  id: TId,
  selected: boolean,
): ServerSelection<TId> {
  const ids = new Set(selection.ids);

  if (selection.mode === 'include') {
    if (selected) ids.add(id);
    else ids.delete(id);
  } else if (selected) {
    // Selecting an excluded row again removes it from the exception list.
    ids.delete(id);
  } else {
    // Unchecking one row while Select All is active records an exception.
    ids.add(id);
  }

  return { mode: selection.mode, ids };
}

/**
 * Applies a DATASET-level Infinite header checkbox.
 *
 * Checked:
 *
 *     exclude + []
 *
 * means Select All is active for the dataset represented by the owning strategy.
 *
 * Unchecked:
 *
 *     include + []
 *
 * means nothing is selected.
 *
 * This helper is used only by `filtered` / `all` strategies.
 * Current-page header selection remains ordinary explicit/include IDs.
 */
export function updateDatasetHeaderSelection<TId extends GridSelectionId>(
  checked: boolean,
): ServerSelection<TId> {
  return checked ? { mode: 'exclude', ids: new Set<TId>() } : createEmptyServerSelection<TId>();
}

/**
 * Calculates the dataset-level custom header state without loading every server row.
 *
 * For exclude mode:
 *
 *     selected count = total rows in scope - number of excluded IDs
 */
export function getDatasetHeaderState<TId extends GridSelectionId>(
  selection: ServerSelection<TId>,
  totalRowCount: number,
): SelectionHeaderState {
  const selectedCount =
    selection.mode === 'include'
      ? selection.ids.size
      : Math.max(0, totalRowCount - selection.ids.size);

  const checked = totalRowCount > 0 && selection.mode === 'exclude' && selection.ids.size === 0;

  return {
    checked,
    indeterminate: selectedCount > 0 && !checked,
    disabled: totalRowCount === 0,
  };
}

/** Human-readable label for the dataset-level Infinite Select-All header. */
export function selectionHeaderLabel(scope: DatasetSelectionScope) {
  const label = scope === 'filtered' ? 'filtered results' : 'all records';
  return `Select or clear ${label}`;
}

/**
 * Converts Set-based in-memory selection into a JSON-safe logical selection snapshot.
 *
 * Notice that this function does NOT accept a scope.
 *
 * `page | filtered | all` belongs to UI/lifecycle configuration; serialising the logical selection
 * must not copy that UI configuration into the selection object.
 */
export function toServerSelectionIntent<TId extends GridSelectionId>(
  selection: ServerSelection<TId>,
): ServerSelectionIntent<TId> {
  return {
    mode: selection.mode,
    ids: [...selection.ids],
  };
}
