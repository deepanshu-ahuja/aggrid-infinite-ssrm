import { postJson } from '@/shared/api/apiClient';
import type {
  LoanListRequest,
  LoanListResponse,
  LoanSubmitRequest,
  LoanSubmitResponse,
} from './loan.contracts';

/** Loan keeps the repository's standard flat server-grid query request/response vocabulary. */
export function listLoans(request: LoanListRequest, signal?: AbortSignal) {
  return postJson<LoanListResponse, LoanListRequest>('/review/loans/query/', request, signal);
}

/** Review's common Submit action delegates Loan-specific wire semantics to this feature API. */
export function submitLoans(request: LoanSubmitRequest, signal?: AbortSignal) {
  return postJson<LoanSubmitResponse, LoanSubmitRequest>('/review/loans/submit/', request, signal);
}
