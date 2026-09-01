export type FinanceField =
  | 'facility'
  | 'counterparty'
  | 'exposure'
  | 'currency'
  | 'desk'
  | 'reviewStatus'
  | 'utilizationPct'
  | 'nextReviewDate';

export type FinanceComparison =
  | 'has'
  | 'eq'
  | 'neq'
  | 'prefix'
  | 'suffix'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

export interface FinanceReviewRow extends Record<string, unknown> {
  recordKey: string;
  facility: string;
  counterparty: string;
  exposure: number;
  currency: string;
  desk: string;
  reviewStatus: 'Open' | 'Submitted' | 'Approved' | 'Escalated';
  utilizationPct: number;
  nextReviewDate: string;
}

export interface FinanceSearchRequest {
  window: {
    from: number;
    size: number;
  };
  orderBy: Array<{
    attribute: FinanceField;
    descending: boolean;
  }>;
  criteria: Array<{
    attribute: FinanceField;
    comparison: FinanceComparison;
    operand: string | number;
  }>;
}

export interface FinanceSearchResponse {
  records: FinanceReviewRow[];
  counts: {
    universe: number;
    matching: number;
  };
}

export type FinanceSubmitTarget =
  | {
      mode: 'explicit';
      keys: string[];
    }
  | {
      mode: 'all';
      exceptKeys: string[];
      criteria: FinanceSearchRequest['criteria'];
    };

export interface FinanceSubmitRequest {
  command: 'SUBMIT_REVIEW';
  target: FinanceSubmitTarget;
}

export interface FinanceSubmitResponse {
  outcome: {
    accepted: number;
  };
  operationId: string;
}
