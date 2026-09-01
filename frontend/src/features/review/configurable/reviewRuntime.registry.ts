// GRIDCAP-DATA-LOAD | GRIDCAP-QUERY-SORT | GRIDCAP-QUERY-FILTER | GRIDCAP-ACTION-SELECTED | GRIDCAP-ROW-ELIGIBILITY
import { listTransactions, updateTransactionsBySelection } from '@/features/transactions/api/transactions.api';
import {
  mapTransactionFilterModel,
  mapTransactionGridRequest,
} from '@/features/transactions/grid/transactionRequest.mapper';
import { listLoans, submitLoans } from '../entities/loan/loan.api';
import { mapLoanFilterModel, mapLoanGridRequest } from '../entities/loan/loanRequest.mapper';
import { searchFinance, submitFinanceReview } from '../entities/finance/finance.api';
import {
  mapFinanceGridRequest,
  mapFinanceSubmitTarget,
} from '../entities/finance/financeRequest.mapper';
import { reviewRegistries } from './reviewRegistries';
import type {
  ReviewEntityRuntime,
  ReviewRuntimeRow,
} from './reviewRuntime.types';

const loanRuntime: ReviewEntityRuntime = {
  rowsLoader: async (request, context) => {
    const result = await listLoans(mapLoanGridRequest(request), context.signal);
    return {
      // Concrete API contracts remain strongly typed until this single dynamic runtime boundary.
      rows: result.rows as ReviewRuntimeRow[],
      totalCount: result.totalCount,
      filteredCount: result.filteredCount,
    };
  },
  registries: reviewRegistries,
  primaryAction: {
    label: 'Submit',
    execute: async ({ selection, filterModel }, signal) => {
      const response = await submitLoans(
        {
          selection,
          // Exact include IDs are already the whole target. Exclude mode uses current filters to mean
          // All Filtered; an empty filter model means All Records.
          filters: selection.mode === 'include' ? [] : mapLoanFilterModel(filterModel),
        },
        signal,
      );
      return { affectedCount: response.submittedCount };
    },
  },
};

const financeRuntime: ReviewEntityRuntime = {
  rowsLoader: async (request, context) => {
    const response = await searchFinance(mapFinanceGridRequest(request), context.signal);
    return {
      // Finance's wire response is deliberately `records + counts`, not GridListResponse. Normalize it
      // here so the shared SSRM datasource lifecycle never learns Finance API vocabulary.
      rows: response.records as ReviewRuntimeRow[],
      totalCount: response.counts.universe,
      filteredCount: response.counts.matching,
    };
  },
  registries: reviewRegistries,
  primaryAction: {
    label: 'Submit',
    execute: async ({ selection, filterModel }, signal) => {
      const response = await submitFinanceReview(
        {
          command: 'SUBMIT_REVIEW',
          target: mapFinanceSubmitTarget(selection, filterModel),
        },
        signal,
      );
      return {
        affectedCount: response.outcome.accepted,
        message: `Finance operation ${response.operationId} accepted.`,
      };
    },
  },
};

const transactionRuntime: ReviewEntityRuntime = {
  rowsLoader: async (request, context) => {
    const result = await listTransactions(mapTransactionGridRequest(request), context.signal);
    return {
      rows: result.rows.map((row) => ({ ...row })),
      totalCount: result.totalCount,
      filteredCount: result.filteredCount,
    };
  },
  registries: reviewRegistries,
  runtimePolicy: {
    // Transaction already receives backend-authoritative row interaction metadata. Preserve those same
    // generic effects when Transaction is rendered by Review instead of weakening the mature SSRM
    // behavior merely because the columns are configurable.
    isRowSelectable: ({ data }) => data?.interactionMode === 'enabled',
    isCellEditable: ({ data }) => data?.interactionMode !== 'readOnly',
  },
  primaryAction: {
    label: 'Submit',
    execute: async ({ selection, filterModel }, signal) => {
      const response = await updateTransactionsBySelection(
        {
          selection,
          filters: selection.mode === 'include' ? [] : mapTransactionFilterModel(filterModel),
          // Review's generic Submit semantics use the existing Transaction API to place targeted rows
          // into Pending. The generic Review component knows neither this field nor this endpoint.
          changes: { status: 'Pending' },
        },
        signal,
      );
      return { affectedCount: response.updatedCount };
    },
  },
};

/**
 * Executable runtime registry keyed by EntityDefinition.dataAdapterKey.
 * Adding an entity does not add another `if (entity === ...)` branch to the Review component.
 */
export const reviewEntityRuntimeRegistry: Readonly<Record<string, ReviewEntityRuntime>> = {
  'review-loans': loanRuntime,
  'review-finance': financeRuntime,
  transactions: transactionRuntime,
};

export function requireReviewEntityRuntime(dataAdapterKey: string): ReviewEntityRuntime {
  const runtime = reviewEntityRuntimeRegistry[dataAdapterKey];
  if (!runtime) {
    throw new Error(`Unknown Review entity runtime adapter: ${dataAdapterKey}`);
  }
  return runtime;
}
