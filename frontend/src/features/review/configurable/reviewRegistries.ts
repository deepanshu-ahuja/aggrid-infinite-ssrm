import type { ConfigurableGridRegistries } from '@/shared/grid/configurable/configuration.registries';
import { formatCurrency } from '@/shared/grid/formatters/formatCurrency';
import { formatDate } from '@/shared/grid/formatters/formatDate';
import { defaultGridValidatorRegistry } from '@/shared/grid/validation/defaultGridValidationRules';
import { TransactionInteractionCell } from '@/features/transactions/grid/TransactionInteractionCell';
import { TransactionStatusCell } from '@/features/transactions/grid/TransactionStatusCell';
import { ReviewStatusCell } from '../components/ReviewStatusCell';
import type { ReviewRuntimeRow } from './reviewRuntime.types';

/**
 * Frontend-owned executable implementations available to Review entity metadata.
 *
 * Loan/Finance/Transaction configs may select these stable keys, but JSON-safe configuration never
 * carries executable functions or React components. Keeping one Review registry avoids duplicating
 * identical formatter/parser implementations while entity-specific validation keys remain explicit.
 */
export const reviewRegistries: ConfigurableGridRegistries<ReviewRuntimeRow> = {
  filters: new Set(['agTextColumnFilter', 'agNumberColumnFilter', 'agDateColumnFilter']),
  editors: new Set(['agTextCellEditor', 'agNumberCellEditor', 'agSelectCellEditor']),
  renderers: new Set(['reviewStatus', 'transactionInteraction', 'transactionStatus']),
  components: {
    reviewStatus: ReviewStatusCell,
    transactionInteraction: TransactionInteractionCell,
    transactionStatus: TransactionStatusCell,
  },
  valueFormatters: {
    rowCurrency: () => ({ value, data }) => {
      const currency = data?.currency;
      return typeof value === 'number' && typeof currency === 'string'
        ? formatCurrency(value, currency)
        : '';
    },
    dateText: () => ({ value }) => (typeof value === 'string' ? formatDate(value) : ''),
    percentage: () => ({ value }) =>
      typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : '',
    // The earlier Transaction configurable entity already references these stable names. Register
    // equivalent implementations here so that entity can join Review without rewriting its metadata.
    transactionCurrency: () => ({ value, data }) => {
      const currency = data?.currency;
      return typeof value === 'number' && typeof currency === 'string'
        ? formatCurrency(value, currency)
        : '';
    },
    transactionDate: () => ({ value }) => (typeof value === 'string' ? formatDate(value) : ''),
  },
  valueParsers: {
    trimText: () => ({ newValue }) =>
      typeof newValue === 'string' ? newValue.trim() : newValue,
    uppercaseText: () => ({ newValue }) =>
      typeof newValue === 'string' ? newValue.trim().toUpperCase() : newValue,
  },
  validators: {
    ...defaultGridValidatorRegistry,
    currencyCode: (value) => ({
      valid: typeof value === 'string' && /^[A-Z]{3}$/.test(value),
      defaultMessage: 'Must be a 3-letter currency code.',
    }),
    isoDate: (value) => ({
      valid:
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
      defaultMessage: 'Must use YYYY-MM-DD.',
    }),
    loanStatus: (value) => ({
      valid: value === 'Active' || value === 'Pending' || value === 'Closed',
      defaultMessage: 'Must be Active, Pending, or Closed.',
    }),
    financeReviewStatus: (value) => ({
      valid:
        value === 'Open' || value === 'Submitted' || value === 'Approved' || value === 'Escalated',
      defaultMessage: 'Must be Open, Submitted, Approved, or Escalated.',
    }),
    transactionStatus: (value) => ({
      valid: value === 'Completed' || value === 'Pending' || value === 'Failed',
      defaultMessage: 'Must be Completed, Pending, or Failed.',
    }),
    transactionDate: (value) => ({
      valid:
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
      defaultMessage: 'Must use YYYY-MM-DD.',
    }),
  },
};
