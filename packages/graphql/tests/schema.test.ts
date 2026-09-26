/**
 * GraphQL schema generator tests.
 */

import { describe, expect, it } from 'bun:test';
import { graphql } from 'graphql';
import { field, type FieldMap } from '@ship/core';
import { buildTypeDefs } from '../src/sdl';
import { buildGraphQLSchema, type ServiceResolvers } from '../src/schema';

const postFields: FieldMap = {
  title: field.text({ required: true }),
  status: field.select(['draft', 'published']),
  price: field.decimal(),
  tags: field.relation('Tag', { many: true }),
  author: field.relation('User'),
};

describe('buildTypeDefs', () => {
  it('emits the Post type, create input, enum, and root operations', () => {
    const sdl = buildTypeDefs([{ name: 'Post', fields: postFields }]);

    expect(sdl).toContain('type Post');
    expect(sdl).toContain('input CreatePostInput');
    expect(sdl).toContain('enum PostStatusEnum');
    expect(sdl).toContain('posts(');
    expect(sdl).toContain('createPost');
  });
});

describe('buildGraphQLSchema', () => {
  it('executes a createPost mutation through the injected resolvers', async () => {
    const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
    const resolvers: ServiceResolvers = {
      list: async () => [],
      get: async () => null,
      create: async (model, input) => {
        calls.push({ model, input });
        return { id: '1', title: input.title, status: input.status };
      },
      update: async () => null,
      remove: async () => true,
    };

    const schema = buildGraphQLSchema(
      [{ name: 'Post', fields: postFields }],
      resolvers,
    );

    const result = await graphql({
      schema,
      source: 'mutation { createPost(input: { title: "Hi" }) { id title } }',
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ createPost: { id: '1', title: 'Hi' } });

    expect(calls).toHaveLength(1);
    expect(calls[0].model).toBe('Post');
    expect(calls[0].input).toEqual({ title: 'Hi' });
  });

  it('executes a post query through the injected get resolver', async () => {
    const resolvers: ServiceResolvers = {
      list: async () => [],
      get: async (model, id) => {
        expect(model).toBe('Post');
        expect(id).toBe('1');
        return { id: '1', title: 'Hello' };
      },
      create: async () => ({}),
      update: async () => null,
      remove: async () => true,
    };

    const schema = buildGraphQLSchema(
      [{ name: 'Post', fields: postFields }],
      resolvers,
    );

    const result = await graphql({
      schema,
      source: 'query { post(id: "1") { id title } }',
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ post: { id: '1', title: 'Hello' } });
  });
});
