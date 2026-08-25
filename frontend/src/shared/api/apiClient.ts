import { ApiError } from './apiError';

const API_BASE_URL = '/api';

async function requestJson<TResponse, TRequest>(
  method: 'POST' | 'PATCH',
  path: string,
  body: TRequest,
  signal?: AbortSignal,
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });

  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new ApiError(
      `Request failed with status ${response.status}.`,
      response.status,
      payload,
    );
  }

  return payload as TResponse;
}

/** Shared HTTP/JSON error handling stays here; feature modules still own their concrete endpoints. */
export function postJson<TResponse, TRequest>(
  path: string,
  body: TRequest,
  signal?: AbortSignal,
): Promise<TResponse> {
  return requestJson<TResponse, TRequest>('POST', path, body, signal);
}

/** PATCH uses the same transport/error contract without forcing feature-specific mutation semantics here. */
export function patchJson<TResponse, TRequest>(
  path: string,
  body: TRequest,
  signal?: AbortSignal,
): Promise<TResponse> {
  return requestJson<TResponse, TRequest>('PATCH', path, body, signal);
}
