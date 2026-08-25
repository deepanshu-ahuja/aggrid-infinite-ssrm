import { useCallback, useRef, useState } from 'react';
import type {
  FirstDataRenderedEvent,
  GridApi,
  IRowNode,
  ViewportChangedEvent,
} from 'ag-grid-community';
import { getCurrentPageNodes } from '@/shared/grid/pagination/getCurrentPageNodes';
import type { Transaction } from '../api/transactions.contracts';
import type {
  TransactionChanges,
  TransactionEditTarget,
  TransactionLastEdit,
} from './transactionEditing';

interface TransactionEditEngine {
  lastEdit?: TransactionLastEdit;
  applyChangesToNodes: (
    nodes: readonly IRowNode<Transaction>[],
    changes: TransactionChanges,
  ) => void;
  restoreTrackedEdits: (api: GridApi<Transaction>) => void;
}

/**
 * Reusable behavior behind the two current-page editing flows.
 *
 * WHY A SEPARATE HOOK
 * -------------------
 * The real client UI for Flow 1 and Flow 2 may be completely different: an inline action, toolbar,
 * modal, drawer, etc. Those UIs should consume these operations rather than reimplementing AG Grid
 * page/selection resolution or change application.
 *
 * FLOW 1
 * ------
 * Takes the user's latest directly edited field/value and propagates that SAME field/value to the
 * chosen current-page target.
 *
 * FLOW 2
 * ------
 * Accepts an explicit multi-field `changes` object from whatever UI collects those values and
 * applies only those opted-in fields to the chosen current-page target.
 *
 * SHARED TARGET RULE
 * ------------------
 * `page`     -> every resolved row on the current page.
 * `selected` -> only selected rows among those same current-page rows.
 *
 * Selection never expands Flow 1/2 beyond the current page, even when the underlying logical
 * selection represents All Filtered or All Records.
 *
 * NATIVE-FIRST BOUNDARY
 * ---------------------
 * This hook reads native AG Grid pagination and RowNode selection at action time. It does not keep
 * a second React copy of the current page or selected rows. The only React state here is our own
 * user-facing validation error, which AG Grid does not own.
 */
export function useTransactionEditFlows(editing: TransactionEditEngine) {
  const gridApi = useRef<GridApi<Transaction> | null>(null);
  const [error, setError] = useState<string>();

  /**
   * Keep the GridApi reference and restore accumulated local edits after initial rows appear.
   * The edit engine is keyed by stable row ID, so reloaded backend data can be reconciled here.
   */
  const onFirstDataRendered = useCallback(
    (event: FirstDataRenderedEvent<Transaction>) => {
      gridApi.current = event.api;
      editing.restoreTrackedEdits(event.api);
    },
    [editing],
  );

  /**
   * Cache eviction/page navigation can recreate RowNodes. Reapply tracked local values whenever the
   * rendered viewport changes so leaving and returning to a page does not visually lose edits.
   */
  const onViewportChanged = useCallback(
    (event: ViewportChangedEvent<Transaction>) => {
      gridApi.current = event.api;
      editing.restoreTrackedEdits(event.api);
    },
    [editing],
  );

  const resolveTarget = useCallback((target: TransactionEditTarget) => {
    const api = gridApi.current;

    if (!api) {
      setError('The grid is not ready yet.');
      return undefined;
    }

    /**
     * Shared pagination helper deliberately distinguishes the visible page from loaded/cache blocks.
     * Infinite and SSRM can have more rows loaded than the user currently sees.
     */
    const pageNodes = getCurrentPageNodes(api);

    if (!pageNodes) {
      setError('The current page is still loading. Try again when its rows are visible.');
      return undefined;
    }

    /**
     * IMPORTANT: selection is read from AG Grid's RowNodes here; this hook does not duplicate row
     * checkbox state. The concrete row model remains responsible for making those RowNodes reflect
     * its native/custom logical selection rules.
     */
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
  }, []);

  /**
   * FLOW 1 operation. The source row itself does NOT need to be selected. Editing and selection are
   * separate concerns: the source edit changes that row; this explicit Apply action decides whether
   * the same value is propagated to the whole page or selected rows on that page.
   */
  const applyLastEdit = useCallback(
    (target: TransactionEditTarget) => {
      if (!editing.lastEdit) return false;

      const nodes = resolveTarget(target);
      if (!nodes) return false;

      editing.applyChangesToNodes(nodes, {
        [editing.lastEdit.field]: editing.lastEdit.value,
      });

      return true;
    },
    [editing, resolveTarget],
  );

  /**
   * FLOW 2 operation. `changes` may contain one or many fields. The hook intentionally knows
   * nothing about whether those values came from a modal, drawer, toolbar, or some future client UI.
   */
  const applyBulkChanges = useCallback(
    (target: TransactionEditTarget, changes: TransactionChanges) => {
      const nodes = resolveTarget(target);
      if (!nodes) return false;

      editing.applyChangesToNodes(nodes, changes);
      return true;
    },
    [editing, resolveTarget],
  );

  return {
    error,
    applyLastEdit,
    applyBulkChanges,
    gridOptions: {
      onFirstDataRendered,
      onViewportChanged,
    },
  };
}
