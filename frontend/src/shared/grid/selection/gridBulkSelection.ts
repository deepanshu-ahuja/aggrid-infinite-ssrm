import type {
  GridSelectionId,
  ServerSelectionIntent,
} from './serverSelection';

/**
 * Backend-facing selection payload produced when the user eventually invokes a bulk action.
 *
 * This contract deliberately does NOT contain the Infinite UI mode (`page | filtered | all`).
 *
 * The selected dataset is expressed using only:
 *
 * - `include` + exact IDs; or
 * - `exclude` + exception IDs + backend filters defining the starting dataset.
 *
 * INCLUDE
 * -------
 *
 * ```text
 * { mode: 'include', ids: ['A', 'B'] }
 * ```
 *
 * means:
 *
 * > Operate on exactly A and B.
 *
 * Filters are intentionally absent because they must not redefine explicit row membership.
 *
 * EXCLUDE
 * -------
 *
 * ```text
 * {
 *   mode: 'exclude',
 *   ids: ['A'],
 *   filters: [...]
 * }
 * ```
 *
 * means:
 *
 * > Start with every backend row matching `filters`, then remove A.
 *
 * An empty filter array is meaningful:
 *
 * ```text
 * {
 *   mode: 'exclude',
 *   ids: ['A'],
 *   filters: []
 * }
 * ```
 *
 * means:
 *
 * > Start with the complete unfiltered dataset, then remove A.
 *
 * This keeps the backend contract unambiguous without carrying a redundant `scope` field.
 */
export type GridBulkSelection<
  TId extends GridSelectionId,
  TFilter,
> =
  | {
      mode: 'include';
      ids: TId[];
    }
  | {
      mode: 'exclude';
      ids: TId[];
      filters: TFilter[];
    };

/**
 * Converts logical grid selection into the payload shape a future bulk-action request can send.
 *
 * @param selection Current logical selection emitted by the shared selection hooks.
 * @param filters Backend filters defining the candidate dataset when `selection.mode === 'exclude'`.
 *
 * WHY `filters` IS REQUIRED
 * -------------------------
 * The second argument is deliberately required even though include selection does not use it.
 *
 * We must never silently default a missing filter context to `[]`.
 *
 * For exclude selection:
 *
 * ```text
 * filters = [Status = Completed]
 * ```
 *
 * means:
 *
 * > all Completed rows except the excluded IDs
 *
 * while:
 *
 * ```text
 * filters = []
 * ```
 *
 * means:
 *
 * > all records except the excluded IDs
 *
 * If this helper defaulted an omitted filter argument to `[]`, a caller that accidentally forgot
 * the active filtered query could turn "all filtered rows" into "all records". Requiring the
 * argument forces the feature/action layer to make that decision explicitly.
 *
 * INCLUDE BEHAVIOUR
 * -----------------
 * Exact IDs already define membership, so filters are intentionally discarded:
 *
 * ```text
 * selection = include [A, B]
 * active filters = [Status = Completed]
 *
 * result = include [A, B]
 * ```
 *
 * This is important because A/B remain explicitly selected even if the visible grid filter later
 * changes.
 *
 * EXCLUDE BEHAVIOUR
 * -----------------
 * Exclude means dataset Select All is active, so the backend needs both:
 *
 * - exception IDs;
 * - the backend filters that define the selected dataset.
 *
 * This helper is pure. It does not call an API, read AG Grid state, or know anything about
 * Transactions. Feature code supplies already-mapped backend filters when an actual action is
 * eventually executed.
 */
export function buildGridBulkSelection<
  TId extends GridSelectionId,
  TFilter,
>(
  selection: ServerSelectionIntent<TId>,
  filters: readonly TFilter[],
): GridBulkSelection<TId, TFilter> {
  if (selection.mode === 'include') {
    return {
      mode: 'include',
      ids: [...selection.ids],
    };
  }

  return {
    mode: 'exclude',
    ids: [...selection.ids],
    filters: [...filters],
  };
}
