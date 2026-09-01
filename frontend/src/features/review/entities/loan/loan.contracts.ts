import type {
  GridListRequest,
  GridListResponse,
  GridQueryFilter,
} from '@/shared/grid/query/gridQuery.contracts';
import type { ServerSelectionIntent } from '@/shared/grid/selection/serverSelection';

export type LoanField =
  | 'borrower'
  | 'principal'
  | 'currency'
  | 'status'
  | 'originationDate'
  | 'internalScore'
  | 'region';

export interface LoanReviewRow extends Record<string, unknown> {
  id: string;
  borrower: string;
  principal: number;
  currency: string;
  status: 'Active' | 'Pending' | 'Closed';
  originationDate: string;
  internalScore: number;
  region: string;
}

export type LoanListRequest = GridListRequest<LoanField>;
export type LoanListResponse = GridListResponse<LoanReviewRow>;

export interface LoanSubmitRequest {
  selection: ServerSelectionIntent<string>;
  filters: GridQueryFilter<LoanField>[];
}

export interface LoanSubmitResponse {
  submittedCount: number;
}
