import { useCallback, useState } from 'react';
import type { RefObject } from 'react';
import type { GridApi, IRowNode } from 'ag-grid-community';
import { getCurrentPageNodes } from './getCurrentPageNodes';

/** User-visible row targets that can be resolved from the current pagination page. */
export type CurrentPageRowTarget = 'page' | 'selected';

/**
 * Resolves concrete RowNodes for current-page actions without knowing what the action will do.
 *
 * WHY THIS IS NOT AN EDITING HOOK
 * -------------------------------
 * The same target semantics can power editing, delete, export, approve, tagging or other bulk actions.
 * This hook owns only pagination/loading/selected-row resolution and its user-facing resolution error.
 * Callers remain responsible for the operation applied to the returned RowNodes.
 */
export function useCurrentPageRowTarget<TData>(
  gridApi: RefObject<GridApi<TData> | null>,
) {
  /** Resolution failure is renderable state because actions may need to explain why nothing ran. */
  const [error, setError] = useState<string>();

  const resolveTarget = useCallback(
    (target: CurrentPageRowTarget): readonly IRowNode<TData>[] | undefined => {
      const api = gridApi.current;

      if (!api) {
        setError('The grid is not ready yet.');
        return undefined;
      }

      const pageNodes = getCurrentPageNodes(api);

      if (!pageNodes) {
        setError(
          'The current page is still loading. Try again when its rows are visible.',
        );
        return undefined;
      }

      const nodes =
        target === 'page'
          ? pageNodes
          : pageNodes.filter((node) => node.isSelected() === true);

      if (target === 'selected' && nodes.length === 0) {
        setError('No rows are selected on the current page.');
        return undefined;
      }

      setError(undefined);
      return nodes;
    },
    [gridApi],
  );

  return {
    error,
    resolveTarget,
  };
}
