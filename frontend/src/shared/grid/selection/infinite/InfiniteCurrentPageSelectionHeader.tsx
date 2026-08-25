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

/** Derive the visual checkbox state from AG Grid without creating another selection source of truth. */
function readCurrentPageHeaderState<TData>(api: GridApi<TData>): SelectionHeaderState {
  const pageNodes = getCurrentPageNodes(api);

  if (!pageNodes || pageNodes.length === 0) return EMPTY_HEADER_STATE;

  const selectedCount = pageNodes.reduce(
    (count, node) => count + (node.isSelected() === true ? 1 : 0),
    0,
  );

  return {
    checked: selectedCount === pageNodes.length,
    indeterminate: selectedCount > 0 && selectedCount < pageNodes.length,
    disabled: false,
  };
}

/**
 * Infinite Row Model header shortcut for selecting/clearing the CURRENT pagination page.
 * Selected rows remain AG Grid-owned; React stores only derived checkbox presentation state.
 */
export function InfiniteCurrentPageSelectionHeader<TData>({
  api,
}: InfiniteCurrentPageSelectionHeaderProps<TData>) {
  /** Read the initial external-grid snapshot during state initialization, not by setting state in an effect. */
  const [headerState, setHeaderState] = useState<SelectionHeaderState>(() =>
    readCurrentPageHeaderState(api),
  );

  const refreshFromGrid = useCallback(() => {
    setHeaderState(readCurrentPageHeaderState(api));
  }, [api]);

  useEffect(() => {
    /** The effect only subscribes/unsubscribes to AG Grid; events drive later React state updates. */
    api.addEventListener('selectionChanged', refreshFromGrid);
    api.addEventListener('paginationChanged', refreshFromGrid);
    api.addEventListener('modelUpdated', refreshFromGrid);

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
