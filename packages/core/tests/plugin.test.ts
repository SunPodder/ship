import { describe, expect, it } from 'bun:test';
import { definePlugin, defineField } from '../src/plugin';
import { defineModel } from '../src/model';
import { field } from '../src/fields';

describe('defineField', () => {
  it('returns kind and options verbatim', () => {
    expect(defineField('color', { format: 'hex' })).toEqual({
      kind: 'color',
      options: { format: 'hex' },
    });
  });

  it('defaults options to an empty object', () => {
    expect(defineField('custom')).toEqual({ kind: 'custom', options: {} });
  });
});

describe('definePlugin', () => {
  it('returns the same object reference', () => {
    const plugin = {
      name: 'ship-plugin-seo',
      fields: { color: defineField('color', { format: 'hex' }) },
    };
    expect(definePlugin(plugin)).toBe(plugin);
  });
});

describe('defineModel options', () => {
  it('stores indexes, softDelete, collection, computed, and virtual options', () => {
    const Post = defineModel(
      'Post',
      { title: field.text() },
      {
        collection: 'blog_posts',
        indexes: [{ fields: ['slug'], unique: true }],
        softDelete: true,
        computed: {
          wordCount: { type: 'number', resolve: (row) => String(row.title ?? '').length },
        },
        virtual: {
          author: { model: 'User', resolve: (row, ctx) => ctx.model },
        },
      },
    );
    expect(Post.options.collection).toBe('blog_posts');
    expect(Post.options.indexes?.[0]?.unique).toBe(true);
    expect(Post.options.softDelete).toBe(true);
    expect(Post.options.computed?.wordCount?.type).toBe('number');
    expect(typeof Post.options.computed?.wordCount?.resolve).toBe('function');
    expect(Post.options.virtual?.author?.model).toBe('User');
  });
});
