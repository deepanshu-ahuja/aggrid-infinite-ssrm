// GRIDCAP-DATA-LOAD | GRIDCAP-QUERY-SORT | GRIDCAP-QUERY-FILTER | GRIDCAP-ACTION-SELECTED
import { listLoans, submitLoans } from '../entities/loan/loan.api';
import { mapLoanFilterModel, mapLoanGridRequest } from '../entities/loan/loanRequest.mapper';
import { searchFinance, submitFinanceReview } from '../entities/finance/finance.api';
import {
  mapFinanceGridRequest,
  mapFinanceSubmitTarget,
} from '../entities/finance/financeRequest.mapper';
import { transactionReviewRuntime } from '../entities/transaction/transaction.runtime';
import { reviewRegistries } from './reviewRegistries';
import type {
  ReviewEntityRuntime,
  ReviewRuntimeRow,
} from './reviewRuntime.types';

const loanRuntime: ReviewEntityRuntime = {
  rowsLoader: async (request, context) => {
    const result = await listLoans(mapLoanGridRequest(request), context.signal);
    return {
      rows: result.rows as ReviewRuntimeRow[],
      totalCount: result.totalCount,
      filteredCount: result.filteredCount,
    };
  },
  registries: reviewRegistries,
  primaryAction: {
    key: 'submit',
    execute: async ({ selection, filterModel }, signal) => {
      const response = await submitLoans(
        {
          selection,
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
    key: 'submit',
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
 * Loan, Finance and Transaction can all have different backend contracts. The generic grid sees only
 * this normalized runtime boundary; backend request/response differences stay inside entity adapters.
 */
export const reviewEntityRuntimeRegistry: Readonly<Record<string, ReviewEntityRuntime>> = {
  'review-loans': loanRuntime,
  'review-finance': financeRuntime,
  transactions: transactionReviewRuntime,
};

export function requireReviewEntityRuntime(dataAdapterKey: string): ReviewEntityRuntime {
  const runtime = reviewEntityRuntimeRegistry[dataAdapterKey];
  if (!runtime) {
    throw new Error(`Unknown Review entity runtime adapter: ${dataAdapterKey}`);
  }
  return runtime;
}
