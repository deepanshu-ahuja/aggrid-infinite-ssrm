import { transactionsConfigurableFeature } from '@/features/transactions/configurable/transactionsConfigurableFeature';
import type { ReviewEntityDefinition } from '../../configurable/reviewDefinition.types';

const baseTransactionEntity = transactionsConfigurableFeature.entities.transaction;
if (!baseTransactionEntity) {
  throw new Error('The Transaction configurable feature does not expose its transaction entity.');
}

/**
 * Review adapter for the existing Transaction configurable entity.
 *
 * Transaction's rich column/grid definition remains owned by the Transaction feature. Review does not
 * copy that configuration: it composes the existing entity with only Review-specific business metadata.
 * This keeps Transaction visibly present as a Review entity without creating a second drifting source.
 */
export const transactionReviewEntityDefinition: ReviewEntityDefinition = {
  ...baseTransactionEntity,
  actions: [
    {
      key: 'submit',
      labelKey: 'review.actions.submit',
      placement: 'primary',
    },
  ],
};
