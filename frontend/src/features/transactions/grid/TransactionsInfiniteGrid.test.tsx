import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FilterModel } from 'ag-grid-community';
import { serverBackedGridDefaults } from '@/shared/grid/config/serverBackedGridDefaults';
import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';
import { createEmptyTransactionEditingState } from './transactionEditing';
import { TransactionsInfiniteGrid } from './TransactionsInfiniteGrid';

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

function readPreview(testId: string) {
  return JSON.parse(screen.getByTestId(testId).textContent ?? '{}') as unknown;
}

beforeEach(() => {
  childCapture.page = undefined;
  childCapture.dataset = undefined;
});

describe('TransactionsInfiniteGrid action-preview composition', () => {
  it('builds exact include selection from native page/manual selection emitted by the child', () => {
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
      screen.getByRole('button', { name: 'Preview selection payload' }),
    );

    expect(readPreview('selection-payload-preview')).toEqual({
      mode: 'include',
      ids: ['txn-a', 'txn-b'],
    });
  });

  it('uses the AG Grid applied filter model only when filtered exclude selection needs query context', () => {
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
      });

      childCapture.dataset?.onSelectionChange?.({
        mode: 'exclude',
        ids: ['txn-excluded'],
      });
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview selection payload' }),
    );

    expect(readPreview('selection-payload-preview')).toEqual({
      mode: 'exclude',
      ids: ['txn-excluded'],
      filters: [
        {
          field: 'status',
          operator: 'equals',
          value: 'Completed',
        },
      ],
    });
  });

  it('builds all-record exclude selection with an explicitly unfiltered backend scope', () => {
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
      screen.getByRole('button', { name: 'Preview selection payload' }),
    );

    expect(readPreview('selection-payload-preview')).toEqual({
      mode: 'exclude',
      ids: ['txn-a'],
      filters: [],
    });
  });

  it('builds selected-edit preview as edited rows intersected with logical selection', () => {
    const editingState = createEmptyTransactionEditingState();
    editingState.changesById['txn-a'] = { amount: 100 };
    editingState.changesById['txn-b'] = { status: 'Completed' };

    render(
      <TransactionsInfiniteGrid
        selectionScope="page"
        gridOptions={serverBackedGridDefaults}
        editingState={editingState}
      />,
    );

    act(() => {
      childCapture.page?.onSelectionChange?.({
        mode: 'include',
        ids: ['txn-b'],
      });
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Preview selected edit payload' }),
    );

    expect(readPreview('selected-edit-payload-preview')).toEqual({
      updates: [
        {
          id: 'txn-b',
          changes: { status: 'Completed' },
        },
      ],
    });
  });
});
