// GRIDCAP-QUERY-SORT | GRIDCAP-QUERY-FILTER
import type { FlatGridBlockRequest } from '@/shared/grid/data/gridData.types';
import type { GridFilterOperator } from '@/shared/grid/query/gridQuery.contracts';
import type {
  LoanField,
  LoanListRequest,
} from './loan.contracts';

const LOAN_FIELD_MAP: Readonly<Record<string, LoanField>> = {
  borrower: 'borrower',
  principal: 'principal',
  currency: 'currency',
  status: 'status',
  originationDate: 'originationDate',
  internalScore: 'internalScore',
  region: 'region',
};

const LOAN_FILTER_OPERATORS = new Set<GridFilterOperator>([
  'contains',
  'equals',
  'notEqual',
  'startsWith',
  'endsWith',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
]);

interface SimpleAgFilterModel {
  type?: unknown;
  filter?: unknown;
  dateFrom?: unknown;
  conditions?: unknown;
}

function mapLoanFilter(fieldId: string, rawModel: unknown) {
  const field = LOAN_FIELD_MAP[fieldId];
  if (!field) throw new Error(`Unsupported Loan filter field: ${fieldId}`);
  if (!rawModel || typeof rawModel !== 'object') {
    throw new Error(`Invalid Loan filter model for ${fieldId}.`);
  }

  const model = rawModel as SimpleAgFilterModel;
  if (model.conditions) {
    throw new Error('Combined Loan filter conditions are not supported by the current API.');
  }
  if (
    typeof model.type !== 'string' ||
    !LOAN_FILTER_OPERATORS.has(model.type as GridFilterOperator)
  ) {
    throw new Error(`Unsupported Loan filter operator for ${fieldId}.`);
  }

  const rawValue = model.filter ?? model.dateFrom;
  if (typeof rawValue !== 'string' && typeof rawValue !== 'number') {
    throw new Error(`Loan filter ${fieldId} requires a string or numeric value.`);
  }

  return {
    field,
    operator: model.type as GridFilterOperator,
    value:
      field === 'originationDate' && typeof rawValue === 'string'
        ? rawValue.slice(0, 10)
        : rawValue,
  };
}

/**
 * One Loan translation boundary is reused by SSRM loading and the common Review Submit action.
 * That guarantees an All Filtered Submit targets the same backend Loan universe shown by the grid.
 */
export function mapLoanFilterModel(filterModel: object) {
  return Object.entries(filterModel).map(([fieldId, model]) => mapLoanFilter(fieldId, model));
}

export function mapLoanGridRequest(request: FlatGridBlockRequest): LoanListRequest {
  return {
    offset: request.startRow,
    limit: request.endRow - request.startRow,
    sort: request.sortModel.map(({ colId, sort }) => {
      const field = LOAN_FIELD_MAP[colId];
      if (!field) throw new Error(`Unsupported Loan sort field: ${colId}`);
      return { field, direction: sort };
    }),
    filters: mapLoanFilterModel(request.filterModel),
  };
}
