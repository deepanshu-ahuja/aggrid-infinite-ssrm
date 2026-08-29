// GRIDCAP-IMPORT
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTransactionImport, previewTransactionImport } from '../api/transactions.api';
import { TransactionImportAction } from './TransactionImportAction';

vi.mock('../api/transactions.api', () => ({
  previewTransactionImport: vi.fn(),
  applyTransactionImport: vi.fn(),
}));

const previewMock = vi.mocked(previewTransactionImport);
const applyMock = vi.mocked(applyTransactionImport);

function chooseCsv(content: string) {
  const file = new File([content], 'transactions.csv', { type: 'text/csv' });
  Object.defineProperty(file, 'text', { value: vi.fn().mockResolvedValue(content) });
  fireEvent.change(screen.getByTestId('transaction-import-file'), { target: { files: [file] } });
}

describe('TransactionImportAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('previews before apply and refreshes authoritative data only after successful apply', async () => {
    const onImported = vi.fn();
    previewMock.mockResolvedValue({ valid: true, rowCount: 1, errors: [] });
    applyMock.mockResolvedValue({ updatedCount: 1 });
    render(<TransactionImportAction onImported={onImported} />);

    fireEvent.click(screen.getByRole('button', { name: 'Import CSV' }));
    chooseCsv('id,account\ntxn-00001,Imported\n');
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    await screen.findByText('1 row ready to apply.');
    expect(onImported).not.toHaveBeenCalled();
    expect(previewMock).toHaveBeenCalledWith({
      filename: 'transactions.csv',
      content: 'id,account\ntxn-00001,Imported\n',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Apply import' }));
    await screen.findByText('Imported 1 transaction.');

    expect(applyMock).toHaveBeenCalledTimes(1);
    expect(onImported).toHaveBeenCalledTimes(1);
  });

  it('shows preview errors and keeps Apply disabled when the file is invalid', async () => {
    previewMock.mockResolvedValue({
      valid: false,
      rowCount: 1,
      errors: [{ row: 2, id: 'txn-00001', fields: { account: ['This field may not be blank.'] } }],
    });
    render(<TransactionImportAction onImported={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Import CSV' }));
    chooseCsv('id,account\ntxn-00001,\n');
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    await screen.findByText(/CSV row 2/);
    expect(screen.getByText(/account: This field may not be blank/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply import' })).toBeDisabled());
    expect(applyMock).not.toHaveBeenCalled();
  });
});
