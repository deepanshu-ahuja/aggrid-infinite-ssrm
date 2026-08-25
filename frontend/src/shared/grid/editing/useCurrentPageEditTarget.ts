import { useCallback, useState } from 'react';
import type { RefObject } from 'react';
import type { GridApi, IRowNode } from 'ag-grid-community';
import { getCurrentPageNodes } from '@/shared/grid/pagination/getCurrentPageNodes';

export type CurrentPageEditTarget = 'page' | 'selected';

/**
 * Resolves a user-visible current-page editing target without knowing the feature's row type.
 *
 * This is shared because "current page" is AG Grid pagination behavior, not Transactions business
 * logic. Features remain responsible for deciding what changes to apply once the RowNodes resolve.
 */
export function useCurrentPageEditTarget<TData>(
  gridApi: RefObject<GridApi<TData> | null>,
) {
  /** User-facing resolution failure; changes when the requested page/selection target is invalid. */
  const [error, setError] = useState<string>();

  const resolveTarget = useCallback(
    (target: CurrentPageEditTarget): readonly IRowNode<TData>[] | undefined => {
      const api = gridApi.current;

      if (!api) {
        setError('The grid is not ready yet.');
        return undefined;
      }

      const pageNodes = getCurrentPageNodes(api);

      if (!pageNodes) {
        setError('The current page is still loading. Try again when its rows are visible.');
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
