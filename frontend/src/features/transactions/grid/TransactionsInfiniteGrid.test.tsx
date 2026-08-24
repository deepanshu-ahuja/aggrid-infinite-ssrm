import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FilterModel } from 'ag-grid-community';
import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';
import { serverBackedGridDefaults } from '@/shared/grid/config/serverBackedGridDefaults';
import { TransactionsInfiniteGrid } from './TransactionsInfiniteGrid';

/**
 * These tests validate the composition layer only.
 *
 * The child page/dataset grids already have their own selection/lifecycle tests. Here we replace them
 * with tiny captures so we can prove:
 *
 * selection + AG Grid filter context
 *              ↓
 * "Preview bulk payload"
 *              ↓
 * Transactions backend-ready selection JSON
 */
interface CapturedChildProps {
  onSelectionChange?: (selection: ServerSelectionIntent<string>) => void;
  onFilterModelChange?: (filterModel: FilterModel) => void;
}

const childCapture = vi.hoisted(() => ({
  page: undefined as CapturedChildProps | undefined,
  dataset: undefined as CapturedChildProps | undefined,
}));

vi.mock('./TransactionsInfinitePageGrid', () => ({
  TransactionsInfinitePageGrid: (props: CapturedChildProps) => {
    childCapture.page = props;
    return <div data-testid="page-grid" />;
  },
}));

vi.mock('./TransactionsInfiniteDatasetGrid', () => ({
  TransactionsInfiniteDatasetGrid: (props: CapturedChildProps) => {
    childCapture.dataset = props;
    return <div data-testid="dataset-grid" />;
  },
}));

function readPreview() {
  return JSON.parse(
    screen.getByTestId('selection-payload-preview').textContent ?? '{}',
  ) as unknown;
}

beforeEach(() => {
  childCapture.page = undefined;
  childCapture.dataset = undefined;
});

describe('TransactionsInfiniteGrid bulk payload preview wiring', () => {
  it('previews current-page/manual selection as exact include IDs', () => {
    render(
      <TransactionsInfiniteGrid
        selectionScope="page"
        gridOptions={serverBackedGridDefaults}
      />,
    );

    act(() => {
      childCapture.page?.onSelectionChange?.({
        mode: 'include',
        ids: ['txn-a', 'txn-b'],
      });
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview bulk payload' }),
    );

    expect(readPreview()).toEqual({
      mode: 'include',
      ids: ['txn-a', 'txn-b'],
    });
  });

  it('previews Select All Filtered using the applied AG Grid filter model', () => {
    render(
      <TransactionsInfiniteGrid
        selectionScope="filtered"
        gridOptions={serverBackedGridDefaults}
      />,
    );

    act(() => {
      childCapture.dataset?.onFilterModelChange?.({
        status: {
          filterType: 'text',
          type: 'equals',
          filter: 'Completed',
        },
        amount: {
          filterType: 'number',
          type: 'greaterThan',
          filter: 5_000,
        },
      });

      childCapture.dataset?.onSelectionChange?.({
        mode: 'exclude',
        ids: ['txn-excluded'],
      });
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview bulk payload' }),
    );

    expect(readPreview()).toEqual({
      mode: 'exclude',
      ids: ['txn-excluded'],
      filters: [
        {
          field: 'status',
          operator: 'equals',
          value: 'Completed',
        },
        {
          field: 'amount',
          operator: 'greaterThan',
          value: 5_000,
        },
      ],
    });
  });

  it('previews Select All Records with an explicit empty filter list', () => {
    render(
      <TransactionsInfiniteGrid
        selectionScope="all"
        gridOptions={serverBackedGridDefaults}
      />,
    );

    act(() => {
      childCapture.dataset?.onSelectionChange?.({
        mode: 'exclude',
        ids: ['txn-a'],
      });
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview bulk payload' }),
    );

    expect(readPreview()).toEqual({
      mode: 'exclude',
      ids: ['txn-a'],
      filters: [],
    });
  });

  it('clears a stale preview after selection changes', () => {
    render(
      <TransactionsInfiniteGrid
        selectionScope="page"
        gridOptions={serverBackedGridDefaults}
      />,
    );

    act(() => {
      childCapture.page?.onSelectionChange?.({
        mode: 'include',
        ids: ['txn-a'],
      });
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview bulk payload' }),
    );

    expect(screen.getByTestId('selection-payload-preview')).toBeInTheDocument();

    /**
     * A preview is a snapshot from the last explicit button click, not live selection state.
     * Remove it as soon as selection changes so the UI cannot show stale JSON.
     */
    act(() => {
      childCapture.page?.onSelectionChange?.({
        mode: 'include',
        ids: ['txn-a', 'txn-b'],
      });
    });

    expect(
      screen.queryByTestId('selection-payload-preview'),
    ).not.toBeInTheDocument();
  });
})