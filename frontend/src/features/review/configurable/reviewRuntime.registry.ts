// GRIDCAP-DATA-LOAD | GRIDCAP-QUERY-SORT | GRIDCAP-QUERY-FILTER | GRIDCAP-ACTION-SELECTED
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

/**
 * Executable Review runtime registry keyed by EntityDefinition.dataAdapterKey.
 *
 * Loan and Finance intentionally use different backend contracts. The generic grid sees only the
 * normalized runtime boundary and never branches on those wire shapes. Existing Transactions remain
 * outside Review and continue to use their own feature/grid runtime.
 */
export const reviewEntityRuntimeRegistry: Readonly<Record<string, ReviewEntityRuntime>> = {
  'review-loans': loanRuntime,
  'review-finance': financeRuntime,
};

export function requireReviewEntityRuntime(dataAdapterKey: string): ReviewEntityRuntime {
  const runtime = reviewEntityRuntimeRegistry[dataAdapterKey];
  if (!runtime) {
    throw new Error(`Unknown Review entity runtime adapter: ${dataAdapterKey}`);
  }
  return runtime;
}
