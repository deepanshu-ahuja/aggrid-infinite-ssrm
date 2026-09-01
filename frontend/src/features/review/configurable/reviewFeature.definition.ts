import type { FeatureDefinition } from '@/shared/grid/configurable/configuration.types';
import { financeEntityDefinition } from '../entities/finance/finance.config';
import { loanEntityDefinition } from '../entities/loan/loan.config';

export const REVIEW_FEATURE_KEY = 'review';
export type ReviewEntityKey = 'loan' | 'finance';

/**
 * Everything the Review feature CAN support before current-user access is applied.
 *
 * Loan and Finance deliberately differ in row identity, fields and backend adapter/wire contracts.
 * The Review component therefore stays entity-agnostic and resolves executable runtime behavior from
 * each entity's `dataAdapterKey` instead of branching on Loan/Finance component implementations.
 *
 * Transactions remain their own existing feature/grid. Their mature implementation is a reference for
 * reusable SSRM mechanics, not a Review entity that needs to be duplicated or routed through Review.
 */
export const reviewFeatureDefinition: FeatureDefinition<
  typeof REVIEW_FEATURE_KEY,
  ReviewEntityKey
> = {
  featureKey: REVIEW_FEATURE_KEY,
  entities: {
    loan: loanEntityDefinition,
    finance: financeEntityDefinition,
  },
};

export function isReviewEntityKey(value: string | null): value is ReviewEntityKey {
  return value === 'loan' || value === 'finance';
}
