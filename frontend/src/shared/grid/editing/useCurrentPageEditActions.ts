import { useCallback } from 'react';
import type { RefObject } from 'react';
import type { GridApi, IRowNode } from 'ag-grid-community';
import {
  useCurrentPageEditTarget,
  type CurrentPageEditTarget,
} from './useCurrentPageEditTarget';
import type {
  TrackedGridChanges,
  TrackedGridLastEdit,
} from './trackedGridEditing';

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
 * RESPONSIBILITY
 * --------------
 * This hook owns the behavior that would otherwise be duplicated by every editable table:
 * - resolve the current pagination page through the authoritative root GridApi;
 * - optionally narrow that page to selected RowNodes;
 * - surface loading/selection target errors;
 * - repeat the user's latest direct field/value edit;
 * - apply an explicit set of field/value changes.
 *
 * NON-RESPONSIBILITIES
 * --------------------
 * It does not know feature fields, validation, dialogs/forms, API payloads or persistence. Those
 * remain feature/edit-engine concerns. This is why the hook is capability-sized instead of becoming
 * a generic `useGrid(...)` abstraction.
 */
export function useCurrentPageEditActions<
  TData,
  TField extends string,
  TValue,
>(
  editing: CurrentPageEditEngine<TData, TField, TValue>,
  gridApi: RefObject<GridApi<TData> | null>,
) {
  /**
   * Target resolution owns its own user-facing error state because resolving a page can fail even
   * when the edit engine itself is healthy (grid not ready, page still loading, nothing selected).
   */
  const { error, resolveTarget } = useCurrentPageEditTarget(gridApi);

  /**
   * Destructure only the capabilities used below. Besides being easier to read, this keeps callback
   * dependencies explicit and avoids depending on a newly-created aggregate hook result object.
   */
  const { lastEdit, applyChangesToNodes } = editing;

  /**
   * Flow 1: apply exactly the user's most recent direct field/value edit to the requested page target.
   * Returns a boolean so presentation code can react only when an actual application succeeded.
   */
  const applyLastEdit = useCallback(
    (target: CurrentPageEditTarget) => {
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

  /**
   * Flow 2: apply a caller-supplied partial field set to the same current-page target semantics.
   * The caller decides which fields are included; this hook only resolves WHERE the changes apply.
   */
  const applyBulkChanges = useCallback(
    (
      target: CurrentPageEditTarget,
      changes: TrackedGridChanges<TField, TValue>,
    ) => {
      const nodes = resolveTarget(target);
      if (!nodes) return false;

      applyChangesToNodes(nodes, changes);
      return true;
    },
    [applyChangesToNodes, resolveTarget],
  );

  return {
    /** Current target-resolution failure for UI presentation; clears after a successful resolution. */
    error,
    applyLastEdit,
    applyBulkChanges,
  };
}
