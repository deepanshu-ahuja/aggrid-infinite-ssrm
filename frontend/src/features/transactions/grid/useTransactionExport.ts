// GRIDCAP-EXPORT-PAGE | GRIDCAP-EXPORT-SELECTED | GRIDCAP-SEL-TARGET | GRIDCAP-ROWMODEL-INFINITE | GRIDCAP-ROWMODEL-SSRM
import { useCallback, useState } from 'react';
import type { GridApi } from 'ag-grid-community';
import { downloadBlob } from '@/shared/files/downloadBlob';
import { exportCurrentPageCsv } from '@/shared/grid/export/exportCurrentPageCsv';
import { exportTransactionsBySelection } from '../api/transactions.api';
import type {
  Transaction,
  TransactionSelectionTargetRequest,
} from '../api/transactions.contracts';

/**
 * Transactions export coordination shared by the concrete Infinite and SSRM roots.
 *
 * This is intentionally NOT a row-model controller. Each root still supplies its own GridApi and
 * builds its own logical selection target. The hook only owns the operation lifecycle that is truly
 * identical once those inputs exist.
 */
export function useTransactionExport() {
  const [isExportingSelected, setIsExportingSelected] = useState(false);
  const [error, setError] = useState<string>();

  // GRIDCAP-EXPORT-PAGE
  const exportCurrentPage = useCallback((api: GridApi<Transaction>) => {
    const result = exportCurrentPageCsv(api, 'transactions-current-page.csv');
    setError(result.ok ? undefined : result.error);
  }, []);

  // GRIDCAP-EXPORT-SELECTED | GRIDCAP-SEL-TARGET
  const exportSelected = useCallback(async (request: TransactionSelectionTargetRequest) => {
    setIsExportingSelected(true);
    setError(undefined);

    try {
      const csv = await exportTransactionsBySelection(request);
      downloadBlob(csv, 'transactions-selected.csv');
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : 'Selected transactions could not be exported.',
      );
    } finally {
      setIsExportingSelected(false);
    }
  }, []);

  return {
    error,
    isExportingSelected,
    exportCurrentPage,
    exportSelected,
  };
}
