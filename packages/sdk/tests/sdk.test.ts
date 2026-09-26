/**
 * SDK tests — typed GraphQL client and model API behavior.
 */

import { describe, expect, test } from 'bun:test';
import { field, ShipError } from '@ship/core';
import { createModelApi } from '../src/index';

interface CapturedCall {
  url: string;
  query: string;
  variables?: Record<string, unknown>;
}

function mockFetch(respond: (query: string) => unknown) {
  const calls: CapturedCall[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      query: string;
      variables?: Record<string, unknown>;
    };
    calls.push({ url: String(input), query: body.query, variables: body.variables });
    return new Response(JSON.stringify(respond(body.query)), {
      status: 200,
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

function makeApi(respond: (query: string) => unknown) {
  const { fetchFn, calls } = mockFetch(respond);
  const api = createModelApi(
    { name: 'Post', fields: { title: field.text() } },
    { url: 'http://ship.test/graphql', fetchFn },
  );
  return { api, calls };
}

describe('createModelApi', () => {
  test('list operation targets the plural query with the full selection', async () => {
    const { api, calls } = makeApi(() => ({ data: { posts: [record] } }));
    await api.findMany();
    expect(calls[0].query).toContain('posts(filter:');
    expect(calls[0].query).toContain('id title createdAt');
  });

  test('findMany maps where/take to filter/limit and returns records', async () => {
    const { api, calls } = makeApi(() => ({ data: { posts: [record] } }));
    const rows = await api.findMany({ where: { status: 'published' }, take: 10 });
    expect(rows).toEqual([record]);
    expect(calls[0].variables).toEqual({ filter: { status: 'published' }, limit: 10 });
  });

  test('findById returns the mock record and targets post(id: $id)', async () => {
    const { api, calls } = makeApi(() => ({ data: { post: record } }));
    expect(await api.findById('abc')).toEqual(record);
    expect(calls[0].query).toContain('post(id: $id)');
  });

  test('create uses the createPost mutation and returns the record', async () => {
    const { api, calls } = makeApi(() => ({ data: { createPost: record } }));
    const created = await api.create({ title: 'Hi' });
    expect(created).toEqual(record);
    expect(calls[0].query).toContain('mutation CreatePost');
    expect(calls[0].query).toContain('createPost(input: $input)');
  });

  test('delete returns true', async () => {
    const { api } = makeApi(() => ({ data: { deletePost: true } }));
    expect(await api.delete('abc')).toBe(true);
  });

  test('a GraphQL errors response throws a ShipError', async () => {
    const { api } = makeApi(() => ({
      data: null,
      errors: [{ message: 'Something went wrong' }],
    }));

    let caught: unknown;
    try {
      await api.findById('abc');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ShipError);
    expect((caught as ShipError).code).toBe('GRAPHQL_ERROR');
  });
});
