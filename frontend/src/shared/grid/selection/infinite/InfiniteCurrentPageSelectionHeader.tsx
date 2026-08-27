import { useCallback, useEffect, useState } from 'react';
import { Checkbox, Tooltip } from '@mui/material';
import type { GridApi, IRowNode } from 'ag-grid-community';
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
 * Keep only rows that AG Grid itself says are selectable.
 *
 * WHY WE READ `RowNode.selectable`
 * -------------------------------
 * The concrete grid already supplied `rowSelection.isRowSelectable`. AG Grid evaluates that callback
 * for each loaded row and stores the result on the RowNode. Reusing `node.selectable` means this shared
 * header does NOT need to know Transaction/Payable/business conditions and cannot drift from AG Grid's
 * own checkbox behaviour.
 */
function getSelectablePageNodes<TData>(nodes: readonly IRowNode<TData>[]) {
  return nodes.filter((node) => node.selectable);
}

/** Derive the page-header checkbox state from AG Grid's RowNodes. */
function readCurrentPageHeaderState<TData>(api: GridApi<TData>): SelectionHeaderState {
  const pageNodes = getCurrentPageNodes(api);
  if (!pageNodes) return EMPTY_HEADER_STATE;

  const selectableNodes = getSelectablePageNodes(pageNodes);
  if (selectableNodes.length === 0) return EMPTY_HEADER_STATE;

  const selectedCount = selectableNodes.reduce(
    (count, node) => count + (node.isSelected() === true ? 1 : 0),
    0,
  );

  return {
    checked: selectedCount === selectableNodes.length,
    indeterminate: selectedCount > 0 && selectedCount < selectableNodes.length,
    disabled: false,
  };
}

/**
 * Infinite Row Model header shortcut for selecting/clearing the CURRENT pagination page.
 *
 * Infinite Row Model does not give us a native "select current pagination page" header mode, so this
 * custom header performs only that missing piece. The actual selected state still lives in AG Grid.
 */
export function InfiniteCurrentPageSelectionHeader<TData>({
  api,
}: InfiniteCurrentPageSelectionHeaderProps<TData>) {
  const [headerState, setHeaderState] = useState<SelectionHeaderState>(() =>
    readCurrentPageHeaderState(api),
  );

  const refreshFromGrid = useCallback(() => {
    if (api.isDestroyed()) return;
    setHeaderState(readCurrentPageHeaderState(api));
  }, [api]);

  useEffect(() => {
    api.addEventListener('selectionChanged', refreshFromGrid);
    api.addEventListener('paginationChanged', refreshFromGrid);
    api.addEventListener('modelUpdated', refreshFromGrid);

    return () => {
      // AG Grid can destroy the GridApi before React unmounts this custom header. Calling API methods
      // after that point produces AG Grid warning #26, so teardown must follow the documented guard.
      if (api.isDestroyed()) return;

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
            if (api.isDestroyed()) return;

            const pageNodes = getCurrentPageNodes(api);
            if (!pageNodes) return;

            const selectableNodes = getSelectablePageNodes(pageNodes);
            if (selectableNodes.length === 0) return;

            api.setNodesSelected({
              nodes: selectableNodes,
              newValue: !headerState.checked,
            });
          }}
        />
      </span>
    </Tooltip>
  );
}
