// GRIDCAP-DATA-LOAD | GRIDCAP-QUERY-SORT | GRIDCAP-QUERY-FILTER | GRIDCAP-ACTION-SELECTED | GRIDCAP-ROW-ELIGIBILITY
import {
  listTransactions,
  updateTransactionsBySelection,
} from '@/features/transactions/api/transactions.api';
import {
  mapTransactionFilterModel,
  mapTransactionGridRequest,
} from '@/features/transactions/grid/transactionRequest.mapper';
import { reviewRegistries } from '../../configurable/reviewRegistries';
import type {
  ReviewEntityRuntime,
  ReviewRuntimeRow,
} from '../../configurable/reviewRuntime.types';

/**
 * Review runtime adapter for the existing Transaction backend contract.
 *
 * The Transaction feature remains authoritative for its API and query mapper. Review only adapts those
 * proven pieces to the same runtime interface used by Loan and Finance.
 */
export const transactionReviewRuntime: ReviewEntityRuntime = {
  rowsLoader: async (request, context) => {
    const result = await listTransactions(mapTransactionGridRequest(request), context.signal);
    return {
      rows: result.rows.map((row) => ({ ...row })) as ReviewRuntimeRow[],
      totalCount: result.totalCount,
      filteredCount: result.filteredCount,
    };
  },
  registries: reviewRegistries,
  runtimePolicy: {
    // Preserve backend-authoritative Transaction row interaction behavior inside Review.
    isRowSelectable: ({ data }) => data?.interactionMode === 'enabled',
    isCellEditable: ({ data }) => data?.interactionMode !== 'readOnly',
  },
  primaryAction: {
    key: 'submit',
    execute: async ({ selection, filterModel }, signal) => {
      const response = await updateTransactionsBySelection(
        {
          selection,
          filters: selection.mode === 'include' ? [] : mapTransactionFilterModel(filterModel),
          // Review calls this common business action "Submit". The Transaction adapter owns the actual
          // Transaction backend semantics and maps Submit to Pending without leaking that into Review UI.
          changes: { status: 'Pending' },
        },
        signal,
      );
      return { affectedCount: response.updatedCount };
    },
  },
};
