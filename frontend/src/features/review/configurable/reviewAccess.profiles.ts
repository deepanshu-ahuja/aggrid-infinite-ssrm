import type { ConfigurableApplicationAccessProjection } from '@/shared/grid/configurable/configuration.access';

export const REVIEW_ACCESS_PROFILE_STORAGE_KEY = 'aggrid.devAccessProfile';
export const REVIEW_ACTIVE_ENTITY_STORAGE_KEY = 'aggrid.devActiveEntity';
export const DEFAULT_REVIEW_ACCESS_PROFILE = 'allEntities';

export type ReviewAccessProfileKey =
  | 'loanOnly'
  | 'financeOnly'
  | 'transactionOnly'
  | 'loanAndFinance'
  | 'allEntities'
  | 'loanReadOnly'
  | 'loanRestricted';

const fullLoanFields = {
  borrower: 'edit',
  principal: 'edit',
  currency: 'edit',
  status: 'edit',
  originationDate: 'edit',
  region: 'edit',
  internalScore: 'read',
} as const;

const fullFinanceFields = {
  facility: 'read',
  counterparty: 'edit',
  exposure: 'edit',
  currency: 'read',
  desk: 'edit',
  reviewStatus: 'edit',
  utilizationPct: 'edit',
  nextReviewDate: 'edit',
} as const;

const fullTransactionFields = {
  reference: 'read',
  interaction: 'read',
  account: 'edit',
  amount: 'edit',
  currency: 'edit',
  status: 'edit',
  transactionDate: 'edit',
} as const;

/**
 * FE-only resolved access fixtures selected through localStorage.
 *
 * These are authorization allowlists, NOT partial EntityDefinition overrides. A field omitted here is
 * absent for that simulated user. This default-deny rule prevents a newly-added base field from being
 * silently exposed to every existing profile.
 */
export const reviewAccessProfiles: Readonly<
  Record<ReviewAccessProfileKey, ConfigurableApplicationAccessProjection>
> = {
  loanOnly: {
    features: {
      review: { entities: { loan: { fields: fullLoanFields } } },
    },
  },
  financeOnly: {
    features: {
      review: { entities: { finance: { fields: fullFinanceFields } } },
    },
  },
  transactionOnly: {
    features: {
      review: { entities: { transaction: { fields: fullTransactionFields } } },
    },
  },
  loanAndFinance: {
    features: {
      review: {
        entities: {
          loan: { fields: fullLoanFields },
          finance: { fields: fullFinanceFields },
        },
      },
    },
  },
  allEntities: {
    features: {
      review: {
        entities: {
          loan: { fields: fullLoanFields },
          finance: { fields: fullFinanceFields },
          transaction: { fields: fullTransactionFields },
        },
      },
    },
  },
  loanReadOnly: {
    features: {
      review: {
        entities: {
          loan: {
            fields: {
              borrower: 'read',
              principal: 'read',
              currency: 'read',
              status: 'read',
              originationDate: 'read',
              region: 'read',
              internalScore: 'read',
            },
          },
        },
      },
    },
  },
  loanRestricted: {
    features: {
      review: {
        entities: {
          loan: {
            // Internal score, region and origination date are deliberately absent for this simulated
            // user. The resolver removes them entirely rather than merely hiding rendered columns.
            fields: {
              borrower: 'read',
              principal: 'edit',
              currency: 'read',
              status: 'edit',
            },
          },
        },
      },
    },
  },
};

export function isReviewAccessProfileKey(value: string | null): value is ReviewAccessProfileKey {
  return value !== null && Object.prototype.hasOwnProperty.call(reviewAccessProfiles, value);
}
