/**
 * SDK tests — typed REST client and model API behavior.
 */

import { describe, expect, test } from 'bun:test';
import { field, ShipError } from '@ship/core';
import { createModelApi } from '../src/index';

interface CapturedCall {
  url: string;
  method: string;
  body?: unknown;
}

function mockFetch(respond: (call: CapturedCall) => { status?: number; body: unknown }) {
  const calls: CapturedCall[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    const { status = 200, body: respBody } = respond(calls[calls.length - 1]);
    return new Response(JSON.stringify(respBody), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetchFn, calls };
}

const record = {
  id: 'abc',
  title: 'Hello',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function makeApi(respond: (call: CapturedCall) => { status?: number; body: unknown }) {
  const { fetchFn, calls } = mockFetch(respond);
  const api = createModelApi(
    { name: 'Post', collection: 'posts', fields: { title: field.text() } },
    { baseUrl: 'http://ship.test', fetchFn },
  );
  return { api, calls };
}

describe('createModelApi', () => {
  test('findMany targets GET /api/posts and returns records', async () => {
    const { api, calls } = makeApi(() => ({ body: { data: [record] } }));
    const rows = await api.findMany();

    expect(rows).toEqual([record]);
    expect(calls[0].method).toBe('GET');
    expect(new URL(calls[0].url).pathname).toBe('/api/posts');
  });

  test('findMany maps where/take/orderBy to filter/limit/sort', async () => {
    const { api, calls } = makeApi(() => ({ body: { data: [record] } }));
    await api.findMany({
      where: { status: 'published' },
      take: 10,
      orderBy: '-publishedAt',
      q: 'hello',
    });

    const url = new URL(calls[0].url);
    expect(url.searchParams.get('filter')).toBe('{"status":"published"}');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('sort')).toBe('-publishedAt');
    expect(url.searchParams.get('q')).toBe('hello');
  });

  test('findById targets GET /api/posts/:id', async () => {
    const { api, calls } = makeApi(() => ({ body: { data: record } }));
    expect(await api.findById('abc')).toEqual(record);
    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toBe('http://ship.test/api/posts/abc');
  });

  test('create POSTs to /api/posts and returns the record', async () => {
    const { api, calls } = makeApi(() => ({ body: { data: record } }));
    const created = await api.create({ title: 'Hi' });

    expect(created).toEqual(record);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('http://ship.test/api/posts');
    expect(calls[0].body).toEqual({ title: 'Hi' });
  });

  test('update PATCHes /api/posts/:id', async () => {
    const { api, calls } = makeApi(() => ({ body: { data: record } }));
    await api.update('abc', { title: 'Changed' });

    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].url).toBe('http://ship.test/api/posts/abc');
    expect(calls[0].body).toEqual({ title: 'Changed' });
  });

  test('delete DELETEs /api/posts/:id and returns true', async () => {
    const { api, calls } = makeApi(() => ({ body: { data: true } }));
    expect(await api.delete('abc')).toBe(true);
    expect(calls[0].method).toBe('DELETE');
    expect(calls[0].url).toBe('http://ship.test/api/posts/abc');
  });

  test('a non-2xx response throws a ShipError with the server message', async () => {
    const { api } = makeApi(() => ({
      status: 422,
      body: { error: 'VALIDATION_ERROR', message: 'Title is required' },
    }));

    let caught: unknown;
    try {
      await api.create({ title: '' });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ShipError);
    expect((caught as ShipError).code).toBe('VALIDATION_ERROR');
    expect((caught as ShipError).message).toBe('Title is required');
    expect((caught as ShipError).status).toBe(422);
  });
});
