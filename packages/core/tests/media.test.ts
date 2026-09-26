import { describe, expect, it } from 'bun:test';
import { BUILTIN_MEDIA_FIELDS, defineMediaModel, defineModel } from '../src/model';
import { field } from '../src/fields';

describe('built-in Media model', () => {
  it('exposes the standard media fields', () => {
    const keys = Object.keys(BUILTIN_MEDIA_FIELDS);
    expect(keys).toContain('filename');
    expect(keys).toContain('mimeType');
    expect(keys).toContain('size');
    expect(keys).toContain('width');
    expect(keys).toContain('height');
    expect(keys).toContain('url');
    expect(keys).toContain('sizes');
  });

  it('defines a Media model with the `media` collection and defaults', () => {
    const Media = defineMediaModel();
    expect(Media.name).toBe('Media');
    expect(Media.collection).toBe('media');
    expect(Media.options.cache).toEqual({ ttl: 3600, tags: ['media'] });
    expect(Media.options.permissions?.read).toBe('public');
    expect(Media.options.admin?.group).toBe('Media');
  });

  it('allows overriding defaults', () => {
    const Media = defineMediaModel({ permissions: { read: 'none' } });
    expect(Media.options.permissions?.read).toBe('none');
  });
});

describe('collection override', () => {
  it('defineModel honors an explicit collection name', () => {
    const Blog = defineModel('Blog', { title: field.text() }, { collection: 'blog_posts' });
    expect(Blog.collection).toBe('blog_posts');
  });

  it('falls back to pluralized lower-first name', () => {
    expect(defineModel('Post', { title: field.text() }).collection).toBe('posts');
  });
});
