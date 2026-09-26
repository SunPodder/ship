/**
 * Schema builder tests — assert on the returned Mongoose `Schema` only.
 * No database connection is opened.
 */

import { describe, expect, it } from 'bun:test';
import { Schema } from 'mongoose';
import { buildMongooseSchema } from '../src/index';
import { field } from '@ship/core';

describe('buildMongooseSchema', () => {
  it('maps a text field to a required String path with maxlength', () => {
    const schema = buildMongooseSchema({
      title: field.text({ required: true, maxLength: 200 }),
    });

    expect(schema.paths.title.instance).toBe('String');
    expect(schema.paths.title.options.required).toBe(true);
    expect(schema.paths.title.options.maxlength).toBe(200);
  });

  it('maps a select field to a String path with enum', () => {
    const schema = buildMongooseSchema({ status: field.select(['a', 'b']) });

    expect(schema.paths.status.instance).toBe('String');
    expect(schema.paths.status.options.enum).toEqual(['a', 'b']);
  });

  it('maps a single relation to an ObjectId with a ref', () => {
    const schema = buildMongooseSchema({ author: field.relation('User') });

    expect(schema.paths.author.instance).toBe('ObjectId');
    expect(schema.paths.author.options.ref).toBe('User');
  });

  it('maps a many relation to an array of ObjectIds with a ref', () => {
    const schema = buildMongooseSchema({
      tags: field.relation('User', { many: true }),
    });

    expect(schema.paths.tags.instance).toBe('Array');
    // The array path carries its element schema type on `caster`.
    const tags = schema.paths.tags as Schema.Types.Array;
    expect(tags.caster?.options.ref).toBe('User');
  });

  it('maps an embedded field to a nested subdocument path', () => {
    const schema = buildMongooseSchema({
      profile: field.embedded({
        schema: { name: field.text({ required: true }) },
      }),
    });

    expect(schema.paths.profile.schema?.paths.name).toBeTruthy();
  });

  it('maps a decimal field to Decimal128', () => {
    const schema = buildMongooseSchema({ price: field.decimal() });

    expect(schema.paths.price.instance).toBe('Decimal128');
  });

  it('applies a boolean default', () => {
    const schema = buildMongooseSchema({
      active: field.boolean({ default: true }),
    });

    expect(schema.paths.active.options.default).toBe(true);
  });

  it('enables timestamps by default', () => {
    const schema = buildMongooseSchema({ title: field.text() });

    expect(schema.get('timestamps')).toBe(true);
  });

  it('adds a deletedAt path when softDelete is enabled', () => {
    const schema = buildMongooseSchema(
      { title: field.text() },
      { softDelete: true },
    );

    expect(schema.paths.deletedAt.instance).toBe('Date');
    expect(schema.paths.deletedAt.options.default).toBeNull();
  });

  it('applies declared indexes via schema.indexes()', () => {
    const schema = buildMongooseSchema(
      { title: field.text() },
      {
        indexes: [
          { fields: ['title'], type: 'text', name: 'title_text' },
          { fields: ['title'], unique: true },
        ],
      },
    );

    const indexes = schema.indexes();

    const textIndex = indexes.find(([fields]) => fields.title === 'text');
    expect(textIndex).toBeDefined();
    expect(textIndex?.[1].name).toBe('title_text');

    const uniqueIndex = indexes.find(([fields]) => fields.title === 1);
    expect(uniqueIndex?.[1].unique).toBe(true);
  });

  it('builds the acceptance schema with title, status, and author paths', () => {
    const schema = buildMongooseSchema(
      {
        title: field.text({ required: true, maxLength: 200 }),
        status: field.select(['a', 'b']),
        author: field.relation('User'),
      },
      { timestamps: true },
    );

    expect(schema.paths.title.instance).toBe('String');
    expect(schema.paths.title.options.required).toBe(true);
    expect(schema.paths.status.options.enum).toEqual(['a', 'b']);
    expect(schema.paths.author.instance).toBe('ObjectId');
    expect(schema.paths.author.options.ref).toBe('User');
  });
});
