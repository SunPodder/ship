/**
 * Ship SDK GraphQL client — a minimal typed transport over `fetch`.
 *
 * `createShipClient` exposes `query` and `mutate`, which both POST a
 * GraphQL document to the configured endpoint and surface transport and
 * GraphQL-level failures as `ShipError`s.
 */

import { ShipError } from '@ship/core';

export interface ShipClientOptions {
  url: string;
  fetchFn?: typeof fetch;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export interface ShipClient {
  query<T>(document: string, variables?: Record<string, unknown>): Promise<T>;
  mutate<T>(document: string, variables?: Record<string, unknown>): Promise<T>;
}

export function createShipClient(options: ShipClientOptions): ShipClient {
  const fetchFn = options.fetchFn ?? fetch;

  async function request<T>(
    document: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetchFn(options.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: document, variables }),
    });

    const body = (await response.json()) as GraphQLResponse<T>;

    const firstError = body.errors?.[0]?.message;
    if (!response.ok || (body.errors && body.errors.length > 0)) {
      throw new ShipError(
        'GRAPHQL_ERROR',
        firstError ?? `Request failed with status ${response.status}`,
        { status: response.status },
      );
    }

    return body.data as T;
  }

  return {
    query<T>(document: string, variables?: Record<string, unknown>): Promise<T> {
      return request<T>(document, variables);
    },
    mutate<T>(document: string, variables?: Record<string, unknown>): Promise<T> {
      return request<T>(document, variables);
    },
  };
}
