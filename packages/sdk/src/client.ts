/**
 * Ship SDK REST client — a minimal typed transport over `fetch`.
 *
 * `createShipClient` exposes `get`/`post`/`patch`/`del`, which target the
 * generated REST API and surface transport and application-level failures as
 * `ShipError`s. Success responses use the `{ data }` envelope; errors use
 * `{ error, message }`.
 */

import { ShipError } from '@ship/core';

export interface ShipClientOptions {
  /** API base URL, e.g. `http://localhost:3001`. */
  baseUrl: string;
  fetchFn?: typeof fetch;
}

export interface ShipClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
}

interface ApiEnvelope<T> {
  data?: T;
  error?: string;
  message?: string;
}

export function createShipClient(options: ShipClientOptions): ShipClient {
  const fetchFn = options.fetchFn ?? fetch;
  const base = options.baseUrl.replace(/\/+$/, '');

  async function request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetchFn(`${base}${path}`, init);
    const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

    if (!response.ok) {
      throw new ShipError(
        body?.error ?? 'REQUEST_FAILED',
        body?.message ?? `Request failed with status ${response.status}`,
        { status: response.status },
      );
    }

    return (body?.data ?? null) as T;
  }

  return {
    get: (path) => request(path, { method: 'GET' }),
    post: (path, body) =>
      request(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    patch: (path, body) =>
      request(path, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    del: (path) => request(path, { method: 'DELETE' }),
  };
}
