import type { FeatureDefinition } from '@/shared/grid/configurable/configuration.types';
import { financeEntityDefinition } from '../entities/finance/finance.config';
import { loanEntityDefinition } from '../entities/loan/loan.config';
import { transactionReviewEntityDefinition } from '../entities/transaction/transaction.config';

export const REVIEW_FEATURE_KEY = 'review';
export type ReviewEntityKey = 'loan' | 'finance' | 'transaction';

/**
 * Everything the Review feature CAN support before current-user access is applied.
 *
 * Loan, Finance and Transaction are all Review entities. They deliberately differ in row identity and
 * backend contracts, while Review resolves executable behavior from `dataAdapterKey` rather than using
 * entity-specific render branches.
 *
 * Transaction's large configurable definition remains owned by the Transaction feature. The Review
 * transaction adapter composes that existing definition with Review-only action metadata so there is no
 * second drifting copy of Transaction columns/options.
 */
export const reviewFeatureDefinition: FeatureDefinition<
  typeof REVIEW_FEATURE_KEY,
  ReviewEntityKey
> = {
  featureKey: REVIEW_FEATURE_KEY,
  entities: {
    loan: loanEntityDefinition,
    finance: financeEntityDefinition,
    transaction: transactionReviewEntityDefinition,
  },
};

export function isReviewEntityKey(value: string | null): value is ReviewEntityKey {
  return value === 'loan' || value === 'finance' || value === 'transaction';
}
