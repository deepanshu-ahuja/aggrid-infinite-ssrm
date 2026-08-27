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
  // Disabled rows are not user exclusions. They simply never enter the list that we give back to
  // AG Grid's selection API.
  return nodes.filter((node) => node.selectable);
}

/**
 * Derive the page-header checkbox state from AG Grid's RowNodes.
 * React stores only this small visual snapshot; it does not own the selected row IDs.
 */
function readCurrentPageHeaderState<TData>(api: GridApi<TData>): SelectionHeaderState {
  const pageNodes = getCurrentPageNodes(api);

  // `undefined` means the server-backed page is not completely materialised yet. We disable the
  // header rather than allow a partial Current Page action.
  if (!pageNodes) return EMPTY_HEADER_STATE;

  const selectableNodes = getSelectablePageNodes(pageNodes);

  // A page that contains only restricted rows has nothing the user can select, so its header control
  // should also be disabled.
  if (selectableNodes.length === 0) return EMPTY_HEADER_STATE;

  const selectedCount = selectableNodes.reduce(
    (count, node) => count + (node.isSelected() === true ? 1 : 0),
    0,
  );

  return {
    // Checked means every SELECTABLE row on this page is selected. Restricted rows are deliberately
    // absent from this calculation because they are outside the selectable universe.
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
  // Initialise from AG Grid once so the header is correct on its first render. Later changes come from
  // AG Grid events below; we do not continuously mirror selection into React state.
  const [headerState, setHeaderState] = useState<SelectionHeaderState>(() =>
    readCurrentPageHeaderState(api),
  );

  const refreshFromGrid = useCallback(() => {
    setHeaderState(readCurrentPageHeaderState(api));
  }, [api]);

  useEffect(() => {
    // Different AG Grid events can change what "current page is fully selected" means:
    // - selectionChanged: user/API changed selected RowNodes;
    // - paginationChanged: another page became current;
    // - modelUpdated: server-backed rows were loaded/replaced/refreshed.
    // Listening to AG Grid avoids inventing a second selection lifecycle in React.
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
      {/* MUI Tooltip does not attach correctly to a disabled button/control, so the span stays as the
          tooltip anchor even when the checkbox itself is disabled. */}
      <span>
        <Checkbox
          size="small"
          checked={headerState.checked}
          indeterminate={headerState.indeterminate}
          disabled={headerState.disabled}
          inputProps={{ 'aria-label': label }}
          onClick={(event) => {
            // Prevent the custom checkbox click from being interpreted as an AG Grid header click
            // (for example a sort/focus interaction on the selection column header).
            event.stopPropagation();

            const pageNodes = getCurrentPageNodes(api);
            if (!pageNodes) return;

            const selectableNodes = getSelectablePageNodes(pageNodes);
            if (selectableNodes.length === 0) return;

            // This is the important safety boundary: only native-selectable RowNodes are ever passed
            // to `setNodesSelected`. We do not pass disabled rows and then "fix" them afterward, and
            // we do not add disabled IDs to our include/exclude selection contract.
            api.setNodesSelected({
              nodes: selectableNodes,
              // Clicking a fully checked header clears the page; otherwise it selects all selectable
              // rows on the page, including the normal indeterminate -> checked behaviour.
              newValue: !headerState.checked,
            });
          }}
        />
      </span>
    </Tooltip>
  );
}
