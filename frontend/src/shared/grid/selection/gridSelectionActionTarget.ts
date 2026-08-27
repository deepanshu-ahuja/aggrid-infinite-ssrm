import type { GridSelectionId, ServerSelectionIntent } from './serverSelection';

/**
 * Dataset represented when an `exclude` logical selection is converted into a server action target.
 *
 * `page` is intentionally absent: selecting a page produces concrete ids and therefore becomes an
 * ordinary explicit/include target before a feature action reaches the backend.
 */
export type GridSelectionExcludeScope = 'filtered' | 'all';

export interface GridExplicitSelectionTarget<TId extends GridSelectionId = string> {
  scope: 'explicit';
  mode: 'include';
  ids: TId[];
}

export interface GridFilteredSelectionTarget<TId extends GridSelectionId = string> {
  scope: 'filtered';
  mode: 'exclude';
  ids: TId[];
}

export interface GridAllSelectionTarget<TId extends GridSelectionId = string> {
  scope: 'all';
  mode: 'exclude';
  ids: TId[];
}

/**
 * Generic server-action selection context shared by every server-backed table.
 *
 * Features still own their filter translation. Pass already-translated backend filters here; this
 * helper only combines those filters with the generic selection meaning.
 */
export type GridSelectionActionTarget<TId extends GridSelectionId, TFilter> =
  | {
      selection: GridExplicitSelectionTarget<TId>;
    }
  | {
      selection: GridFilteredSelectionTarget<TId>;
      filters: TFilter[];
    }
  | {
      selection: GridAllSelectionTarget<TId>;
    };

/** `exclude` always represents a dataset; `include` is actionable only when it contains ids. */
export function hasGridSelection<TId extends GridSelectionId>(
  selection: ServerSelectionIntent<TId>,
) {
  return selection.mode === 'exclude' || selection.ids.length > 0;
}

/**
 * Converts logical include/exclude selection into the generic target a feature can attach its own
 * action payload to.
 *
 * - include -> exact ids; visible filters are irrelevant;
 * - filtered exclude -> current translated filters + exception ids;
 * - all exclude -> complete dataset + exception ids; visible filters are irrelevant.
 */
export function buildGridSelectionActionTarget<TId extends GridSelectionId, TFilter>(
  selection: ServerSelectionIntent<TId>,
  excludeScope: GridSelectionExcludeScope,
  filteredFilters: readonly TFilter[],
): GridSelectionActionTarget<TId, TFilter> {
  if (selection.mode === 'include') {
    return {
      selection: {
        scope: 'explicit',
        mode: 'include',
        ids: [...selection.ids],
      },
    };
  }

  if (excludeScope === 'filtered') {
    return {
      selection: {
        scope: 'filtered',
        mode: 'exclude',
        ids: [...selection.ids],
      },
      filters: [...filteredFilters],
    };
  }

  return {
    selection: {
      scope: 'all',
      mode: 'exclude',
      ids: [...selection.ids],
    },
  };
}
