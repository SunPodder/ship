import { describe, expect, it } from 'bun:test';
import { defineModel, extendModel, pluralize, lowerFirst, BUILTIN_USER_FIELDS } from '../src/model';
import { field } from '../src/fields';

describe('defineModel', () => {
  it('derives the collection name from the model name', () => {
    const Post = defineModel('Post', { title: field.text() });
    expect(Post.name).toBe('Post');
    expect(Post.collection).toBe('posts');
  });

  it('pluralizes irregular suffixes', () => {
    expect(pluralize(lowerFirst('Category'))).toBe('categories');
    expect(pluralize(lowerFirst('Address'))).toBe('addresses');
    expect(pluralize(lowerFirst('Post'))).toBe('posts');
    expect(pluralize(lowerFirst('User'))).toBe('users');
  });

  it('stores fields and options', () => {
    const Post = defineModel(
      'Post',
      { title: field.text({ required: true }) },
      { cache: { ttl: 300 }, auditLog: true },
    );
    expect(Post.fields.title.kind).toBe('text');
    expect(Post.options.cache).toEqual({ ttl: 300 });
    expect(Post.options.auditLog).toBe(true);
  });

  it('exposes the built-in User model fields', () => {
    expect(Object.keys(BUILTIN_USER_FIELDS)).toContain('email');
    expect(Object.keys(BUILTIN_USER_FIELDS)).toContain('password');
  });
});

describe('extendModel', () => {
  it('returns name and fields', () => {
    const ext = extendModel('User', { bio: field.textarea() });
    expect(ext.name).toBe('User');
    expect(ext.fields.bio.kind).toBe('textarea');
  });
});
