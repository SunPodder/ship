import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { buildZodSchema, fieldZodType, isOptionalField } from '../src/validation';
import { field } from '../src/fields';

describe('buildZodSchema', () => {
  it('builds a create schema where required fields are required', () => {
    const schema = buildZodSchema({
      title: field.text({ required: true, minLength: 3, maxLength: 10 }),
      price: field.decimal({ min: 0 }),
      active: field.boolean(),
    });
    expect(schema.parse({ title: 'hello', price: 5, active: true })).toEqual({
      title: 'hello',
      price: 5,
      active: true,
    });
    expect(() => schema.parse({ price: 5, active: true })).toThrow();
  });

  it('enforces text min/max length', () => {
    const schema = buildZodSchema({ title: field.text({ minLength: 3, maxLength: 5 }) });
    expect(() => schema.parse({ title: 'ab' })).toThrow();
    expect(() => schema.parse({ title: 'abcdef' })).toThrow();
    expect(schema.parse({ title: 'abc' }).title).toBe('abc');
  });

  it('validates select against its options', () => {
    const schema = buildZodSchema({
      status: field.select(['draft', 'published'], { default: 'draft' }),
    });
    // default applied when omitted
    expect(schema.parse({}).status).toBe('draft');
    expect(schema.parse({ status: 'published' }).status).toBe('published');
    expect(() => schema.parse({ status: 'archived' })).toThrow();
  });

  it('treats nullable fields as optional in create', () => {
    const schema = buildZodSchema({
      body: field.richText({ nullable: true }),
    });
    expect(schema.parse({})).toEqual({});
  });

  it('treats a derived slug as optional', () => {
    expect(isOptionalField(field.slug({ from: 'title' }))).toBe(true);
    expect(isOptionalField(field.slug())).toBe(false);
    const schema = buildZodSchema({ slug: field.slug({ from: 'title' }) });
    expect(schema.parse({}).slug).toBeUndefined();
  });

  it('makes every field optional in update mode', () => {
    const schema = buildZodSchema(
      { title: field.text({ required: true }) },
      'update',
    );
    expect(schema.parse({})).toEqual({});
  });

  it('validates relation fields as ids', () => {
    const schema = buildZodSchema({
      author: field.relation('User'),
      tags: field.relation('Tag', { many: true }),
    });
    expect(schema.parse({ author: 'abc', tags: ['a', 'b'] })).toEqual({
      author: 'abc',
      tags: ['a', 'b'],
    });
    expect(() => schema.parse({ author: 'abc', tags: 'not-array' })).toThrow();
  });

  it('validates email and url fields', () => {
    const schema = buildZodSchema({
      email: field.email(),
      site: field.url(),
    });
    expect(() => schema.parse({ email: 'not-an-email', site: 'x' })).toThrow();
    expect(schema.parse({ email: 'a@b.com', site: 'https://x.com' })).toEqual({
      email: 'a@b.com',
      site: 'https://x.com',
    });
  });

  it('builds nested schemas for embedded documents', () => {
    const schema = buildZodSchema({
      variants: field.embedded({
        many: true,
        schema: { size: field.text({ required: true }), stock: field.integer({ default: 0 }) },
      }),
    });
    const parsed = schema.parse({
      variants: [{ size: 'M' }],
    });
    expect(parsed.variants[0].stock).toBe(0);
    expect(() => schema.parse({ variants: [{ stock: 5 }] })).toThrow();
  });

  it('uses a custom JSON schema when provided', () => {
    const schema = buildZodSchema({
      meta: field.json({ schema: z.object({ views: z.number() }) }),
    });
    expect(schema.parse({ meta: { views: 3 } }).meta).toEqual({ views: 3 });
    expect(() => schema.parse({ meta: { views: 'x' } })).toThrow();
  });

  it('fieldZodType coerces integer inputs', () => {
    const t = fieldZodType(field.integer({ min: 0 }));
    expect(() => t.parse(1.5)).toThrow();
    expect(t.parse(2)).toBe(2);
  });
});
