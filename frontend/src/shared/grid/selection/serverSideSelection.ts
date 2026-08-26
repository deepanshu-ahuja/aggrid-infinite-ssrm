import type { ServerSelectionIntent } from './serverSelection';

/**
 * Flat AG Grid SSRM selection state used by this application's current flat-table configuration.
 *
 * AG Grid uses this rule-based representation because SSRM may have selected rows that have never
 * been loaded into browser memory:
 *
 * - `selectAll: false` -> `toggledNodes` are the selected row IDs;
 * - `selectAll: true`  -> every row is selected and `toggledNodes` are exceptions.
 *
 * This intentionally mirrors only the flat `groupSelects: 'self'` shape. If SSRM grouping/tree
 * selection is enabled later, AG Grid can return a hierarchical state and that must be handled as a
 * separate contract rather than flattened incorrectly.
 */
export interface FlatServerSideSelectionState {
  selectAll: boolean;
  toggledNodes: string[];
}

/** Creates the native SSRM state meaning "nothing selected". */
export function createEmptyServerSideSelectionState(): FlatServerSideSelectionState {
  return {
    selectAll: false,
    toggledNodes: [],
  };
}

/**
 * Narrows AG Grid's SSRM selection state to the flat shape expected by Transactions today.
 *
 * `GridApi#getServerSideSelectionState()` can return either a flat state or a hierarchical group
 * state depending on `rowSelection.groupSelects`. Transactions explicitly configures
 * `groupSelects: 'self'`, so receiving another shape means the grid configuration and this adapter
 * no longer agree.
 *
 * Failing loudly is safer than building a bulk-action payload with the wrong meaning.
 */
export function readFlatServerSideSelectionState(state: unknown): FlatServerSideSelectionState {
  if (!state || typeof state !== 'object') {
    throw new Error('AG Grid did not provide a valid SSRM selection state.');
  }

  const candidate = state as {
    selectAll?: unknown;
    toggledNodes?: unknown;
  };

  if (
    typeof candidate.selectAll !== 'boolean' ||
    !Array.isArray(candidate.toggledNodes) ||
    !candidate.toggledNodes.every((id) => typeof id === 'string')
  ) {
    throw new Error(
      'Expected flat SSRM selection state. Group/hierarchical SSRM selection is not supported by this Transactions adapter yet.',
    );
  }

  return {
    selectAll: candidate.selectAll,
    toggledNodes: [...candidate.toggledNodes],
  };
}

/**
 * Converts AG Grid's native flat SSRM rule set into our shared JSON-safe logical selection.
 *
 * Examples:
 *
 * ```text
 * AG Grid:
 *   selectAll = false
 *   toggledNodes = [A, B]
 *
 * Logical selection:
 *   include [A, B]
 * ```
 *
 * ```text
 * AG Grid:
 *   selectAll = true
 *   toggledNodes = [A]
 *
 * Logical selection:
 *   exclude [A]
 * ```
 *
 * The adapter deliberately does not attach `all` / `filtered` query context. Native SSRM
 * `selectAll: true` means all records; filtered dataset context is owned separately by the feature
 * because AG Grid SSRM does not natively support Select All Filtered.
 */
export function serverSideSelectionToIntent(
  state: FlatServerSideSelectionState,
): ServerSelectionIntent<string> {
  return {
    mode: state.selectAll ? 'exclude' : 'include',
    ids: [...state.toggledNodes],
  };
}
