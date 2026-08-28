import { ApiError } from './apiError';

const API_BASE_URL = '/api';

async function readJsonResponse<TResponse>(response: Response): Promise<TResponse> {
  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}.`, response.status, payload);
  }

  return payload as TResponse;
}

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

  return readJsonResponse<TResponse>(response);
}

/** GET shares the same typed JSON/error boundary without inventing feature semantics here. */
export async function getJson<TResponse>(path: string, signal?: AbortSignal): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    signal,
  });

  return readJsonResponse<TResponse>(response);
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

/**
 * POST a JSON request whose successful response is a file/blob rather than JSON.
 *
 * Selected server-grid export needs this transport shape because the browser sends the same logical
 * selection/query contract as a bulk action but receives CSV bytes. Keeping blob handling here avoids
 * teaching generic grid selection code about HTTP or download mechanics.
 */
export async function postBlob<TRequest>(
  path: string,
  body: TRequest,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    // Error responses from the DRF API are JSON. Preserve the same ApiError payload behavior as the
    // JSON helpers so feature UI can surface validation failures consistently instead of receiving a
    // meaningless Blob containing an error document.
    const payload: unknown = await response.json().catch(() => undefined);
    throw new ApiError(`Request failed with status ${response.status}.`, response.status, payload);
  }

  return response.blob();
}
