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

interface CurrentPageEditEngine<TData, TField extends string, TValue> {
  lastEdit?: TrackedGridLastEdit<TField, TValue>;
  applyChangesToNodes: (
    nodes: readonly IRowNode<TData>[],
    changes: TrackedGridChanges<TField, TValue>,
  ) => void;
}

/**
 * Reusable current-page editing actions shared by any grid that supports the same target semantics.
 *
 * This hook is intentionally capability-sized rather than feature-sized: it resolves page/selected
 * RowNodes, reports target-resolution errors, repeats the latest direct edit, and applies an explicit
 * change set. It does not know Transactions fields, UI controls, validation, or backend contracts.
 */
export function useCurrentPageEditActions<
  TData,
  TField extends string,
  TValue,
>(
  editing: CurrentPageEditEngine<TData, TField, TValue>,
  gridApi: RefObject<GridApi<TData> | null>,
) {
  const { error, resolveTarget } = useCurrentPageEditTarget(gridApi);
  const { lastEdit, applyChangesToNodes } = editing;

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
    error,
    applyLastEdit,
    applyBulkChanges,
  };
}
