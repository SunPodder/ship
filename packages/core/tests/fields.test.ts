import { describe, expect, it } from 'bun:test';
import { field } from '../src/fields';

describe('field DSL', () => {
  it('creates text fields with options', () => {
    const f = field.text({ required: true, maxLength: 200, searchable: true });
    expect(f.kind).toBe('text');
    expect(f.options.maxLength).toBe(200);
    expect(f.options.searchable).toBe(true);
  });

  it('creates a select with default and literal options', () => {
    const f = field.select(['draft', 'published', 'archived'], { default: 'draft' });
    expect(f.kind).toBe('select');
    expect(f.options.options).toEqual(['draft', 'published', 'archived']);
    expect(f.options.default).toBe('draft');
  });

  it('creates a relation carrying the model name', () => {
    const f = field.relation('User', { many: false, required: true });
    expect(f.kind).toBe('relation');
    expect(f.options.model).toBe('User');
    expect(f.options.many).toBe(false);
  });

  it('creates an embedded document field with a nested schema', () => {
    const f = field.embedded({
      schema: { size: field.text({ required: true }) },
      many: true,
    });
    expect(f.kind).toBe('embedded');
    expect(f.options.many).toBe(true);
    expect(Object.keys(f.options.schema)).toEqual(['size']);
  });

  it('creates image and file fields', () => {
    expect(field.image({ storage: 'r2' }).kind).toBe('image');
    expect(field.file({ accept: ['.pdf'] }).kind).toBe('file');
  });

  it('supports every documented field kind', () => {
    const kinds = [
      field.text().kind,
      field.textarea().kind,
      field.richText().kind,
      field.url().kind,
      field.email().kind,
      field.password().kind,
      field.slug({ from: 'title' }).kind,
      field.decimal().kind,
      field.integer().kind,
      field.float().kind,
      field.boolean().kind,
      field.select(['a']).kind,
      field.multiSelect(['a']).kind,
      field.datetime().kind,
      field.date().kind,
      field.time().kind,
      field.json().kind,
      field.relation('User').kind,
      field.embedded({ schema: {} }).kind,
      field.image().kind,
      field.file().kind,
    ];
    expect(new Set(kinds).size).toBe(21);
  });
});
