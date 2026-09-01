import { resolveTransactionConfigurableLabel } from '@/features/transactions/configurable/transactionsConfigurableFeature';

const REVIEW_LABELS: Readonly<Record<string, string>> = {
  'review.entities.loan': 'Loans',
  'review.entities.finance': 'Finance',
  'review.loan.borrower': 'Borrower',
  'review.loan.principal': 'Principal',
  'review.loan.currency': 'Currency',
  'review.loan.status': 'Loan status',
  'review.loan.originationDate': 'Origination date',
  'review.loan.region': 'Region',
  'review.loan.internalScore': 'Internal score',
  'review.finance.facility': 'Facility',
  'review.finance.counterparty': 'Counterparty',
  'review.finance.exposure': 'Exposure',
  'review.finance.currency': 'Currency',
  'review.finance.desk': 'Desk',
  'review.finance.reviewStatus': 'Review status',
  'review.finance.utilizationPct': 'Utilization',
  'review.finance.nextReviewDate': 'Next review date',
};

export function resolveReviewLabel(labelKey: string) {
  const label = REVIEW_LABELS[labelKey];
  if (label) return label;

  // Transaction joins Review by reusing its existing rich EntityDefinition, including its translation
  // keys. Delegating preserves one source of truth instead of copying Transaction labels into Review.
  if (labelKey.startsWith('transactions.')) {
    return resolveTransactionConfigurableLabel(labelKey);
  }

  throw new Error(`Unknown Review configurable label key: ${labelKey}`);
}
