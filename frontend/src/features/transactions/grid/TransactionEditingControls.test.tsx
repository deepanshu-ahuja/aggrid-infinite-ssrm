import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TransactionEditingControls } from './TransactionEditingControls';

function renderControls(onApplyBulkEdit = vi.fn()) {
  render(
    <TransactionEditingControls
      editedRowCount={0}
      conflictCount={0}
      validationErrorCount={0}
      selectedEditedRowCount={0}
      selectedEditsHaveConflict={false}
      selectedEditsHaveValidationError={false}
      isSaving={false}
      onApplyLastEdit={vi.fn()}
      onApplyBulkEdit={onApplyBulkEdit}
      onSaveSelected={vi.fn()}
      onDiscardSelected={vi.fn()}
    />,
  );
  return onApplyBulkEdit;
}

describe('TransactionEditingControls Flow 2', () => {
  it('treats checked + blank Amount as an invalid LOCAL draft instead of silently omitting it', () => {
    const onApplyBulkEdit = renderControls();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Amount' }));

    expect(screen.getByText('Amount must be between 0 and 1,000,000.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply bulk edit' }));

    expect(onApplyBulkEdit).toHaveBeenCalledWith('page', { amount: null });
  });
});
