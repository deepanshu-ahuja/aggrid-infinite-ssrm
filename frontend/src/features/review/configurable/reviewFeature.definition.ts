import type { FeatureDefinition } from '@/shared/grid/configurable/configuration.types';
import { transactionsConfigurableFeature } from '@/features/transactions/configurable/transactionsConfigurableFeature';
import { financeEntityDefinition } from '../entities/finance/finance.config';
import { loanEntityDefinition } from '../entities/loan/loan.config';

export const REVIEW_FEATURE_KEY = 'review';
export type ReviewEntityKey = 'loan' | 'finance' | 'transaction';

/**
 * Everything the Review feature CAN support before current-user access is applied.
 *
 * The three entity definitions deliberately differ in field shape, row identity and data adapter.
 * The shared Review component therefore cannot rely on a Loan/Finance/Transaction-specific contract.
 */
export const reviewFeatureDefinition: FeatureDefinition<
  typeof REVIEW_FEATURE_KEY,
  ReviewEntityKey
> = {
  featureKey: REVIEW_FEATURE_KEY,
  entities: {
    loan: loanEntityDefinition,
    finance: financeEntityDefinition,
    // Reuse the already-rich Transaction configurable entity instead of maintaining a second drifting
    // copy. Review resolves its `transactions` dataAdapterKey through the same runtime registry as the
    // new Loan/Finance adapters.
    transaction: transactionsConfigurableFeature.entities.transaction,
  },
};

export function isReviewEntityKey(value: string | null): value is ReviewEntityKey {
  return value === 'loan' || value === 'finance' || value === 'transaction';
}
