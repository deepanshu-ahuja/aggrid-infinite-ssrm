// GRIDCAP-EDIT-PAGE-APPLY | GRIDCAP-PAGINATION | GRIDCAP-ROW-ELIGIBILITY
import { useCallback } from 'react';
import type { RefObject } from 'react';
import type { GridApi, IRowNode } from 'ag-grid-community';
import {
  useCurrentPageRowTarget,
  type CurrentPageRowTarget,
} from '@/shared/grid/pagination/useCurrentPageRowTarget';
import type { TrackedGridChanges, TrackedGridLastEdit } from './trackedGridEditing';

/**
 * Minimal edit-engine surface consumed by current-page actions.
 *
 * The action hook deliberately does not depend on the full tracked-editing hook return value. That
 * keeps the dependency boundary narrow and makes the same action behavior usable with any compatible
 * edit engine that can expose the latest direct edit and apply changes to concrete RowNodes.
 */
interface CurrentPageEditEngine<TData, TField extends string, TValue> {
  /** Latest DIRECT user edit; programmatic propagation must not replace this value. */
  lastEdit?: TrackedGridLastEdit<TField, TValue>;

  /** Shared mutation primitive that records changes and updates loaded RowNodes consistently. */
  applyChangesToNodes: (
    nodes: readonly IRowNode<TData>[],
    changes: TrackedGridChanges<TField, TValue>,
  ) => void;
}

/**
 * Reusable current-page editing actions shared by any grid that supports the same target semantics.
 *
 * Target resolution itself is action-neutral and comes from `useCurrentPageRowTarget`, which means a
 * future Delete/Export/Approve action can reuse the same page/loading/selected-row rules directly.
 * This hook adds only editing behavior: repeat the latest direct edit or apply an explicit change set.
 */
export function useCurrentPageEditActions<TData, TField extends string, TValue>(
  editing: CurrentPageEditEngine<TData, TField, TValue>,
  gridApi: RefObject<GridApi<TData> | null>,
) {
  /** Target errors are independent from edit-state health and belong to page/row resolution. */
  const { error, resolveTarget } = useCurrentPageRowTarget(gridApi);

  /** Destructure only the narrow edit capabilities used below so dependencies stay explicit. */
  const { lastEdit, applyChangesToNodes } = editing;

  /** Apply exactly the user's latest direct field/value edit to the requested current-page target. */
  const applyLastEdit = useCallback(
    (target: CurrentPageRowTarget) => {
      if (!lastEdit) return false;

      const nodes = resolveTarget(target);
      if (!nodes) return false;

      applyChangesToNodes(nodes, {
        [lastEdit.field]: lastEdit.value,
      } as TrackedGridChanges<TField, TValue>);

      return true;
    },
    [applyChangesToNodes, lastEdit, resolveTarget],
  );

  /** Apply a caller-supplied partial field set to the same current-page row-target semantics. */
  const applyBulkChanges = useCallback(
    (target: CurrentPageRowTarget, changes: TrackedGridChanges<TField, TValue>) => {
      const nodes = resolveTarget(target);
      if (!nodes) return false;

      applyChangesToNodes(nodes, changes);
      return true;
    },
    [applyChangesToNodes, resolveTarget],
  );

  return {
    error,
    applyLastEdit,
    applyBulkChanges,
  };
}
