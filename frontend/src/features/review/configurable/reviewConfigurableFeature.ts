// GRIDCAP-CONFIG-ACCESS | GRIDCAP-COLUMNS | GRIDCAP-DATA-LOAD
import type { GridRowsLoader } from '@/shared/grid/data/gridData.types';
import type { ConfigurableApplicationAccessProjection } from '@/shared/grid/configurable/configuration.access';
import type { ConfigurableGridRegistries } from '@/shared/grid/configurable/configuration.registries';
import type { EntityDefinition, FeatureDefinition } from '@/shared/grid/configurable/configuration.types';
import { defaultGridValidatorRegistry } from '@/shared/grid/validation/defaultGridValidationRules';

export const REVIEW_FEATURE_KEY = 'review';
export const REVIEW_ACCESS_PROFILE_STORAGE_KEY = 'aggrid.devAccessProfile';
export const REVIEW_ACTIVE_ENTITY_STORAGE_KEY = 'aggrid.devActiveEntity';
export const DEFAULT_REVIEW_ACCESS_PROFILE = 'loanAndFinance';

export type ReviewEntityKey = 'loan' | 'finance';
export type ReviewAccessProfileKey = 'loanOnly' | 'financeOnly' | 'loanAndFinance' | 'loanReadOnly';

export interface LoanReviewRow {
  id: string;
  borrower: string;
  principal: number;
  status: 'Active' | 'Pending' | 'Closed';
  internalScore: number;
}

export interface FinanceReviewRow {
  id: string;
  facility: string;
  counterparty: string;
  exposure: number;
  currency: string;
  reviewStatus: 'Open' | 'Approved' | 'Escalated';
}

export interface ReviewEntityRuntime<TData extends object> {
  key: ReviewEntityKey;
  entity: EntityDefinition;
  rowsLoader: GridRowsLoader<TData>;
  registries: ConfigurableGridRegistries<TData>;
}

/**
 * Base feature definition: everything this Review feature can support before current-user access is
 * applied. Nothing here represents a specific user's authorization.
 */
export const reviewFeatureDefinition = {
  featureKey: REVIEW_FEATURE_KEY,
  entities: {
    loan: {
      labelKey: 'review.entities.loan',
      dataAdapterKey: 'local-loans',
      rowId: { path: 'id' },
      gridOptions: {
        paginationPageSize: 10,
        defaultColDef: { resizable: true },
      },
      fields: [
        {
          colId: 'borrower',
          field: 'borrower',
          labelKey: 'review.loan.borrower',
          cellDataType: 'text',
          minWidth: 180,
          editable: true,
          cellEditor: 'agTextCellEditor',
          validationRules: [{ key: 'required', message: 'Borrower is required.' }],
        },
        {
          colId: 'principal',
          field: 'principal',
          labelKey: 'review.loan.principal',
          cellDataType: 'number',
          minWidth: 150,
          editable: true,
          cellEditor: 'agNumberCellEditor',
          cellEditorParams: { min: 0 },
          validationRules: [
            { key: 'numberRange', params: { min: 0 }, message: 'Principal must be zero or greater.' },
          ],
        },
        {
          colId: 'status',
          field: 'status',
          labelKey: 'review.loan.status',
          cellDataType: 'text',
          minWidth: 130,
          editable: true,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: { values: ['Active', 'Pending', 'Closed'] },
          validationRules: [{ key: 'required', message: 'Loan status is required.' }],
        },
        {
          colId: 'internalScore',
          field: 'internalScore',
          labelKey: 'review.loan.internalScore',
          cellDataType: 'number',
          minWidth: 150,
          editable: false,
        },
      ],
    },
    finance: {
      labelKey: 'review.entities.finance',
      dataAdapterKey: 'local-finance',
      rowId: { path: 'id' },
      gridOptions: {
        paginationPageSize: 10,
        defaultColDef: { resizable: true },
      },
      fields: [
        {
          colId: 'facility',
          field: 'facility',
          labelKey: 'review.finance.facility',
          cellDataType: 'text',
          minWidth: 170,
          editable: false,
        },
        {
          colId: 'counterparty',
          field: 'counterparty',
          labelKey: 'review.finance.counterparty',
          cellDataType: 'text',
          minWidth: 180,
          editable: true,
          cellEditor: 'agTextCellEditor',
          validationRules: [{ key: 'required', message: 'Counterparty is required.' }],
        },
        {
          colId: 'exposure',
          field: 'exposure',
          labelKey: 'review.finance.exposure',
          cellDataType: 'number',
          minWidth: 150,
          editable: true,
          cellEditor: 'agNumberCellEditor',
          cellEditorParams: { min: 0 },
          validationRules: [
            { key: 'numberRange', params: { min: 0 }, message: 'Exposure must be zero or greater.' },
          ],
        },
        {
          colId: 'currency',
          field: 'currency',
          labelKey: 'review.finance.currency',
          cellDataType: 'text',
          maxWidth: 120,
          editable: false,
        },
        {
          colId: 'reviewStatus',
          field: 'reviewStatus',
          labelKey: 'review.finance.reviewStatus',
          cellDataType: 'text',
          minWidth: 150,
          editable: true,
          cellEditor: 'agSelectCellEditor',
          cellEditorParams: { values: ['Open', 'Approved', 'Escalated'] },
          validationRules: [{ key: 'required', message: 'Review status is required.' }],
        },
      ],
    },
  },
} satisfies FeatureDefinition<typeof REVIEW_FEATURE_KEY, ReviewEntityKey>;

