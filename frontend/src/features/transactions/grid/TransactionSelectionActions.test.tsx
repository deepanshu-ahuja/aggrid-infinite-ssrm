// GRIDCAP-ACTION-SELECTED
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransactionSelectionActions } from './TransactionSelectionActions';

describe('TransactionSelectionActions', () => {
  it.each([
    ['Mark Completed', 'Completed'],
    ['Mark Pending', 'Pending'],
    ['Mark Failed', 'Failed'],
  ] as const)('%s explicitly requests selection clear after success', (label, status) => {
    const onSetStatus = vi.fn();

    render(
      <TransactionSelectionActions
        hasSelection
        selectedRowCount={3}
        isApplying={false}
        statusActionBlockedByConflict={false}
        onSetStatus={onSetStatus}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: label }));

    expect(onSetStatus).toHaveBeenCalledWith(status, 'clear');
  });
});
