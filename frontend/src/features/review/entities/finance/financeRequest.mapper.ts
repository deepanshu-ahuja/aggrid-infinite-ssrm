// GRIDCAP-QUERY-SORT | GRIDCAP-QUERY-FILTER
import type { FlatGridBlockRequest } from '@/shared/grid/data/gridData.types';
import type { GridFilterOperator } from '@/shared/grid/query/gridQuery.contracts';
import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';
import type {
  FinanceComparison,
  FinanceField,
  FinanceSearchRequest,
  FinanceSubmitTarget,
} from './finance.contracts';

const FINANCE_FIELD_MAP: Readonly<Record<string, FinanceField>> = {
  facility: 'facility',
  counterparty: 'counterparty',
  exposure: 'exposure',
  currency: 'currency',
  desk: 'desk',
  reviewStatus: 'reviewStatus',
  utilizationPct: 'utilizationPct',
  nextReviewDate: 'nextReviewDate',
};

const FINANCE_COMPARISON_MAP: Readonly<Record<GridFilterOperator, FinanceComparison>> = {
  contains: 'has',
  equals: 'eq',
  notEqual: 'neq',
  startsWith: 'prefix',
  endsWith: 'suffix',
  greaterThan: 'gt',
  greaterThanOrEqual: 'gte',
  lessThan: 'lt',
  lessThanOrEqual: 'lte',
};

interface SimpleAgFilterModel {
  type?: unknown;
  filter?: unknown;
  dateFrom?: unknown;
  conditions?: unknown;
}

function mapFinanceCriterion(fieldId: string, rawModel: unknown) {
  const attribute = FINANCE_FIELD_MAP[fieldId];
  if (!attribute) throw new Error(`Unsupported Finance filter field: ${fieldId}`);
  if (!rawModel || typeof rawModel !== 'object') {
    throw new Error(`Invalid Finance filter model for ${fieldId}.`);
  }

  const model = rawModel as SimpleAgFilterModel;
  if (model.conditions) {
    throw new Error('Combined Finance filter conditions are not supported by the current API.');
  }
  if (typeof model.type !== 'string' || !(model.type in FINANCE_COMPARISON_MAP)) {
    throw new Error(`Unsupported Finance filter operator for ${fieldId}.`);
  }

  const rawValue = model.filter ?? model.dateFrom;
  if (typeof rawValue !== 'string' && typeof rawValue !== 'number') {
    throw new Error(`Finance filter ${fieldId} requires a string or numeric value.`);
  }

  const operator = model.type as GridFilterOperator;
  return {
    attribute,
    comparison: FINANCE_COMPARISON_MAP[operator],
    operand:
      attribute === 'nextReviewDate' && typeof rawValue === 'string'
        ? rawValue.slice(0, 10)
        : rawValue,
  };
}

/** Finance's complete applied filter translation is shared by loading and Submit targeting. */
export function mapFinanceFilterModel(filterModel: object): FinanceSearchRequest['criteria'] {
  return Object.entries(filterModel).map(([fieldId, model]) =>
    mapFinanceCriterion(fieldId, model),
  );
}

export function mapFinanceGridRequest(request: FlatGridBlockRequest): FinanceSearchRequest {
  return {
    window: {
      from: request.startRow,
      size: request.endRow - request.startRow,
    },
    orderBy: request.sortModel.map(({ colId, sort }) => {
      const attribute = FINANCE_FIELD_MAP[colId];
      if (!attribute) throw new Error(`Unsupported Finance sort field: ${colId}`);
      return {
        attribute,
        descending: sort === 'desc',
      };
    }),
    criteria: mapFinanceFilterModel(request.filterModel),
  };
}

/** Translate generic SSRM selection intent into Finance's unrelated command target vocabulary. */
export function mapFinanceSubmitTarget(
  selection: ServerSelectionIntent<string>,
  filterModel: object,
): FinanceSubmitTarget {
  if (selection.mode === 'include') {
    return {
      mode: 'explicit',
      keys: selection.ids,
    };
  }

  return {
    mode: 'all',
    exceptKeys: selection.ids,
    criteria: mapFinanceFilterModel(filterModel),
  };
}
