import { postJson } from '@/shared/api/apiClient';
import type {
  FinanceSearchRequest,
  FinanceSearchResponse,
  FinanceSubmitRequest,
  FinanceSubmitResponse,
} from './finance.contracts';

/**
 * Finance intentionally uses a backend contract unrelated to GridListRequest/GridListResponse.
 * The feature mapper/runtime adapter below is responsible for translating it into the generic grid
 * loader shape; shared configurable-grid code never knows these wire names.
 */
export function searchFinance(request: FinanceSearchRequest, signal?: AbortSignal) {
  return postJson<FinanceSearchResponse, FinanceSearchRequest>(
    '/review/finance/search/',
    request,
    signal,
  );
}

export function submitFinanceReview(request: FinanceSubmitRequest, signal?: AbortSignal) {
  return postJson<FinanceSubmitResponse, FinanceSubmitRequest>(
    '/review/finance/commands/submit/',
    request,
    signal,
  );
}
