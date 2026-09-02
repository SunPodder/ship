/**
 * Zod schema generation — turns a field map into a Zod object schema used by
 * the Hono route validators and shared between frontend and backend.
 */

import { z } from 'zod';
import type { FieldDef, FieldMap } from './fields';

export type ValidationMode = 'create' | 'update';

/** Builds the base Zod type for a single field (requiredness applied later). */
export function fieldZodType(field: FieldDef): z.ZodTypeAny {
  switch (field.kind) {
    case 'text':
    case 'textarea':
    case 'richText':
    case 'url':
    case 'email':
    case 'password':
    case 'slug': {
      const o = field.options;
      let s: z.ZodString = z.string();
      if ('minLength' in o && o.minLength !== undefined) s = s.min(o.minLength);
      if ('maxLength' in o && o.maxLength !== undefined) s = s.max(o.maxLength);
      if (field.kind === 'email') s = s.email();
      if (field.kind === 'url') s = s.url();
      return s;
    }

    case 'decimal':
    case 'float': {
      const o = field.options;
      let s: z.ZodNumber = z.number();
      if (o.min !== undefined) s = s.min(o.min);
      if (o.max !== undefined) s = s.max(o.max);
      return s;
    }

    case 'integer': {
      const o = field.options;
      let s: z.ZodNumber = z.number().int();
      if (o.min !== undefined) s = s.min(o.min);
      if (o.max !== undefined) s = s.max(o.max);
      return s;
    }

    case 'boolean':
      return z.boolean();

    case 'select':
      return field.options.options.length > 0
        ? z.enum(field.options.options as unknown as [string, ...string[]])
        : z.string();

    case 'multiSelect':
      return field.options.options.length > 0
        ? z.array(z.enum(field.options.options as unknown as [string, ...string[]]))
        : z.array(z.string());

    case 'datetime':
    case 'date':
    case 'time':
      return z.string();

    case 'json':
      return field.options.schema ?? z.unknown();

    case 'relation':
      return field.options.many ? z.array(z.string()) : z.string();

    case 'image':
      return field.options.many ? z.array(z.string()) : z.string();

    case 'file':
      return z.string();

    case 'embedded': {
      const sub = buildZodSchema(field.options.schema, 'create');
      return field.options.many ? z.array(sub) : sub;
    }

    default:
      return z.unknown();
  }
}

/** A field is optional in create input when nullable, not required, or a derived slug. */
export function isOptionalField(field: FieldDef): boolean {
  const o = field.options;
  if ('required' in o && o.required === false) return true;
  if ('nullable' in o && o.nullable === true) return true;
  if (field.kind === 'slug' && 'from' in o && typeof o.from === 'string') return true;
  return false;
}

/** Builds the full object schema for a model's create or update payload. */
export function buildZodSchema<F extends FieldMap>(
  fields: F,
  mode: ValidationMode = 'create',
): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};

  for (const [name, field] of Object.entries(fields) as [string, FieldDef][]) {
    let schema = fieldZodType(field);

    if ('default' in field.options && field.options.default !== undefined) {
      schema = schema.optional().default(field.options.default as never);
    } else if (mode === 'update' || isOptionalField(field)) {
      schema = schema.optional();
    }

    shape[name] = schema;
  }

  return z.object(shape);
}
