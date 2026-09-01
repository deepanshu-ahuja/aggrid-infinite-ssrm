import type { ReviewApplicationAccessProjection } from './reviewDefinition.types';

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
 * These are authorization allowlists, NOT partial entity/grid overrides. Missing fields and actions are
 * unavailable by default. That default-deny rule is important: adding a new field/action to a base
 * definition must never silently expose it to every existing user profile.
 */
export const reviewAccessProfiles: Readonly<
  Record<ReviewAccessProfileKey, ReviewApplicationAccessProjection>
> = {
  loanOnly: {
    features: {
      review: {
        entities: {
          loan: {
            fields: fullLoanFields,
            actions: { submit: true },
          },
        },
      },
    },
  },
  financeOnly: {
    features: {
      review: {
        entities: {
          finance: {
            fields: fullFinanceFields,
            actions: { submit: true },
          },
        },
      },
    },
  },
  transactionOnly: {
    features: {
      review: {
        entities: {
          transaction: {
            fields: fullTransactionFields,
            actions: { submit: true },
          },
        },
      },
    },
  },
  loanAndFinance: {
    features: {
      review: {
        entities: {
          loan: {
            fields: fullLoanFields,
            actions: { submit: true },
          },
          finance: {
            fields: fullFinanceFields,
            actions: { submit: true },
          },
        },
      },
    },
  },
  allEntities: {
    features: {
      review: {
        entities: {
          loan: {
            fields: fullLoanFields,
            actions: { submit: true },
          },
          finance: {
            fields: fullFinanceFields,
            actions: { submit: true },
          },
          transaction: {
            fields: fullTransactionFields,
            actions: { submit: true },
          },
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
            fields: {
              borrower: 'read',
              principal: 'edit',
              currency: 'read',
              status: 'edit',
            },
            actions: { submit: true },
          },
        },
      },
    },
  },
};

export function isReviewAccessProfileKey(value: string | null): value is ReviewAccessProfileKey {
  return value !== null && Object.prototype.hasOwnProperty.call(reviewAccessProfiles, value);
}
