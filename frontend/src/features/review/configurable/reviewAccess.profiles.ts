import type { ReviewApplicationAccessProjection } from './reviewDefinition.types';

export const REVIEW_ACCESS_PROFILE_STORAGE_KEY = 'aggrid.devAccessProfile';
export const REVIEW_ACTIVE_ENTITY_STORAGE_KEY = 'aggrid.devActiveEntity';
export const DEFAULT_REVIEW_ACCESS_PROFILE = 'loanAndFinance';

export type ReviewAccessProfileKey =
  | 'loanOnly'
  | 'financeOnly'
  | 'loanAndFinance'
  | 'loanReadOnly'
  | 'loanRestricted';

const fullLoanFields = {
  borrower: 'edit',
  borrowerTaxId: 'read',
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
  counterpartyReference: 'read',
  exposure: 'edit',
  currency: 'read',
  desk: 'edit',
  reviewStatus: 'edit',
  utilizationPct: 'edit',
  nextReviewDate: 'edit',
} as const;

/**
 * FE-only resolved access fixtures selected through localStorage.
 *
 * These are authorization allowlists, NOT partial entity/grid overrides. Missing fields, actions and
 * sensitive entitlements are unavailable by default. That default-deny rule is important: adding a new
 * field/action to a base definition must never silently expose it to every existing user profile.
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
            sensitiveFields: { borrowerTaxId: { canRequestUnmask: true } },
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
            actions: { submit: true, escalate: true },
            sensitiveFields: { counterpartyReference: { canRequestUnmask: true } },
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
            sensitiveFields: { borrowerTaxId: { canRequestUnmask: true } },
          },
          finance: {
            fields: fullFinanceFields,
            actions: { submit: true, escalate: true },
            sensitiveFields: { counterpartyReference: { canRequestUnmask: true } },
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
              borrowerTaxId: 'read',
              principal: 'read',
              currency: 'read',
              status: 'read',
              originationDate: 'read',
              region: 'read',
              internalScore: 'read',
            },
            // No actions/unmask entitlement: read-only field access does not imply business-action or
            // sensitive-value permission.
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
            // Internal score, borrower tax id, region and origination date are deliberately absent.
            // The resolver removes them entirely rather than merely hiding rendered columns.
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
