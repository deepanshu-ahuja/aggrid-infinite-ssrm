import { useCallback, useEffect, useState } from 'react';
import { Checkbox, Tooltip } from '@mui/material';
import type { GridApi } from 'ag-grid-community';
import { getCurrentPageNodes } from '@/shared/grid/pagination/getCurrentPageNodes';
import type { SelectionHeaderState } from '../serverSelection';

interface InfiniteCurrentPageSelectionHeaderProps<TData> {
  /** AG Grid injects its native API into custom header components. */
  api: GridApi<TData>;
}

const EMPTY_HEADER_STATE: SelectionHeaderState = {
  checked: false,
  indeterminate: false,
  disabled: true,
};

/**
 * Infinite Row Model header shortcut for selecting/clearing the CURRENT pagination page.
 *
 * WHY THIS COMPONENT EXISTS
 * -------------------------
 * Infinite Row Model supports native per-row selection but does not provide a native Select-All
 * header across its server-backed rows. For the `page` UX we therefore need a custom header action.
 *
 * WHAT IS NATIVE
 * --------------
 * The selected rows themselves remain AG Grid-owned. This component does NOT keep selected IDs or
 * current-page IDs in React. At render/refresh time it reads native RowNodes; on click it calls
 * native `api.setNodesSelected()`.
 *
 * WHAT THE SMALL REACT STATE IS
 * -----------------------------
 * `headerState` is presentation state only (checked/indeterminate/disabled) for this custom MUI
 * checkbox. It is always re-derived from AG Grid events and is never a second selection source of
 * truth.
 */
export function InfiniteCurrentPageSelectionHeader<TData>({
  api,
}: InfiniteCurrentPageSelectionHeaderProps<TData>) {
  const [headerState, setHeaderState] =
    useState<SelectionHeaderState>(EMPTY_HEADER_STATE);

  const refreshFromGrid = useCallback(() => {
    const pageNodes = getCurrentPageNodes(api);

    if (!pageNodes || pageNodes.length === 0) {
      setHeaderState(EMPTY_HEADER_STATE);
      return;
    }

    const selectedCount = pageNodes.reduce(
      (count, node) => count + (node.isSelected() === true ? 1 : 0),
      0,
    );

    setHeaderState({
      checked: selectedCount === pageNodes.length,
      indeterminate: selectedCount > 0 && selectedCount < pageNodes.length,
      disabled: false,
    });
  }, [api]);

  useEffect(() => {
    /**
     * These are AG Grid lifecycle events, not application mirrors. Any event that can change which
     * rows are on the page or whether they are selected causes the visual header state to be read
     * again from the native grid.
     */
    api.addEventListener('selectionChanged', refreshFromGrid);
    api.addEventListener('paginationChanged', refreshFromGrid);
    api.addEventListener('modelUpdated', refreshFromGrid);

    refreshFromGrid();

    return () => {
      api.removeEventListener('selectionChanged', refreshFromGrid);
      api.removeEventListener('paginationChanged', refreshFromGrid);
      api.removeEventListener('modelUpdated', refreshFromGrid);
    };
  }, [api, refreshFromGrid]);

  const label = 'Select or clear current page';

  return (
    <Tooltip title={label}>
      <span>
        <Checkbox
          size="small"
          checked={headerState.checked}
          indeterminate={headerState.indeterminate}
          disabled={headerState.disabled}
          inputProps={{ 'aria-label': label }}
          onClick={(event) => {
            event.stopPropagation();

            const pageNodes = getCurrentPageNodes(api);
            if (!pageNodes) return;

            /**
             * Native AG Grid selection preserves selections from other pages. Selecting/clearing this
             * page therefore changes only these concrete RowNodes; it does not rebuild global IDs.
             */
            api.setNodesSelected({
              nodes: pageNodes,
              newValue: !headerState.checked,
            });
          }}
        />
      </span>
    </Tooltip>
  );
}
