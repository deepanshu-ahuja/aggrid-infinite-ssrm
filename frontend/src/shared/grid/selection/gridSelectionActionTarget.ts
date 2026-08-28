// GRIDCAP-SEL-TARGET | GRIDCAP-SEL-MANUAL | GRIDCAP-SEL-PAGE | GRIDCAP-SEL-FILTERED | GRIDCAP-SEL-ALL | GRIDCAP-ACTION-SELECTED | GRIDCAP-EXPORT-SELECTED
import type { GridSelectionId, ServerSelectionIntent } from './serverSelection';

/**
 * Dataset represented while an `exclude` logical selection is being converted into an action.
 *
 * This is intentionally frontend-only context. It is NOT serialized to the backend:
 *
 * - filtered exclude -> send translated filters;
 * - all-record exclude -> do not send filters.
 *
 * `page` is intentionally absent because selecting a page produces concrete ids and therefore ends
 * up as ordinary `include + ids` before an action request is built.
 */
export type GridSelectionExcludeScope = 'filtered' | 'all';

export interface GridExplicitSelectionTarget<TId extends GridSelectionId = string> {
  mode: 'include';
  ids: TId[];
}

export interface GridExcludeSelectionTarget<TId extends GridSelectionId = string> {
  mode: 'exclude';
  ids: TId[];
}

/**
 * Generic backend-facing selection target shared by server-backed tables.
 *
 * The wire contract intentionally does not carry a separate `scope` field. The meaning is already
 * encoded by the combination of selection mode and filters:
 *
 * - `include + ids` -> exactly those rows;
 * - `exclude + filters` -> rows matching the filters, minus the exception ids;
 * - `exclude` without filters -> all records, minus the exception ids.
 *
 * Features own their filter translation and domain action payload. For example, Transactions adds
 * `{ changes: { status: 'Failed' } }`, while another table could add a completely different action.
 */
export type GridSelectionActionTarget<TId extends GridSelectionId, TFilter> =
  | {
      selection: GridExplicitSelectionTarget<TId>;
      filters?: never;
    }
  | {
      selection: GridExcludeSelectionTarget<TId>;
      filters?: TFilter[];
    };

/** `exclude` always represents a dataset; `include` is actionable only when it contains ids. */
export function hasGridSelection<TId extends GridSelectionId>(
  selection: ServerSelectionIntent<TId>,
) {
  return selection.mode === 'exclude' || selection.ids.length > 0;
}

/**
 * Converts logical include/exclude state into the generic wire target a feature can attach its own
 * action payload to.
 *
 * `excludeScope` remains an internal input because Infinite/SSRM UI selection strategies know whether
 * Select All means filtered rows or all records. The backend does not need that duplicated label:
 * filters on an exclude request already express filtered selection.
 */
export function buildGridSelectionActionTarget<TId extends GridSelectionId, TFilter>(
  selection: ServerSelectionIntent<TId>,
  excludeScope: GridSelectionExcludeScope,
  filteredFilters: readonly TFilter[],
): GridSelectionActionTarget<TId, TFilter> {
  if (selection.mode === 'include') {
    return {
      selection: {
        mode: 'include',
        ids: [...selection.ids],
      },
    };
  }

  if (excludeScope === 'filtered') {
    return {
      selection: {
        mode: 'exclude',
        ids: [...selection.ids],
      },
      filters: [...filteredFilters],
    };
  }

  return {
    selection: {
      mode: 'exclude',
      ids: [...selection.ids],
    },
  };
}
