
import type { SelectionHeaderState } from '../serverSelection';

/**
 * Small contract between Infinite Row Model selection rules and an AG Grid table.
 *
 * WHY THIS LIVES IN `shared/grid`
 * --------------------------------
 * Nothing in this contract is specific to Transactions. Any future Infinite Row Model table
 * (Payments, Customers, Audit Logs, etc.) can use the same selection strategies.
 *
 * AG Grid's Infinite Row Model supports normal row selection when stable row IDs are supplied,
 * but it does not provide Select All across rows that have not been loaded into the browser.
 * Application code therefore owns only that missing selection intent while AG Grid continues to
 * own the actual rendered row checkboxes/events.
 *
 * Keep this interface deliberately small. It is NOT a replacement for AG Grid's Grid API.
 * If AG Grid already provides a behaviour correctly, use the native API/event instead of adding
 * another method here.
 */
export interface InfiniteSelectionController {
  /** State rendered by the custom Infinite header checkbox. */
  headerState: SelectionHeaderState;

  /** Accessible label explaining the scope of the custom header checkbox. */
  headerLabel: string;

  /**
   * Returns whether a currently loaded row should appear selected.
   *
   * Dataset-level strategies can represent rows that AG Grid has never loaded, so a loaded row's
   * visual checkbox is derived from the application selection intent through this function.
   */
  isRowSelected: (rowId: string) => boolean;

  /** Receives a user-originated row checkbox change from AG Grid. */
  setRowSelected: (rowId: string, selected: boolean) => void;

  /**
   * Handles the custom Infinite header checkbox.
   *
   * Infinite Row Model does not provide native Select All, which is why this behaviour belongs to
   * our application rather than simply configuring AG Grid's built-in header checkbox.
   */
  setHeaderSelected: (checked: boolean) => void;

  /**
   * Explicitly clears the strategy's entire selection.
   *
   * This is for a deliberate application/user reset. It must NOT be treated as a generic response
   * to pagination, sorting, filtering, cache eviction, or block reload.
   */
  clearSelection: () => void;

  /**
   * Optional strategy-specific reaction to an AG Grid filter change.
   *
   * IMPORTANT: a filter change does NOT automatically mean selection should be cleared.
   *
   * The decision depends on the current selection representation:
   *
   * - `include` means explicit selected IDs. Those IDs remain valid even if the visible filter
   *   changes, so they are preserved.
   *
   * - `filtered + exclude` means "Select All Filtered" is active. The old filter defines which
   *   backend dataset was selected. When that filter changes, the selected dataset changes, so this
   *   strategy must clear/rebase to avoid applying old exclusions to a different query.
   *
   * - `all + exclude` means "Select All Records" is active. The visible filter does not define the
   *   selected dataset, so filtering must not clear it.
   *
   * Sorting is intentionally absent from this interface because sorting changes row order, not row
   * identity or dataset membership.
   */
  onFilterChanged?: () => void;
}