/**
 * Frontend-only simulated profiles. These represent already-resolved current-user access; generic
 * feature/grid code never checks the profile name or derives policy from a role string.
 */
export const reviewAccessProfiles: Readonly<Record<ReviewAccessProfileKey, ConfigurableApplicationAccessProjection>> = {
  loanOnly: {
    features: {
      review: {
        entities: {
          loan: { fields: { borrower: 'edit', principal: 'edit', status: 'edit' } },
        },
      },
    },
  },
  financeOnly: {
    features: {
      review: {
        entities: {
          finance: {
            fields: {
              facility: 'read',
              counterparty: 'edit',
              exposure: 'edit',
              currency: 'read',
              reviewStatus: 'edit',
            },
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
            fields: {
              borrower: 'edit',
              principal: 'edit',
              status: 'edit',
              internalScore: 'read',
            },
          },
          finance: {
            fields: {
              facility: 'read',
              counterparty: 'edit',
              exposure: 'edit',
              currency: 'read',
              reviewStatus: 'edit',
            },
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
              status: 'read',
              internalScore: 'read',
            },
          },
        },
      },
    },
  },
};

const loanRows: LoanReviewRow[] = [
  { id: 'LN-1001', borrower: 'Northstar Builders', principal: 1250000, status: 'Active', internalScore: 82 },
  { id: 'LN-1002', borrower: 'Harbor Homes', principal: 780000, status: 'Pending', internalScore: 67 },
  { id: 'LN-1003', borrower: 'Cedar Developments', principal: 2150000, status: 'Closed', internalScore: 91 },
];

const financeRows: FinanceReviewRow[] = [
  { id: 'FN-2001', facility: 'Revolver A', counterparty: 'Atlas Capital', exposure: 4600000, currency: 'USD', reviewStatus: 'Open' },
  { id: 'FN-2002', facility: 'Term Facility B', counterparty: 'Orion Finance', exposure: 3250000, currency: 'EUR', reviewStatus: 'Approved' },
  { id: 'FN-2003', facility: 'Bridge C', counterparty: 'Summit Partners', exposure: 1900000, currency: 'GBP', reviewStatus: 'Escalated' },
];

function createLocalRowsLoader<TData>(rows: readonly TData[]): GridRowsLoader<TData> {
  return async (request) => {
    // This FE-only development source intentionally implements no server sort/filter semantics yet.
    // The access/profile experiment is about configuration projection, not pretending local arrays are
    // a production backend. Fields therefore keep sorting/filtering disabled in the base definitions.
    const visibleRows = rows.slice(request.startRow, request.endRow);
    return {
      rows: visibleRows.map((row) => ({ ...row })),
      totalCount: rows.length,
      filteredCount: rows.length,
    };
  };
}

function createRegistries<TData>(): ConfigurableGridRegistries<TData> {
  return {
    filters: new Set(),
    editors: new Set(['agTextCellEditor', 'agNumberCellEditor', 'agSelectCellEditor']),
    renderers: new Set(),
    valueFormatters: {},
    valueParsers: {},
    validators: defaultGridValidatorRegistry,
  };
}

export const reviewEntityRuntimes = {
  loan: {
    key: 'loan',
    entity: reviewFeatureDefinition.entities.loan,
    rowsLoader: createLocalRowsLoader(loanRows),
    registries: createRegistries<LoanReviewRow>(),
  } satisfies ReviewEntityRuntime<LoanReviewRow>,
  finance: {
    key: 'finance',
    entity: reviewFeatureDefinition.entities.finance,
    rowsLoader: createLocalRowsLoader(financeRows),
    registries: createRegistries<FinanceReviewRow>(),
  } satisfies ReviewEntityRuntime<FinanceReviewRow>,
};

const REVIEW_LABELS: Readonly<Record<string, string>> = {
  'review.entities.loan': 'Loans',
  'review.entities.finance': 'Finance',
  'review.loan.borrower': 'Borrower',
  'review.loan.principal': 'Principal',
  'review.loan.status': 'Loan status',
  'review.loan.internalScore': 'Internal score',
  'review.finance.facility': 'Facility',
  'review.finance.counterparty': 'Counterparty',
  'review.finance.exposure': 'Exposure',
  'review.finance.currency': 'Currency',
  'review.finance.reviewStatus': 'Review status',
};

export function resolveReviewLabel(labelKey: string) {
  const label = REVIEW_LABELS[labelKey];
  if (!label) throw new Error(`Unknown Review configurable label key: ${labelKey}`);
  return label;
}

export function isReviewAccessProfileKey(value: string | null): value is ReviewAccessProfileKey {
  return value !== null && Object.prototype.hasOwnProperty.call(reviewAccessProfiles, value);
}

export function isReviewEntityKey(value: string | null): value is ReviewEntityKey {
  return value === 'loan' || value === 'finance';
}
